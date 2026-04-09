import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

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
        name: { eng: 'Classic Blue', hin: 'क्लासिक नीला' },
        description: { eng: 'Navy and bright blue — the original Mo Speech palette.' },
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
        name: { eng: 'Soft Green', hin: 'नरम हरा' },
        description: { eng: 'Calm, nature-inspired greens.' },
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
        name: { eng: 'Warm Coral', hin: 'गर्म कोरल' },
        description: { eng: 'Friendly oranges and pinks.' },
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
        name: { eng: 'Deep Purple', hin: 'गहरा बैंगनी' },
        description: { eng: 'Rich purples and lilacs.' },
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
        name: { eng: 'Sunny Yellow', hin: 'धूप पीला' },
        description: { eng: 'Warm yellows and amber.' },
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
        name: { eng: 'Cool Grey', hin: 'ठंडा स्लेटी' },
        description: { eng: 'Neutral, minimal, highly accessible.' },
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
