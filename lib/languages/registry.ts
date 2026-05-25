/**
 * Language registry — single source of truth for language metadata at build time.
 *
 * Assembled from JSON modules in `convex/data/languages/`. Per ADR-009 §1 and
 * ADR-011 §3, every surface that needs to enumerate, branch on, or display a
 * language reads from this registry — never hard-code `if (lang === 'en')`.
 *
 * **Static vs runtime split:**
 *
 * This file exposes *static* metadata only (labels, dir, font, voices). Runtime
 * visibility — whether a language is hidden, in beta, or fully stable — lives
 * on the `languageLifecycle` Convex table and is read via Convex queries.
 *
 * `LOCALES` is the full set of routable locales (regardless of lifecycle status)
 * so that deep-linked URLs like `/pa/library` always resolve. Visibility
 * filtering only affects pickers — see the `getVisibleLanguages` query
 * (Convex, Phase 8.1).
 *
 * Adding a language post-launch = registry entry (drop a JSON, import in
 * `convex/data/languages/_index.ts`) + `languageLifecycle` row. No code edits
 * elsewhere. Search index registration for the new language is a separate
 * follow-up (ADR-009 §6.6) but the registry already exposes the code.
 */

import { LANGUAGE_MODULES } from "../../convex/data/languages/_index";
import type { LangModule } from "../../convex/data/languages/types";

export type { LangModule, LangStatus, VoiceEntry } from "../../convex/data/languages/types";

/** Full static language registry — all modules from `convex/data/languages/`. */
export const LANGUAGES: readonly LangModule[] = LANGUAGE_MODULES;

/** ISO 639-1 codes for every language module — drives `i18n/routing.ts`. */
export const LOCALES: readonly string[] = LANGUAGES.map((l) => l.code);

/**
 * The canonical default locale. Display fallback chain
 * (`lib/languages/displayValue.ts`) uses this as tier 2 when the current
 * locale lacks a translation.
 */
export const DEFAULT_LOCALE = "en";

/** Lookup a language module by ISO code. Returns undefined for unknown codes. */
export function getLanguage(code: string): LangModule | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/**
 * Type guard for "is this string a known locale". Useful before passing
 * a value into next-intl's `routing.locales` or as a route param.
 */
export function isKnownLocale(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code);
}
