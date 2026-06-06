/**
 * Theme catalogue readers — the canonical access point for theme content.
 *
 * All reads of theme definitions (catalogue listing, token resolution) go
 * through these helpers. They consume the bundled JSON map in
 * `convex/data/themes/_index.ts`; no Convex DB reads. Per ADR-011 §2, JSON is
 * the source of truth for theme token values.
 *
 * Visibility is decided separately by merging with the `themeLifecycle` overlay
 * (see `convex/themes.ts:getPublicThemeCatalogue`): a theme is visible iff it's
 * `builtin` OR a lifecycle row exists within its publish window.
 *
 * Mirrors `convex/lib/libraryPacks.ts`.
 */

import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { effectiveUserTier } from "./access";
import { THEME_MODULES, type ThemeModule, type ThemeTier } from "../data/themes/_index";

/** Minimal shape of a `themeLifecycle` row needed by the pure helpers below. */
type ThemeLifecycleLike = {
  publishedAt?: number;
  expiresAt?: number;
  tierOverride?: ThemeTier;
} | null;

/** Tier ordering for "does the user's tier satisfy the requirement?" checks. */
const TIER_RANK: Record<ThemeTier, number> = { free: 0, pro: 1, max: 2 };

/** True if `userTier` meets or exceeds `requiredTier`. */
export function themeTierSatisfied(
  userTier: ThemeTier,
  requiredTier: ThemeTier
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/**
 * The tier required to use a theme: the lifecycle override if set, else the
 * module's `defaultTier`.
 */
export function effectiveThemeTier(
  theme: ThemeModule,
  lifecycle: ThemeLifecycleLike
): ThemeTier {
  return lifecycle?.tierOverride ?? theme.defaultTier;
}

/**
 * Whether a theme is visible in pickers. Builtin themes are always visible; any
 * other theme needs a lifecycle row inside its publish window
 * (`publishedAt <= now` and `expiresAt` unset/future). Mirrors the pack rule in
 * `getPublicLibraryCatalogueV2`.
 */
export function isThemeVisible(
  theme: ThemeModule,
  lifecycle: ThemeLifecycleLike,
  now: number
): boolean {
  if (theme.builtin) return true;
  if (!lifecycle) return false;
  if (lifecycle.publishedAt === undefined || lifecycle.publishedAt > now) {
    return false;
  }
  if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now) {
    return false;
  }
  return true;
}

/**
 * Guard a theme selection (instructor or student profile). Throws if the slug
 * is unknown, not currently visible, or above the caller's tier. Call from the
 * mutations that write `themeSlug` (`users.setMyThemeSlug`,
 * `studentProfiles.updateStudentProfile`). The client hides gated themes, so
 * this is the backend net for direct/stale calls.
 */
export async function assertThemeSelectable(
  ctx: QueryCtx,
  slug: string,
  user: Doc<"users">
): Promise<void> {
  const theme = getThemeBySlug(slug);
  if (!theme) {
    throw new ConvexError({
      code: "THEME_NOT_FOUND",
      message: `Unknown theme "${slug}".`,
    });
  }

  const lifecycle = await ctx.db
    .query("themeLifecycle")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();

  const now = Date.now();
  if (!isThemeVisible(theme, lifecycle, now)) {
    throw new ConvexError({
      code: "THEME_NOT_AVAILABLE",
      message: `Theme "${slug}" is not published.`,
    });
  }

  const required = effectiveThemeTier(theme, lifecycle);
  if (!themeTierSatisfied(effectiveUserTier(user), required)) {
    throw new ConvexError({
      code: "TIER_REQUIRED",
      required,
      message: `Theme "${slug}" requires the ${required} plan.`,
    });
  }
}

/**
 * Look up a theme by slug. Returns `null` if no JSON file exists for the slug.
 */
export function getThemeBySlug(slug: string): ThemeModule | null {
  return THEME_MODULES[slug] ?? null;
}

/**
 * Every slug in the catalogue, in stable alphabetical order. Use this when
 * merging with `themeLifecycle` rows to assemble the public catalogue.
 */
export function getAllThemeSlugs(): string[] {
  return Object.keys(THEME_MODULES).sort();
}

/**
 * Every theme in the catalogue. Order matches `getAllThemeSlugs`.
 */
export function getAllThemes(): ThemeModule[] {
  return getAllThemeSlugs().map((slug) => THEME_MODULES[slug]);
}
