import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getWikimediaFullImage } from "@/lib/image-providers/wikimedia";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set(["upload.wikimedia.org"]);
const PROXY_WIDTH = 640; // saved-image size — see plan §"Image sizing"

/**
 * POST /api/image-search/proxy
 * Body: { pageId: number }
 *
 * Resolves the full image URL via a fresh imageinfo call (so we ask for the
 * upload size, not the grid thumbnail size we cached earlier), then streams
 * the bytes back. No transform, no R2 write — the modal Save flow handles R2
 * via the existing /api/upload-asset path.
 *
 * Doesn't count against the quota — selecting a result is a follow-on action
 * to a search that already incremented.
 */
export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { pageId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pageId = body.pageId;
  if (typeof pageId !== "number" || !Number.isFinite(pageId) || pageId <= 0) {
    return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
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

  // ── Resolve full image URL ───────────────────────────────────────────────
  let resolved;
  try {
    resolved = await getWikimediaFullImage(pageId, PROXY_WIDTH);
  } catch (err) {
    console.error("[image-proxy] resolve error", err);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }

  // Whitelist host so a malicious cache or provider response can't pull
  // bytes from arbitrary URLs through our auth.
  let parsed: URL;
  try {
    parsed = new URL(resolved.url);
  } catch {
    return NextResponse.json({ error: "invalid_upstream_url" }, { status: 502 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json(
      { error: "upstream_host_not_allowed", host: parsed.hostname },
      { status: 502 }
    );
  }

  // ── Stream bytes back ────────────────────────────────────────────────────
  const upstream = await fetch(resolved.url, {
    headers: {
      "User-Agent": "mo-speech (https://mospeech.com; support@mospeech.com)",
    },
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "upstream_fetch_failed", status: upstream.status },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
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
