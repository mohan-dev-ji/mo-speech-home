import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { uploadBuffer, isConfigured, fileExists } from "@/lib/r2-storage";
import { R2_PATHS, TTS_VOICES, DEFAULT_VOICE_ID, type VoiceId } from "@/lib/r2-paths";
import { resolveSymbolAudioPath } from "@/lib/audio/resolveAudioPath";
import {
  isTone,
  isExpressiveTone,
  tonePrompt,
  GEMINI_TONE_VOICE,
  type Tone,
  type ExpressiveTone,
} from "@/lib/audio/tonePresets";
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
// Gemini TTS is slower than standard synthesis (a few seconds) — give the route
// headroom over the platform default.
export const maxDuration = 60;

// One shared auth client — the SA (cloud-platform scope) reaches both the
// standard Text-to-Speech API and Vertex AI (Gemini).
let sharedAuth: GoogleAuth | null = null;
async function googleAccessToken(): Promise<string> {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  sharedAuth ??= new GoogleAuth({
    credentials: JSON.parse(credJson),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await sharedAuth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain Google access token");
  return token;
}

// ─── Neutral path: Google Cloud TTS (REST) ─────────────────────────────────────

async function synthesise(text: string, voiceId: VoiceId): Promise<Buffer> {
  const token = await googleAccessToken();
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

// ─── Expressive path: Gemini 2.5 native TTS (Vertex AI) ─────────────────────────
// Emotion is a natural-language instruction the model performs (see
// tonePresets.ts). Output is 24 kHz mono PCM (L16); we wrap it as WAV. Only
// reachable on us-central1 today (preview) — the owner accepted US-region
// generation for this cached, low-sensitivity path (spike findings).

const GEMINI_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_LOCATION = "us-central1";

/** Prepend a 44-byte WAV header to raw 16-bit mono PCM. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(1, 22); // channels = mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesiseGemini(
  text: string,
  languageCode: string,
  tone: ExpressiveTone,
): Promise<Buffer> {
  const token = await googleAccessToken();
  const projectId = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!).project_id;
  const url =
    `https://${GEMINI_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${GEMINI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: tonePrompt(languageCode, tone, text) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TONE_VOICE } } },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini TTS error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini TTS returned no audio");

  const sampleRate = parseInt(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] ?? "24000", 10);
  return pcmToWav(Buffer.from(part.inlineData.data, "base64"), sampleRate);
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

  let body: { text?: string; voiceId?: string; tone?: string };
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

  // Tone (Phase 15, Thread 2). Unknown values degrade to neutral. Neutral keeps
  // the exact legacy behaviour (SymbolStix → Wavenet, tone omitted from the
  // cache key); expressive tones route through Gemini.
  const tone: Tone = isTone(body.tone) ? body.tone : "neutral";
  const expressive = isExpressiveTone(tone);

  const normalised = rawText.toLowerCase().trim();

  // Convex client — auth token lets the write mutation verify the caller
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  // ── Tier gate — server-side authoritative (expressive tones only) ─────────
  // Neutral is free for everyone (it's the whole library's voice). Expressive
  // tone drives the paid Gemini model, so it's Max-only — gated here as well as
  // in the UI (UpgradeNudge), so a direct POST can't bypass the paywall and burn
  // cost. Mirrors the other Max-only routes (ai-generate/imagen, image-search).
  if (expressive) {
    const access = await convex.query(api.users.getMyAccess, {});
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isMax =
      (access.tier === "max" && access.hasFullAccess) ||
      (access.customAccess?.isActive ?? false);
    if (!isMax) {
      return NextResponse.json(
        { error: "max_tier_required", message: "Expressive tone is a Max-tier feature" },
        { status: 403 }
      );
    }
  }

  // ── Step 1: SymbolStix folder for this voice ──────────────────────────────
  // Per ADR-009 §4 the lookup returns just the English word — the route
  // resolves the R2 key via convention (with the legacy
  // `audio/eng/default/` fallback baked into `resolveSymbolAudioPath` for
  // the en-GB-News-M voice until Phase 8.4 re-seeds it).
  //
  // Expressive tones never have SymbolStix recordings (seeded audio is neutral),
  // so the lookup skips it and only consults the tone-keyed ttsCache.
  type LookupResult =
    | { source: "symbolstix"; englishWord: string; audioBasename?: string }
    | { source: "ttsCache"; r2Key: string }
    | { source: "none" };

  const lookup = await convex.query(api.ttsCache.lookup, {
    text: normalised,
    voiceId,
    tone,
  }) as LookupResult;
  console.log(`[TTS] text="${normalised}" voiceId="${voiceId}" tone="${tone}" lookup=`, JSON.stringify(lookup));

  if (lookup.source === "symbolstix") {
    const key = resolveSymbolAudioPath(
      voiceId,
      lookup.englishWord,
      true,
      lookup.audioBasename,
    );
    if (key) {
      const exists = await fileExists(key);
      console.log(`[TTS] symbolstix key="${key}" exists=${exists}`);
      if (exists) {
        return NextResponse.json({ r2Key: key, cached: true, source: "symbolstix" });
      }
    }
    // R2 file absent — fall through to generate
  }

  // ── Step 2: TTS cache ─────────────────────────────────────────────────────
  if (lookup.source === "ttsCache") {
    return NextResponse.json({ r2Key: lookup.r2Key, cached: true, source: "cache" });
  }

  // ── Step 3: Generate, upload, cache ──────────────────────────────────────
  try {
    let r2Key: string;
    if (expressive) {
      // Expressive tone → Gemini native TTS, in the resolved voice's language.
      // Output is WAV (24 kHz PCM), stored on the tone-segmented path.
      const audioBuffer = await synthesiseGemini(
        rawText,
        TTS_VOICES[voiceId].languageCode,
        tone,
      );
      r2Key = R2_PATHS.ttsToneAudio(voiceId, tone, randomUUID());
      await uploadBuffer(r2Key, audioBuffer, "audio/wav");
    } else {
      const audioBuffer = await synthesise(rawText, voiceId);
      r2Key = R2_PATHS.ttsAudio(voiceId, randomUUID());
      await uploadBuffer(r2Key, audioBuffer, "audio/mpeg");
    }

    await convex.mutation(api.ttsCache.write, {
      text: normalised,
      voiceId,
      // Omit the tone field for neutral so the row is identical to legacy
      // entries and the neutral cache key stays byte-compatible.
      ...(expressive ? { tone } : {}),
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
