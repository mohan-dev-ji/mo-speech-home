import { resolvedLocale } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";
import { personaOf, voiceForLanguage } from "@/lib/audio/resolveVoiceId";

/**
 * The single rule: the voice follows the language the text resolved to.
 *
 * Given the locale a text actually resolved to (via `resolvedLocale`) and the
 * active board voice, return a persona-matched voice IN that locale's language.
 * When `locale` is undefined (no per-language record, or an empty one), the
 * active voice is returned unchanged — there is nothing to remap.
 *
 * This is the chokepoint every composed-content play path funnels through, so a
 * cross-language (text-language ≠ voice-language) clip can never be synthesised
 * or cached again. See ADR-018.
 */
export function voiceForResolvedLocale(
  locale: string | undefined,
  activeVoiceId: string,
): string {
  return locale ? voiceForLanguage(locale, personaOf(activeVoiceId)) : activeVoiceId;
}

/**
 * Record-based convenience wrapper: resolve which locale a localized text record
 * falls back to on the active board, then map it to a persona-matched voice.
 *
 * Untranslated content → the authored ("made-in") language's voice: a record
 * authored only in English, viewed on a Hindi board, resolves to `en` and speaks
 * in an English voice matching the board voice's persona — never English words in
 * a Hindi accent. Returns both the resolved `locale` (for callers that also need
 * it) and the `voiceId` to speak with.
 */
export function resolveSpokenVoice(
  record: Record<string, string> | undefined,
  activeLang: string,
  activeVoiceId: string,
): { locale?: string; voiceId: string } {
  const locale = record ? resolvedLocale(record, activeLang, DEFAULT_LOCALE) : undefined;
  return { locale, voiceId: voiceForResolvedLocale(locale, activeVoiceId) };
}
