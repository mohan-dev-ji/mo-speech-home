import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { uploadBuffer, isConfigured, fileExists } from "@/lib/r2-storage";
import { R2_PATHS, TTS_VOICES, DEFAULT_VOICE_ID, type VoiceId } from "@/lib/r2-paths";
import { resolveSymbolAudioPath } from "@/lib/audio/resolveAudioPath";
import {
  isTone,
  tonePrompt,
  geminiVoiceForPersona,
  type Tone,
} from "@/lib/audio/tonePresets";
import { personaOf } from "@/lib/audio/resolveVoiceId";
import { GoogleAuth } from "google-auth-library";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
// Gemini TTS is slower than standard synthesis (a few seconds) — give the route
// headroom over the platform default.
export const maxDuration = 60;

// One shared auth client — the SA (cloud-platform scope) reaches both the
// standard Text-to-Speech API and Vertex AI (Gemini). Credentials are parsed
// once and memoised (project_id is reused for the Vertex endpoint).
let sharedAuth: GoogleAuth | null = null;
let sharedCreds: { project_id: string } | null = null;
function googleCreds(): { project_id: string } {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  sharedCreds ??= JSON.parse(credJson);
  return sharedCreds!;
}
async function googleAccessToken(): Promise<string> {
  sharedAuth ??= new GoogleAuth({
    credentials: googleCreds(),
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
  tone: Tone,
  voiceName: string,
): Promise<Buffer> {
  const token = await googleAccessToken();
  const projectId = googleCreds().project_id;
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
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
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

  let body: { text?: string; voiceId?: string; tone?: string; literal?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawText = body.text?.trim();
  if (!rawText) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  // `literal` (Variant Lifecycle Stage 2): skip the SymbolStix default-audio
  // lookup and synthesise the EXACT text in the requested voice. Composed content
  // (sentence blocks) authors its own text, so a word must say what was typed in
  // the board voice, not the symbol's canonical per-language word (the translation).
  const literal = body.literal === true;

  const voiceId: VoiceId =
    body.voiceId && body.voiceId in TTS_VOICES
      ? (body.voiceId as VoiceId)
      : DEFAULT_VOICE_ID;

  // Tone (Phase 15, Thread 2). The tone-less path (▶ replay, whole library) is
  // the free Wavenet voice, unchanged. ANY requested tone — including the emoji
  // row's "neutral" — is a fluent Gemini clip: paid, Max-gated, distinct cache
  // key. Unknown values fall back to the free path (safe default).
  const requestedTone: Tone | undefined = isTone(body.tone) ? body.tone : undefined;
  const useGemini = requestedTone !== undefined;

  const normalised = rawText.toLowerCase().trim();

  // Convex client — auth token lets the write mutation verify the caller
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  // ── Tier gate — server-side authoritative (any requested tone) ────────────
  // The tone-less path (replay/library) is free Wavenet. Every requested tone —
  // including the emoji row's "neutral" — drives the paid Gemini model, so it's
  // Max-only: gated here as well as in the UI (UpgradeNudge), so a direct POST
  // can't bypass the paywall and burn cost. Mirrors the other Max-only routes
  // (ai-generate/imagen, image-search).
  if (useGemini) {
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
  // Requested tones never have SymbolStix recordings (seeded audio is the
  // neutral cheap voice), so the lookup skips it and only consults the
  // tone-keyed ttsCache.
  type LookupResult =
    | { source: "symbolstix"; englishWord: string; audioBasename?: string }
    | { source: "ttsCache"; r2Key: string }
    | { source: "none" };

  const lookup = await convex.query(api.ttsCache.lookup, {
    text: normalised,
    voiceId,
    tone: requestedTone,
    // Literal requests (composed/authored content) bypass the SymbolStix default so a
    // KNOWN word resolves its cached literal clip instead of regenerating every play.
    ...(literal ? { skipSymbolstix: true } : {}),
  }) as LookupResult;
  console.log(`[TTS] text="${normalised}" voiceId="${voiceId}" tone="${requestedTone ?? "-"}" lookup=`, JSON.stringify(lookup));

  if (!literal && lookup.source === "symbolstix") {
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
    if (requestedTone) {
      // Any requested tone → Gemini native TTS, in the resolved voice's language
      // and matching the profile's persona (gender/age from the voiceId — the
      // voice already encodes the student's persona). Output is WAV (24 kHz
      // PCM), stored on the tone-segmented path.
      const geminiVoice = geminiVoiceForPersona(personaOf(voiceId));
      const audioBuffer = await synthesiseGemini(
        rawText,
        TTS_VOICES[voiceId].languageCode,
        requestedTone,
        geminiVoice,
      );
      r2Key = R2_PATHS.ttsToneAudio(voiceId, requestedTone, randomUUID());
      await uploadBuffer(r2Key, audioBuffer, "audio/wav");
    } else {
      const audioBuffer = await synthesise(rawText, voiceId);
      r2Key = R2_PATHS.ttsAudio(voiceId, randomUUID());
      await uploadBuffer(r2Key, audioBuffer, "audio/mpeg");
    }

    await convex.mutation(api.ttsCache.write, {
      text: normalised,
      voiceId,
      // Tone-less (free Wavenet) rows omit the field, identical to legacy
      // entries; every Gemini clip (including "neutral") stores its tone.
      ...(useGemini ? { tone: requestedTone } : {}),
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