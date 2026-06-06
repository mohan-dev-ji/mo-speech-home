import { mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { requireCallerIsAdmin } from './lib/account';
import {
  getAllThemes,
  getThemeBySlug as getThemeModuleBySlug,
  effectiveThemeTier,
  isThemeVisible,
} from './lib/themes';

// ─── Queries ──────────────────────────────────────────────────────────────────

export const listThemes = query({
  args: {
    tier: v.optional(v.union(v.literal('free'), v.literal('premium'))),
  },
  handler: async (ctx, { tier }) => {
    if (tier) {
      return ctx.db
        .query('themes')
        .withIndex('by_tier', (q) => q.eq('tier', tier))
        .collect();
    }
    return ctx.db.query('themes').collect();
  },
});

export const getThemeBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db
      .query('themes')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first();
  },
});

export const getThemeById = query({
  args: { themeId: v.id('themes') },
  handler: async (ctx, { themeId }) => {
    return ctx.db.get(themeId);
  },
});

// ─── Seed ─────────────────────────────────────────────────────────────────────
// Idempotent — checks by slug before inserting. Call from admin dashboard or
// dev setup. All token values are placeholder hex — you bring the final values.

export const seedStarterThemes = mutation({
  args: {
    adminClerkUserId: v.string(),
  },
  handler: async (ctx, { adminClerkUserId }) => {
    const now = Date.now();

    const starterThemes = [
      {
        slug: 'classic-blue',
        name: { en: 'Classic Blue', hi: 'क्लासिक नीला' },
        description: { en: 'Navy and bright blue — the original Mo Speech palette.' },
        previewColour: '#3b82f6',
        tokens: {
          bgPrimary:       '#f8fafc',
          bgSurface:       '#ffffff',
          bgSurfaceAlt:    '#3d4e5f',
          brandPrimary:    '#3b82f6',
          brandSecondary:  '#60a5fa',
          brandTertiary:   '#bfdbfe',
          textPrimary:     '#0f172a',
          textSecondary:   '#64748b',
          textOnBrand:     '#ffffff',
          symbolCardBg:    '#ffffff',
          symbolCardText:  '#0f172a',
          symbolCardBorder:'1px solid #e2e8f0',
          symbolCardGlow:  'none',
          talkerBg:        '#1e293b',
          talkerText:      '#f8fafc',
          talkerBorder:    '1px solid #334155',
          navBg:           '#5a6878',
          navText:         '#ffffff',
          navTextActive:   '#ffffff',
          navIndicator:    '#3b82f6',
          success:         '#22c55e',
          warning:         '#f59e0b',
          error:           '#ef4444',
          overlay:         '#000000',
        },
      },
      {
        slug: 'soft-green',
        name: { en: 'Soft Green', hi: 'नरम हरा' },
        description: { en: 'Calm, nature-inspired greens.' },
        previewColour: '#22c55e',
        tokens: {
          bgPrimary:       '#f0fdf4',
          bgSurface:       '#ffffff',
          bgSurfaceAlt:    '#166534',
          brandPrimary:    '#22c55e',
          brandSecondary:  '#4ade80',
          brandTertiary:   '#bbf7d0',
          textPrimary:     '#052e16',
          textSecondary:   '#166534',
          textOnBrand:     '#ffffff',
          symbolCardBg:    '#ffffff',
          symbolCardText:  '#052e16',
          symbolCardBorder:'1px solid #dcfce7',
          symbolCardGlow:  'none',
          talkerBg:        '#14532d',
          talkerText:      '#f0fdf4',
          talkerBorder:    '1px solid #166534',
          navBg:           '#16a34a',
          navText:         '#ffffff',
          navTextActive:   '#ffffff',
          navIndicator:    '#4ade80',
          success:         '#22c55e',
          warning:         '#f59e0b',
          error:           '#ef4444',
          overlay:         '#000000',
        },
      },
      {
        slug: 'warm-coral',
        name: { en: 'Warm Coral', hi: 'गर्म कोरल' },
        description: { en: 'Friendly oranges and pinks.' },
        previewColour: '#f97316',
        tokens: {
          bgPrimary:       '#fff7ed',
          bgSurface:       '#ffffff',
          bgSurfaceAlt:    '#7c2d12',
          brandPrimary:    '#f97316',
          brandSecondary:  '#fb923c',
          brandTertiary:   '#fed7aa',
          textPrimary:     '#431407',
          textSecondary:   '#9a3412',
          textOnBrand:     '#ffffff',
          symbolCardBg:    '#ffffff',
          symbolCardText:  '#431407',
          symbolCardBorder:'1px solid #ffedd5',
          symbolCardGlow:  'none',
          talkerBg:        '#7c2d12',
          talkerText:      '#fff7ed',
          talkerBorder:    '1px solid #9a3412',
          navBg:           '#ea580c',
          navText:         '#ffffff',
          navTextActive:   '#ffffff',
          navIndicator:    '#fb923c',
          success:         '#22c55e',
          warning:         '#f59e0b',
          error:           '#ef4444',
          overlay:         '#000000',
        },
      },
      {
        slug: 'deep-purple',
        name: { en: 'Deep Purple', hi: 'गहरा बैंगनी' },
        description: { en: 'Rich purples and lilacs.' },
        previewColour: '#8b5cf6',
        tokens: {
          bgPrimary:       '#faf5ff',
          bgSurface:       '#ffffff',
          bgSurfaceAlt:    '#4c1d95',
          brandPrimary:    '#8b5cf6',
          brandSecondary:  '#a78bfa',
          brandTertiary:   '#ede9fe',
          textPrimary:     '#2e1065',
          textSecondary:   '#6d28d9',
          textOnBrand:     '#ffffff',
          symbolCardBg:    '#ffffff',
          symbolCardText:  '#2e1065',
          symbolCardBorder:'1px solid #ede9fe',
          symbolCardGlow:  'none',
          talkerBg:        '#4c1d95',
          talkerText:      '#faf5ff',
          talkerBorder:    '1px solid #6d28d9',
          navBg:           '#7c3aed',
          navText:         '#ffffff',
          navTextActive:   '#ffffff',
          navIndicator:    '#a78bfa',
          success:         '#22c55e',
          warning:         '#f59e0b',
          error:           '#ef4444',
          overlay:         '#000000',
        },
      },
      {
        slug: 'sunny-yellow',
        name: { en: 'Sunny Yellow', hi: 'धूप पीला' },
        description: { en: 'Warm yellows and amber.' },
        previewColour: '#eab308',
        tokens: {
          bgPrimary:       '#fefce8',
          bgSurface:       '#ffffff',
          bgSurfaceAlt:    '#713f12',
          brandPrimary:    '#eab308',
          brandSecondary:  '#facc15',
          brandTertiary:   '#fef08a',
          textPrimary:     '#422006',
          textSecondary:   '#92400e',
          textOnBrand:     '#422006',
          symbolCardBg:    '#ffffff',
          symbolCardText:  '#422006',
          symbolCardBorder:'1px solid #fef9c3',
          symbolCardGlow:  'none',
          talkerBg:        '#713f12',
          talkerText:      '#fefce8',
          talkerBorder:    '1px solid #92400e',
          navBg:           '#ca8a04',
          navText:         '#422006',
          navTextActive:   '#422006',
          navIndicator:    '#facc15',
          success:         '#22c55e',
          warning:         '#f59e0b',
          error:           '#ef4444',
          overlay:         '#000000',
        },
      },
      {
        slug: 'cool-grey',
        name: { en: 'Cool Grey', hi: 'ठंडा स्लेटी' },
        description: { en: 'Neutral, minimal, highly accessible.' },
        previewColour: '#6b7280',
        tokens: {
          bgPrimary:       '#f9fafb',
          bgSurface:       '#ffffff',
          bgSurfaceAlt:    '#1f2937',
          brandPrimary:    '#6b7280',
          brandSecondary:  '#9ca3af',
          brandTertiary:   '#e5e7eb',
          textPrimary:     '#111827',
          textSecondary:   '#6b7280',
          textOnBrand:     '#ffffff',
          symbolCardBg:    '#ffffff',
          symbolCardText:  '#111827',
          symbolCardBorder:'1px solid #e5e7eb',
          symbolCardGlow:  'none',
          talkerBg:        '#1f2937',
          talkerText:      '#f9fafb',
          talkerBorder:    '1px solid #374151',
          navBg:           '#4b5563',
          navText:         '#ffffff',
          navTextActive:   '#ffffff',
          navIndicator:    '#9ca3af',
          success:         '#22c55e',
          warning:         '#f59e0b',
          error:           '#ef4444',
          overlay:         '#000000',
        },
      },
    ] as const;

    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const theme of starterThemes) {
      const existing = await ctx.db
        .query('themes')
        .withIndex('by_slug', (q) => q.eq('slug', theme.slug))
        .first();

      if (existing) {
        skipped.push(theme.slug);
        continue;
      }

      await ctx.db.insert('themes', {
        ...theme,
        tier: 'free',
        featured: theme.slug === 'classic-blue',
        createdBy: adminClerkUserId,
        updatedAt: now,
      });
      inserted.push(theme.slug);
    }

    return { inserted, skipped };
  },
});

// ════════════════════════════════════════════════════════════════════════════
// Theme plugin (ADR-011 §2) — JSON catalogue + themeLifecycle overlay.
//
// NOTE: everything ABOVE this banner operates on the legacy `themes` table and
// is dead at runtime (wrong token shape, unread by any UI). It is kept inert
// for deferred cleanup per ADR-011 §2.5. New code uses the functions BELOW,
// which read theme token values from `convex/data/themes/*.json` and merge with
// the `themeLifecycle` table. Mirrors the resource-pack functions.
// ════════════════════════════════════════════════════════════════════════════

type ThemeLifecycleStatus = "draft" | "scheduled" | "live" | "expired";

function deriveThemeStatus(
  lifecycle: Doc<"themeLifecycle"> | null,
  now: number
): ThemeLifecycleStatus {
  if (!lifecycle || lifecycle.publishedAt == null) return "draft";
  if (lifecycle.publishedAt > now) return "scheduled";
  if (lifecycle.expiresAt != null && lifecycle.expiresAt <= now) return "expired";
  return "live";
}

const THEME_TIER_VALIDATOR = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("max")
);

/**
 * Public theme catalogue for the picker. Returns every *visible* theme —
 * builtin themes always, plus any theme with a `themeLifecycle` row inside its
 * publish window (`isThemeVisible`). Tokens are intentionally omitted (the
 * client resolves them by slug from the bundled registry); this returns only
 * what the picker needs to render a swatch + decide gating.
 *
 * Mirrors `resourcePacks.getPublicLibraryCatalogueV2`.
 */
export const getPublicThemeCatalogue = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const lifecycleRows = await ctx.db.query("themeLifecycle").collect();
    const lifecycleBySlug = new Map(lifecycleRows.map((r) => [r.slug, r]));

    return getAllThemes()
      .map((theme) => {
        const lifecycle = lifecycleBySlug.get(theme.slug) ?? null;
        if (!isThemeVisible(theme, lifecycle, now)) return null;
        return {
          slug: theme.slug,
          name: theme.name,
          description: theme.description ?? null,
          previewColour: theme.previewColour,
          coverImagePath: theme.coverImagePath ?? null,
          type: theme.type,
          featured: lifecycle?.featured ?? false,
          effectiveTier: effectiveThemeTier(theme, lifecycle),
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  },
});

/**
 * Admin catalogue. Every theme from the bundled JSON joined with its lifecycle
 * row (when present), regardless of publish window — drafts and expired included.
 * Mirrors `resourcePacks.listAllPacksForAdmin`.
 */
export const listAllThemesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const lifecycleRows = await ctx.db.query("themeLifecycle").collect();
    const lifecycleBySlug = new Map(lifecycleRows.map((r) => [r.slug, r]));
    const now = Date.now();
    return getAllThemes().map((theme) => {
      const lifecycle = lifecycleBySlug.get(theme.slug) ?? null;
      return {
        slug: theme.slug,
        name: theme.name,
        description: theme.description ?? null,
        previewColour: theme.previewColour,
        coverImagePath: theme.coverImagePath ?? null,
        type: theme.type,
        defaultTier: theme.defaultTier,
        builtin: theme.builtin ?? false,
        lifecycleId: lifecycle?._id ?? null,
        publishedAt: lifecycle?.publishedAt ?? null,
        expiresAt: lifecycle?.expiresAt ?? null,
        featured: lifecycle?.featured ?? false,
        tierOverride: lifecycle?.tierOverride ?? null,
        notes: lifecycle?.notes ?? null,
        updatedAt: lifecycle?.updatedAt ?? null,
        createdBy: lifecycle?.createdBy ?? null,
        status: deriveThemeStatus(lifecycle, now),
        effectiveTier: effectiveThemeTier(theme, lifecycle),
      };
    });
  },
});

/**
 * Create or update a theme's lifecycle row. Tri-state inputs:
 * `undefined` = leave alone, `null` = clear, value = set. Inserts a row on
 * first publish. Refuses slugs not in the bundled JSON catalogue.
 * Mirrors `resourcePacks.updatePackLifecycle`.
 */
export const updateThemeLifecycle = mutation({
  args: {
    slug: v.string(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
    featured: v.optional(v.boolean()),
    tierOverride: v.optional(v.union(THEME_TIER_VALIDATOR, v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);

    if (!getThemeModuleBySlug(args.slug)) {
      throw new ConvexError({
        code: "THEME_NOT_FOUND",
        message: `No JSON theme found for slug "${args.slug}".`,
      });
    }

    const existing = await ctx.db
      .query("themeLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    const now = Date.now();
    const patch: Partial<Doc<"themeLifecycle">> & { updatedAt: number } = {
      updatedAt: now,
    };
    if (args.publishedAt !== undefined) patch.publishedAt = args.publishedAt ?? undefined;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt ?? undefined;
    if (args.featured !== undefined) patch.featured = args.featured;
    if (args.tierOverride !== undefined) patch.tierOverride = args.tierOverride ?? undefined;
    if (args.notes !== undefined) patch.notes = args.notes ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { slug: args.slug, lifecycleId: existing._id };
    }

    const lifecycleId = await ctx.db.insert("themeLifecycle", {
      slug: args.slug,
      featured: patch.featured ?? false,
      createdBy: clerkUserId,
      updatedAt: now,
      ...(patch.publishedAt !== undefined && { publishedAt: patch.publishedAt }),
      ...(patch.expiresAt !== undefined && { expiresAt: patch.expiresAt }),
      ...(patch.tierOverride !== undefined && { tierOverride: patch.tierOverride }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
    });
    return { slug: args.slug, lifecycleId };
  },
});

/**
 * Delete a themeLifecycle row, returning the slug to draft state. The JSON
 * theme file is NOT touched. Builtin themes stay visible (always-on); other
 * themes disappear from pickers until republished. No-op if no row exists.
 * Mirrors `resourcePacks.deletePackLifecycle`.
 */
export const deleteThemeLifecycle = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("themeLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (row) {
      await ctx.db.delete(row._id);
    }
    return { slug };
  },
});
