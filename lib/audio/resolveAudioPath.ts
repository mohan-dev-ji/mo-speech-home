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
 * The MVP's en-GB-News-M recordings live at `audio/eng/default/<basename>.mp3`,
 * where `<basename>` is a per-symbol filename that doesn't necessarily match
 * the English word — many symbols use SymbolStix IDs (e.g.
 * `symbol00187604.mp3` for "Hello Kitty"). Callers pass the per-symbol
 * `audioBasename` (populated by `migrations.backfillAudioBasenames`) when
 * available, and the resolver only falls back to `<englishWord>` when no
 * basename is stored — that fallback is correct for the ~1 in 6 MVP symbols
 * whose filename equals the word.
 *
 * Phase 8.4 (voice seeding) re-uploads en-GB-News-M under the new
 * `audio/en-GB-News-M/symbols/<word>.mp3` convention. Once that ships and
 * the `audioBasename` field can be dropped, this branch goes too.
 */

/** The legacy voice whose recordings still live at `audio/eng/default/`. */
const LEGACY_VOICE_ID = "en-GB-News-M";

/**
 * Returns the R2 path for a symbol's per-voice SymbolStix audio.
 *
 * `englishWord` is the symbol's English label (`words.en`). For non-legacy
 * voices it forms the filename directly.
 *
 * `audioBasename` is the optional per-symbol R2 filename (without extension)
 * stored on `symbols.audioBasename`. Used only on the legacy voice path —
 * for new voices the convention is `<word>.mp3` and the basename is ignored.
 *
 * Returns `null` if no audio is expected (caller should fall through to TTS).
 * The caller passes `seeded` — typically `symbol.audio[voiceId] === true`.
 */
export function resolveSymbolAudioPath(
  voiceId: string,
  englishWord: string,
  seeded: boolean,
  audioBasename?: string,
): string | null {
  if (!seeded) return null;

  // Legacy fallback — see file header. Remove this branch once Phase 8.4
  // re-seeds en-GB-News-M under the new convention.
  if (voiceId === LEGACY_VOICE_ID) {
    const basename = audioBasename ?? englishWord;
    return `audio/eng/default/${basename}.mp3`;
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
