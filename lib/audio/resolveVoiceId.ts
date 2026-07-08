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
import { getLanguage, getVoiceEntry, getVoiceLang } from "@/lib/languages/registry";

function isKnownVoice(id: string | null | undefined): id is VoiceId {
  return !!id && id in TTS_VOICES;
}

/** A voice's speaker persona — the part we preserve across a language switch. */
export type VoicePersona = { gender?: "male" | "female"; age?: "adult" | "child" };

/**
 * Read the persona (gender + age) of a voice id from the registry. Age defaults
 * to "adult" (every seeded voice is adult today). Unknown id → empty persona.
 */
export function personaOf(voiceId: string | null | undefined): VoicePersona {
  const entry = voiceId ? getVoiceEntry(voiceId) : undefined;
  if (!entry) return {};
  return { gender: entry.gender, age: entry.age ?? "adult" };
}

/**
 * Pick the voice in `lang` that best matches `persona` — gender+age, then gender,
 * then the language's first voice, then the global default. Never throws; a
 * language with no voices (e.g. Punjabi) falls straight through to the default.
 * Phase 15 (3e/3f): this is how "voice follows the resolved text's language" AND
 * "gender is preserved across a switch" are both satisfied.
 */
export function voiceForLanguage(lang: string, persona?: VoicePersona): VoiceId {
  const voices = getLanguage(lang)?.voices ?? [];
  const byGenderAge =
    persona?.gender &&
    voices.find(
      (v) =>
        v.gender === persona.gender &&
        (persona.age ? (v.age ?? "adult") === persona.age : true)
    );
  const byGender =
    persona?.gender && voices.find((v) => v.gender === persona.gender);
  const pick = (byGenderAge || byGender || voices[0])?.ttsVoiceId;
  return isKnownVoice(pick) ? pick : DEFAULT_VOICE_ID;
}

/**
 * Voice resolution — the single source of "which voice does this student hear".
 * Phase 8.4; persona-preservation added in Phase 15 (3f).
 *
 * Precedence (first valid wins):
 *   1. the student's explicit override        (studentProfiles.voiceId)
 *   2. the account default for the language    (users.voiceDefaults[lang])
 *   3. the first registry voice for the language
 *   4. DEFAULT_VOICE_ID                         (final fallback)
 *
 * When the strongest preference is a voice for a DIFFERENT language than `lang`
 * (e.g. a male English override on a profile switched to Hindi), we no longer
 * fall blindly to `voices[0]` (a fixed gender) — we map the preference's persona
 * into `lang` via `voiceForLanguage`, so a male stays male across the switch.
 */
export function resolveVoiceId(opts: {
  studentVoiceId?: string | null;
  voiceDefaults?: Record<string, string> | null;
  lang: string;
}): VoiceId {
  const { studentVoiceId, voiceDefaults, lang } = opts;

  // The strongest stated preference (student override beats account default).
  const preferred = isKnownVoice(studentVoiceId)
    ? studentVoiceId
    : isKnownVoice(voiceDefaults?.[lang])
      ? (voiceDefaults![lang] as VoiceId)
      : undefined;

  // If that preference is already a voice in the requested language, use it exactly.
  if (preferred && getVoiceLang(preferred) === lang) return preferred;

  // Otherwise map its persona into the requested language (or fall through to the
  // language's first voice / global default when there is no preference).
  return voiceForLanguage(lang, preferred ? personaOf(preferred) : undefined);
}
