import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { uploadBuffer, isConfigured, fileExists } from "@/lib/r2-storage";
import { R2_PATHS, TTS_VOICES, DEFAULT_VOICE_ID, type VoiceId } from "@/lib/r2-paths";
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";


// ─── Google Cloud TTS (REST) ──────────────────────────────────────────────────

async function synthesise(text: string, voiceId: VoiceId): Promise<Buffer> {
  const credJson = process.env.GOOGLE_TTS_CREDENTIALS_JSON;
  if (!credJson) throw new Error("GOOGLE_TTS_CREDENTIALS_JSON not set");

  const googleAuth = new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await googleAuth.getClient();
  const { token } = await client.getAccessToken();

  const voice = TTS_VOICES[voiceId];
  const res = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: voice.languageCode, name: voice.name },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TTS API error ${res.status}: ${err}`);
  }

  const { audioContent } = (await res.json()) as { audioContent: string };
  return Buffer.from(audioContent, "base64");
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; voiceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawText = body.text?.trim();
  if (!rawText) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const voiceId: VoiceId =
    body.voiceId && body.voiceId in TTS_VOICES
      ? (body.voiceId as VoiceId)
      : DEFAULT_VOICE_ID;

  const normalised = rawText.toLowerCase().trim();

  // Convex client — auth token lets the write mutation verify the caller
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  // ── Step 1: SymbolStix folder for this voice ──────────────────────────────
  type LookupResult =
    | { source: "symbolstix"; audioDefault: string }
    | { source: "ttsCache"; r2Key: string }
    | { source: "none" };

  const lookup = await convex.query(api.ttsCache.lookup, {
    text: normalised,
    voiceId,
  }) as LookupResult;
  console.log(`[TTS] text="${normalised}" voiceId="${voiceId}" lookup=`, JSON.stringify(lookup));

  if (lookup.source === "symbolstix") {
    // audioDefault is already the full R2 path (e.g. "audio/eng/default/hello.mp3")
    const key = lookup.audioDefault;
    const exists = await fileExists(key);
    console.log(`[TTS] symbolstix key="${key}" exists=${exists}`);
    if (exists) {
      return NextResponse.json({ r2Key: key, cached: true, source: "symbolstix" });
    }
    // R2 file absent — fall through to generate
  }

  // ── Step 2: TTS cache ─────────────────────────────────────────────────────
  if (lookup.source === "ttsCache") {
    return NextResponse.json({ r2Key: lookup.r2Key, cached: true, source: "cache" });
  }

  // ── Step 3: Generate, upload, cache ──────────────────────────────────────
  try {
    const audioBuffer = await synthesise(rawText, voiceId);
    const r2Key = R2_PATHS.ttsAudio(voiceId, randomUUID());

    await uploadBuffer(r2Key, audioBuffer, "audio/mpeg");

    await convex.mutation(api.ttsCache.write, {
      text: normalised,
      voiceId,
      r2Key,
      charCount: rawText.length,
    });

    return NextResponse.json({ r2Key, cached: false, source: "generated" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TTS] generation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
