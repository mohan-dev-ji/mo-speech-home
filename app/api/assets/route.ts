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
 */
export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key param" }, { status: 400 });
  }

  const url = await getSignedFileUrl(key, 300);
  return NextResponse.redirect(url);
}
