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
 * even when a non-English voice plays it.
 *
 * Every voice now resolves by this one convention. Phase 20 re-seeded
 * en-GB-News-M — the last hold-out, whose MVP-era clips lived at
 * `audio/eng/default/<basename>.mp3` — under `audio/en-GB-News-M/symbols/`,
 * verified at 100% coverage, and removed its special-case. The MVP still
 * serves `audio/eng/default/`; Home no longer reads it.
 */

/**
 * Returns the R2 path for a symbol's per-voice SymbolStix audio.
 *
 * `englishWord` is the symbol's English label (`words.en`) and forms the
 * filename directly.
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
