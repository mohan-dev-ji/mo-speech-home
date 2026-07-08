/**
 * Canonical 3-tier fallback for localised field values.
 *
 * All bilingual fields in the schema are ISO-keyed open records per ADR-009 §2
 * (e.g. `{ en: "dog", hi: "कुत्ता", pa: "ਕੁੱਤਾ" }`). At display time the chain is:
 *
 *   value[currentLang] ?? value[defaultLang] ?? Object.values(value)[0] ?? undefined
 *
 * Generic over the value type so it works for strings (`words`, `name`, `label`),
 * arrays (`synonyms`), and any future record-shaped field.
 *
 * Callers typically import `defaultLocale` from `lib/languages/registry.ts`
 * and pass it explicitly. If omitted, the tier-2 fallback is skipped — useful
 * when you only want exact-locale matches.
 *
 * Returns `undefined` when:
 *   - the input record itself is undefined
 *   - the record is empty (`{}`) — no keys to fall through to
 *
 * Callers must handle `undefined` (typically render a placeholder or an
 * "untranslated" indicator per ADR-009 §6).
 *
 * @example
 * const label = displayValue(symbol.words, currentLang, 'en');
 * const synonyms = displayValue(symbol.synonyms, currentLang, 'en') ?? [];
 */
export function displayValue<T>(
  value: Record<string, T> | undefined,
  currentLang: string,
  defaultLang?: string,
): T | undefined {
  if (!value) return undefined;

  // Tier 1: exact match on the current locale.
  if (currentLang in value) return value[currentLang];

  // Tier 2: fall back to the project's default locale (typically 'en').
  if (defaultLang && defaultLang in value) return value[defaultLang];

  // Tier 3: first available value in iteration order. Object.values()
  // follows insertion order for string keys, which is deterministic enough
  // for display purposes.
  const first = Object.values(value)[0];
  return first;
}

/**
 * Which locale key `displayValue` actually resolves to for the same inputs —
 * tier 1 (currentLang), tier 2 (defaultLang), or tier 3 (first key), or
 * undefined when the record is empty/absent.
 *
 * Phase 15 (3e): "voice follows the resolved TEXT's language". A caller resolves
 * a label with `displayString(...)` for display, and uses `resolvedLocale(...)`
 * with the SAME args to pick a TTS voice for the language actually shown — so an
 * English string shown on a Hindi board is spoken by an English voice, not a
 * Hindi one. Keep the two calls in lockstep (same value/currentLang/defaultLang).
 */
export function resolvedLocale(
  value: Record<string, unknown> | undefined,
  currentLang: string,
  defaultLang?: string,
): string | undefined {
  if (!value) return undefined;
  if (currentLang in value) return currentLang;
  if (defaultLang && defaultLang in value) return defaultLang;
  return Object.keys(value)[0];
}

/**
 * Convenience wrapper for the common "render a string label" case.
 * Returns the empty string when no translation is available, so JSX
 * doesn't render `undefined`. Use the bare `displayValue` if you need
 * to distinguish "no translation" from "empty string".
 */
export function displayString(
  value: Record<string, string> | undefined,
  currentLang: string,
  defaultLang?: string,
): string {
  return displayValue(value, currentLang, defaultLang) ?? "";
}
