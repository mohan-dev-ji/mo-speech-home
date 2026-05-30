export const TTS_VOICES = {
  "en-GB-News-M": { languageCode: "en-GB", name: "en-GB-News-M" },
  // Phase 8.4 — English female, same "News" family as the male above so the
  // pair is stylistically consistent. Symbol library seeded under the new
  // voice-first convention (audio/en-GB-News-G/symbols/...).
  "en-GB-News-G": { languageCode: "en-GB", name: "en-GB-News-G" },
  // Additional voices added here as their SymbolStix libraries are seeded
} as const;

export type VoiceId = keyof typeof TTS_VOICES;

export const DEFAULT_VOICE_ID: VoiceId = "en-GB-News-M";

// en-GB-News-M was seeded before this folder structure existed.
// Its SymbolStix audio lives at the legacy path; all future voices use the standard layout.
const LEGACY_VOICE_ID: VoiceId = "en-GB-News-M";

export const R2_PATHS = {
  symbolstixAudio: (voiceId: string, audioDefault: string) =>
    voiceId === LEGACY_VOICE_ID
      ? `audio/eng/default/${audioDefault}`
      : `audio/${voiceId}/symbolstix/${audioDefault}`,

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
