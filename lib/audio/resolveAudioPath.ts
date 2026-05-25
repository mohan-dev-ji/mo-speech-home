/**
 * Voice-first R2 audio path resolver — per ADR-009 §4.
 *
 * Replaces the legacy "store the path in the schema" model. After the Phase 8.0
 * migration, `symbols.audio` is a voice-keyed boolean map ("is voice seeded")
 * and paths are synthesised from convention here.
 *
 * Layout:
 *   audio/<voiceId>/symbols/<englishWord>.mp3   ← per-voice SymbolStix recording
 *   audio/<voiceId>/tts/<uuid>.mp3              ← cached TTS output
 *
 * The English word is the stable cross-language identifier for symbol audio,
 * even when a non-English voice plays it. Same convention as the legacy
 * `audio/eng/default/<word>.mp3` layout.
 *
 * **Legacy fallback (ADR-009 §4):**
 *
 * The MVP's en-GB-News-M recordings live at `audio/eng/default/<word>.mp3`,
 * not yet re-seeded under the new convention. Until Phase 8.4 (voice seeding)
 * re-uploads them, the resolver returns the legacy path for that voice.
 *
 * The cleanup path is one line: delete the `voiceId === "en-GB-News-M"` branch
 * once all 52k priority symbols are re-seeded at the new convention path.
 */

/** The legacy voice whose recordings still live at `audio/eng/default/`. */
const LEGACY_VOICE_ID = "en-GB-News-M";

/**
 * Returns the R2 path for a symbol's per-voice SymbolStix audio.
 *
 * `englishWord` is the symbol's English label (`words.en`) — used as the
 * filename for cross-language stability.
 *
 * Returns `null` if no audio is expected (caller should fall through to TTS).
 * The caller passes `seeded` — typically `symbol.audio[voiceId] === true`.
 */
export function resolveSymbolAudioPath(
  voiceId: string,
  englishWord: string,
  seeded: boolean,
): string | null {
  if (!seeded) return null;

  // Legacy fallback — see file header. Remove this branch once Phase 8.4
  // re-seeds en-GB-News-M under the new convention.
  if (voiceId === LEGACY_VOICE_ID) {
    return `audio/eng/default/${englishWord}.mp3`;
  }

  return `audio/${voiceId}/symbols/${englishWord}.mp3`;
}

/**
 * Returns the R2 key for a cached TTS output.
 *
 * Cache key is per-voice (not per-language) — see ADR-009 §4 / `ttsCache.ts`.
 */
export function resolveTtsAudioPath(voiceId: string, uuid: string): string {
  return `audio/${voiceId}/tts/${uuid}.mp3`;
}
