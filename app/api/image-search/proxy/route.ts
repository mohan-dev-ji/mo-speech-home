import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { recordUnsplashDownload } from "@/lib/image-providers/unsplash";
import type { ImageProvider } from "@/lib/image-providers/types";

export const dynamic = "force-dynamic";

/**
 * Hosts we're willing to fetch image bytes from. The client passes the URL
 * back to us (it was previously cached in our `imageSearchCache` table), but
 * we re-validate so a malicious cache row or modified client request can't
 * pull bytes from arbitrary URLs through our authenticated proxy.
 */
const ALLOWED_HOSTS = new Set([
  "upload.wikimedia.org",
  "pixabay.com",
  "cdn.pixabay.com",
  "images.unsplash.com",
  "images.pexels.com",
]);

const KNOWN_PROVIDERS = new Set<ImageProvider>([
  "wikimedia",
  "pixabay",
  "unsplash",
  "pexels",
]);

const USER_AGENT =
  "mo-speech (https://mospeech.com; support@mospeech.com)";

/**
 * POST /api/image-search/proxy
 * Body: { fullImageUrl: string, provider: ImageProvider, providerId: string }
 *
 * Streams image bytes from the provider CDN back to the client. The client
 * uses the bytes to populate the symbol editor preview; the eventual R2 write
 * happens via the existing /api/upload-asset path.
 *
 * For Unsplash, we also fire a (non-blocking) download tracking ping —
 * required by Unsplash API ToS when an image is "used" (saved).
 *
 * Doesn't count against the user's daily quota — selecting a result is a
 * follow-on action to a search that already incremented.
 */
export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { fullImageUrl?: string; provider?: string; providerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { fullImageUrl, provider, providerId } = body;
  if (!fullImageUrl || typeof fullImageUrl !== "string") {
    return NextResponse.json({ error: "Missing fullImageUrl" }, { status: 400 });
  }
  if (!provider || !KNOWN_PROVIDERS.has(provider as ImageProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (!providerId || typeof providerId !== "string") {
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 });
  }

  // ── Tier gate ────────────────────────────────────────────────────────────
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const access = await convex.query(api.users.getMyAccess, {});
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isMax =
    (access.tier === "max" && access.hasFullAccess) ||
    (access.customAccess?.isActive ?? false);
  if (!isMax) {
    return NextResponse.json(
      { error: "max_tier_required" },
      { status: 403 }
    );
  }

  // ── Host allowlist ───────────────────────────────────────────────────────
  let parsed: URL;
  try {
    parsed = new URL(fullImageUrl);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json(
      { error: "upstream_host_not_allowed", host: parsed.hostname },
      { status: 400 }
    );
  }

  // ── Unsplash tracking ping (fire-and-forget per Unsplash ToS) ────────────
  if (provider === "unsplash") {
    void recordUnsplashDownload(providerId);
  }

  // ── Stream bytes back ────────────────────────────────────────────────────
  const upstream = await fetch(fullImageUrl, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!upstream.ok || !upstream.body) {
    console.error(
      `[image-proxy] upstream_fetch_failed provider=${provider} status=${upstream.status} url=${fullImageUrl}`
    );
    return NextResponse.json(
      { error: "upstream_fetch_failed", status: upstream.status },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    console.error(
      `[image-proxy] upstream_not_image provider=${provider} contentType=${contentType} url=${fullImageUrl}`
    );
    return NextResponse.json(
      { error: "upstream_not_image", contentType },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
