import { auth } from "@clerk/nextjs/server";
import { getSignedFileUrl, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * R2 asset delivery via 302 redirect to pre-signed URL.
 *
 * The redirect pattern (not JSON) is critical for audio playback:
 * audio.play() must be called synchronously within a user gesture.
 * Awaiting a fetch() to get a URL first breaks the gesture chain.
 * A redirect preserves it — the browser follows transparently.
 *
 * All R2 assets remain private (SymbolStix licence / user data).
 * Never enable public R2 bucket access.
 *
 * Public-key allowlist: keys matching PUBLIC_KEY_PATTERN bypass the auth check.
 * Restricted to admin-curated marketing assets under static/pack-covers/ (pack
 * cover images shown on the public library page) and the default cover. The
 * allowlist is path-anchored and extension-restricted — SymbolStix files
 * (different prefix) cannot match.
 */
const PUBLIC_KEY_PATTERN = /^static\/(pack-covers\/[A-Za-z0-9._-]+|pack-cover-default)\.(webp|jpg|jpeg|png)$/;

// Signed-URL lifetime and how long the browser is allowed to cache the 302
// itself. max-age is kept comfortably below the signature expiry so a cached
// redirect can never point at an already-expired signature (worst case: the
// browser follows a cached redirect 3000-3600s after the signature was
// minted, well within its validity window).
const SIGNATURE_EXPIRY_SECONDS = 3600;
const REDIRECT_MAX_AGE_SECONDS = 3000;

export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key param" }, { status: 400 });
  }

  if (!PUBLIC_KEY_PATTERN.test(key)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = await getSignedFileUrl(key, SIGNATURE_EXPIRY_SECONDS);

  // Cache the redirect itself. `private` is required (not shared/CDN-cacheable):
  // these URLs are only valid for the requesting Clerk-authenticated user, and
  // a shared proxy caching one response could hand it to a different user.
  //
  // Safety argument: R2 keys under accounts/ and static/ are UUID-based and
  // content-addressed — a given key's bytes never change once written. So
  // caching the redirect for a key carries no stale-content risk, only a
  // stale-signature risk, which REDIRECT_MAX_AGE_SECONDS < SIGNATURE_EXPIRY_SECONDS
  // covers: the browser's cached 302 will always be re-fetched before the
  // signed URL it points to could have expired.
  return NextResponse.redirect(url, {
    headers: {
      "Cache-Control": `private, max-age=${REDIRECT_MAX_AGE_SECONDS}`,
    },
  });
}
