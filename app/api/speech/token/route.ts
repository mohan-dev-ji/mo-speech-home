import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

export const dynamic = "force-dynamic";

// Mints a short-lived (30s TTL) Deepgram access token for the browser. The
// master DEEPGRAM_API_KEY stays server-side; the client uses only the temp
// token (Deepgram's recommended browser pattern). Auth-gated to signed-in users.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    console.error("DEEPGRAM_API_KEY not set — voice-search fallback disabled");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const deepgram = createClient(key);
    const { result, error } = await deepgram.auth.grantToken();
    if (error || !result?.access_token) {
      console.error("Deepgram grantToken failed:", error);
      return NextResponse.json({ error: "Token grant failed" }, { status: 502 });
    }
    return NextResponse.json({
      token: result.access_token,
      expiresIn: result.expires_in,
    });
  } catch (err) {
    console.error("Deepgram token route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
