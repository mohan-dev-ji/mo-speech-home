/**
 * Voice resolution — the single source of "which voice does this student hear".
 * Phase 8.4.
 *
 * Precedence (first valid wins):
 *   1. the student's explicit override        (studentProfiles.voiceId)
 *   2. the account default for the language    (users.voiceDefaults[lang])
 *   3. the first registry voice for the language
 *   4. DEFAULT_VOICE_ID                         (final fallback)
 *
 * Every candidate is validated against `TTS_VOICES` before being returned, so a
 * stale id — a voice that was removed/renamed, or an override left over from a
 * previous profile language — falls through instead of producing a 404 R2 path.
 * Mirrors the `body.voiceId in TTS_VOICES` guard in app/api/tts/route.ts.
 *
 * Pure and client-safe (no Convex server imports): used by ProfileContext.
 */

import { TTS_VOICES, DEFAULT_VOICE_ID, type VoiceId } from "@/lib/r2-paths";
import { getLanguage } from "@/lib/languages/registry";

function isKnownVoice(id: string | null | undefined): id is VoiceId {
  return !!id && id in TTS_VOICES;
}

export function resolveVoiceId(opts: {
  studentVoiceId?: string | null;
  voiceDefaults?: Record<string, string> | null;
  lang: string;
}): VoiceId {
  const { studentVoiceId, voiceDefaults, lang } = opts;

  // 1. explicit student override
  if (isKnownVoice(studentVoiceId)) return studentVoiceId;

  // 2. account default for this language
  const accountDefault = voiceDefaults?.[lang];
  if (isKnownVoice(accountDefault)) return accountDefault;

  // 3. first registry voice for the language
  const firstRegistryVoice = getLanguage(lang)?.voices[0]?.ttsVoiceId;
  if (isKnownVoice(firstRegistryVoice)) return firstRegistryVoice;

  // 4. final fallback
  return DEFAULT_VOICE_ID;
}
