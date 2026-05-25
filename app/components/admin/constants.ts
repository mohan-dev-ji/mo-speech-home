/**
 * Admin-only constants.
 *
 * The admin UI is English only (per docs/1-inbox/ideas/17-admin-dashboard.md
 * §"Language Handling"). These strings are never piped through
 * `useTranslations` — they live here as plain literals.
 */

/**
 * Predefined reasons surfaced in the "Grant custom access" modal. Mirrors
 * the MVP's eight reasons so the audit trail across the two systems reads
 * the same. "Other" is a free-text fallback — when selected, the modal
 * requires the notes field to be filled.
 *
 * Source: MVP `mo-speech-mvp-2.0/lib/constants.js`. See plan
 * ~/.claude/plans/i-just-completed-this-ancient-floyd.md §3.3.
 */
export const CUSTOM_ACCESS_REASONS = [
  "Compassionate access",
  "Partner / school trial",
  "Support compensation",
  "Beta tester",
  "Family or friend",
  "Press / demo",
  "Affiliate gift",
  "Other",
] as const;

export type CustomAccessReason = (typeof CUSTOM_ACCESS_REASONS)[number];

/**
 * Pack lifecycle statuses derived in `listAllPacksForAdmin`. Listed here so
 * UI components can re-import the union without leaking server types.
 */
export type PackLifecycleStatus = "draft" | "scheduled" | "live" | "expired";

/**
 * Language publish statuses — same publish-window axis as packs. Mirrors
 * `derivePublishStatus` in `convex/languages.ts`.
 */
export type LanguagePublishStatus = "draft" | "scheduled" | "live" | "expired";

/**
 * Language translation statuses per ADR-009 §3. Drives the "promote"
 * action — `machine-translated → beta → stable`. Independent of the
 * publish status (a language can be `beta` but `scheduled` to go live
 * next week).
 */
export type LanguageTranslationStatus =
  | "machine-translated"
  | "beta"
  | "stable";
