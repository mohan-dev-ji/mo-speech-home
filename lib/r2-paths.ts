export const TTS_VOICES = {
  "en-GB-News-M": { languageCode: "en-GB", name: "en-GB-News-M" },
  // Phase 8.4 — English female, same "News" family as the male above so the
  // pair is stylistically consistent. Symbol library seeded under the new
  // voice-first convention (audio/en-GB-News-G/symbols/...).
  "en-GB-News-G": { languageCode: "en-GB", name: "en-GB-News-G" },
  // Phase 8.4 (Spanish) — Latin American Spanish WaveNet pair. Symbols seeded
  // from words.es under audio/<voiceId>/symbols/<words.en>.mp3 (English word is
  // the stable filename key; the clip itself is Spanish).
  "es-US-Wavenet-C": { languageCode: "es-US", name: "es-US-Wavenet-C" }, // male
  "es-US-Wavenet-A": { languageCode: "es-US", name: "es-US-Wavenet-A" }, // female
  // Phase 8.4 (Hindi) — Indian Hindi WaveNet pair. Symbols seeded from
  // words.hi under audio/<voiceId>/symbols/<words.en>.mp3 (English word is the
  // stable filename key; the clip itself is Hindi).
  "hi-IN-Wavenet-F": { languageCode: "hi-IN", name: "hi-IN-Wavenet-F" }, // male
  "hi-IN-Wavenet-E": { languageCode: "hi-IN", name: "hi-IN-Wavenet-E" }, // female
  // Additional voices added here as their SymbolStix libraries are seeded
} as const;

export type VoiceId = keyof typeof TTS_VOICES;

export const DEFAULT_VOICE_ID: VoiceId = "en-GB-News-M";

// NOTE: per-symbol SymbolStix audio paths are resolved exclusively by
// `resolveSymbolAudioPath` in lib/audio/resolveAudioPath.ts — the single source
// of truth for the voice-first layout (`audio/<voiceId>/symbols/<word>.mp3`,
// with the legacy `audio/eng/default/` fallback for en-GB-News-M). Do NOT add a
// path builder for symbol audio here; a duplicate drifted to `/symbolstix/` and
// was removed (Phase 8.4) precisely to avoid that hazard.
export const R2_PATHS = {
  ttsAudio: (voiceId: string, uuid: string) =>
    `audio/${voiceId}/tts/${uuid}.mp3`,

  profileImage: (profileId: string, uuid: string) =>
    `profiles/${profileId}/images/${uuid}.webp`,

  profileAudio: (profileId: string, uuid: string, ext = "mp3") =>
    `profiles/${profileId}/audio/${uuid}.${ext}`,

  // Global AI image cache — shared across all users, never deleted on profile delete.
  // PNG because we accept Imagen's native output (no sharp resize).
  aiCache: (uuid: string) => `ai-cache/${uuid}.png`,
} as const;
