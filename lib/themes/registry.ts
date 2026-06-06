/**
 * Theme registry — client-side token lookup.
 *
 * Wraps the bundled theme catalogue (`convex/data/themes/_index.ts`) so the
 * runtime (`ThemeContext`, `ProfileContext`) can resolve a slug → tokens
 * synchronously, with no DB round-trip and no flash. The JSON ships in the
 * client bundle, so this is a plain object lookup.
 *
 * This replaces the former hard-coded `THEME_TOKENS` object that lived inline in
 * `ThemeContext`. Per ADR-011 §2.3 the source of truth moved to JSON; only the
 * *address* of the lookup changed — resolution is still live by slug.
 *
 * Mirrors `lib/languages/registry.ts`.
 */

import { THEME_MODULES, type ThemeModule, type ThemeTokens } from "../../convex/data/themes/_index";

export type { ThemeModule, ThemeTokens } from "../../convex/data/themes/_index";

/** Every theme module in the catalogue (stable alphabetical order). */
export const THEME_MODULE_MAP: Record<string, ThemeModule> = THEME_MODULES;

/** Every known theme slug. */
export const THEME_SLUGS: readonly string[] = Object.keys(THEME_MODULES).sort();

/** The fallback slug when a stored slug is unknown. */
export const DEFAULT_THEME_SLUG = "default";

/** Resolve a slug to its full module, or `undefined` if unknown. */
export function getThemeModule(slug: string): ThemeModule | undefined {
  return THEME_MODULES[slug];
}

/** Resolve a slug to its token map, or `undefined` if unknown. */
export function getThemeTokens(slug: string): ThemeTokens | undefined {
  return THEME_MODULES[slug]?.tokens;
}

/** Whether a slug exists in the catalogue. */
export function isKnownThemeSlug(slug: string): boolean {
  return slug in THEME_MODULES;
}

// ─── Tier comparison (client-side picker gating) ────────────────────────────────

type Tier = "free" | "pro" | "max";
const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, max: 2 };

/**
 * Whether a user on `userTier` may select a theme requiring `requiredTier`.
 * Mirrors `themeTierSatisfied` in `convex/lib/themes.ts` (the server net).
 */
export function canAccessThemeTier(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}
