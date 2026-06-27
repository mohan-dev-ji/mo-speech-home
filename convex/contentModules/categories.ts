/**
 * Category content-module plugin (ADR-014 §1) — install + the three universal
 * admin functions, mirroring the pack lifecycle functions in `resourcePacks.ts`
 * but per-type and folder-aware. Content lives in
 * `convex/data/categories/<slug>.json`; runtime metadata in `categoryLifecycle`.
 */

import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import {
  requireCallerAccountId,
  requireCallerIsAdmin,
  resolveCallerAccountId,
} from "../lib/account";
import { userHasFullAccess } from "../lib/access";
import {
  getAllModules,
  getModuleBySlug,
} from "../lib/contentModules";
import {
  assertModuleInstallable,
  installContentModule,
  isCategoryModuleInstalled,
  isModuleVisible,
} from "../lib/contentModuleInstall";

const TIER = v.union(v.literal("free"), v.literal("pro"), v.literal("max"));

/**
 * Install a category module into the caller's account: creates one default
 * folder in the Categories tree and materialises its grids. Tier/visibility +
 * dedup gated, exactly like `loadResourcePackV2`.
 */
export const installCategoryModule = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId, user } = await requireCallerAccountId(ctx);

    const module = getModuleBySlug("categories", slug);
    if (!module) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `Category module "${slug}" not found in the JSON catalogue.`,
      });
    }

    const lifecycle = await ctx.db
      .query("categoryLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    assertModuleInstallable({
      slug,
      isStarter: module.isStarter ?? false,
      defaultTier: module.defaultTier,
      lifecycle,
      hasFullAccess: userHasFullAccess(user),
      now: Date.now(),
    });

    if (await isCategoryModuleInstalled(ctx, accountId, slug)) {
      throw new ConvexError({
        code: "ALREADY_INSTALLED",
        message: "This module is already installed into your account.",
      });
    }

    return await installContentModule(ctx, accountId, module);
  },
});

/**
 * Slugs of category modules the caller already has installed (one folder per
 * module). Drives the library tab's installed/uninstalled CTA state.
 */
export const getMyInstalledCategorySlugs = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    // Category modules install flat, so installed slugs come from the
    // categories' librarySourceId (no folder wrapper).
    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", resolved.accountId))
      .collect();
    return Array.from(
      new Set(
        cats.map((c) => c.librarySourceId).filter((s): s is string => !!s),
      ),
    );
  },
});

/**
 * Public catalogue for the library's Categories tab: every *visible* category
 * module (starter, or inside its publish window) joined with its lifecycle row.
 * Tier-gated modules are included (with a badge) — gating is enforced at install,
 * not at browse, mirroring `resourcePacks.getPublicLibraryCatalogueV2`.
 */
export const getPublicCategoryCatalogue = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("categoryLifecycle").collect();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const now = Date.now();
    return getAllModules("categories")
      .map((module) => {
        const lifecycle = bySlug.get(module.slug) ?? null;
        const isStarter = module.isStarter ?? false;
        if (!isModuleVisible({ isStarter, lifecycle, now })) return null;
        return {
          slug: module.slug,
          name: module.name,
          description: module.description ?? null,
          coverImagePath: module.coverImagePath ?? null,
          isStarter,
          featured: lifecycle?.featured ?? false,
          effectiveTier: (lifecycle?.tierOverride ?? module.defaultTier) as
            | "free"
            | "pro"
            | "max",
          counts: { categories: module.items.length },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

function deriveStatus(
  lifecycle: Doc<"categoryLifecycle"> | null,
  now: number
): "draft" | "scheduled" | "live" | "expired" {
  if (!lifecycle || lifecycle.publishedAt === undefined) return "draft";
  if (lifecycle.publishedAt > now) return "scheduled";
  if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now)
    return "expired";
  return "live";
}

/** Admin catalogue: every JSON category module joined with its lifecycle row. */
export const listAllCategoryModulesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const rows = await ctx.db.query("categoryLifecycle").collect();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const now = Date.now();
    return getAllModules("categories").map((module) => {
      const lifecycle = bySlug.get(module.slug) ?? null;
      return {
        slug: module.slug,
        name: module.name,
        description: module.description ?? null,
        coverImagePath: module.coverImagePath ?? null,
        defaultTier: module.defaultTier,
        isStarter: module.isStarter ?? false,
        provenance: module.provenance ?? null,
        lifecycleId: lifecycle?._id ?? null,
        publishedAt: lifecycle?.publishedAt ?? null,
        expiresAt: lifecycle?.expiresAt ?? null,
        featured: lifecycle?.featured ?? false,
        tierOverride: lifecycle?.tierOverride ?? null,
        tags: lifecycle?.tags ?? [],
        notes: lifecycle?.notes ?? null,
        updatedAt: lifecycle?.updatedAt ?? null,
        createdBy: lifecycle?.createdBy ?? null,
        status: deriveStatus(lifecycle, now),
        effectiveTier: (lifecycle?.tierOverride ?? module.defaultTier) as
          | "free"
          | "pro"
          | "max",
        counts: { categories: module.items.length },
      };
    });
  },
});

/** Create-or-update the lifecycle row for a category module (tri-state patch). */
export const updateCategoryLifecycle = mutation({
  args: {
    slug: v.string(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
    featured: v.optional(v.boolean()),
    tierOverride: v.optional(v.union(TIER, v.null())),
    tags: v.optional(v.union(v.array(v.string()), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);
    if (!getModuleBySlug("categories", args.slug)) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `No JSON category module for slug "${args.slug}".`,
      });
    }
    const existing = await ctx.db
      .query("categoryLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const now = Date.now();
    const patch: Partial<Doc<"categoryLifecycle">> & { updatedAt: number } = {
      updatedAt: now,
    };
    if (args.publishedAt !== undefined)
      patch.publishedAt = args.publishedAt ?? undefined;
    if (args.expiresAt !== undefined)
      patch.expiresAt = args.expiresAt ?? undefined;
    if (args.featured !== undefined) patch.featured = args.featured;
    if (args.tierOverride !== undefined)
      patch.tierOverride = args.tierOverride ?? undefined;
    if (args.tags !== undefined) {
      const normalised = (args.tags ?? [])
        .map((t) => t.toLowerCase().trim().replace(/\s+/g, "-"))
        .filter((t) => t.length > 0);
      patch.tags = Array.from(new Set(normalised));
    }
    if (args.notes !== undefined) patch.notes = args.notes ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { slug: args.slug, lifecycleId: existing._id };
    }
    const lifecycleId = await ctx.db.insert("categoryLifecycle", {
      slug: args.slug,
      featured: patch.featured ?? false,
      createdBy: clerkUserId,
      updatedAt: now,
      ...(patch.publishedAt !== undefined && { publishedAt: patch.publishedAt }),
      ...(patch.expiresAt !== undefined && { expiresAt: patch.expiresAt }),
      ...(patch.tierOverride !== undefined && {
        tierOverride: patch.tierOverride,
      }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
    });
    return { slug: args.slug, lifecycleId };
  },
});

/** Delete the lifecycle row (returns the module to draft). JSON is untouched. */
export const deleteCategoryLifecycle = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("categoryLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { slug };
  },
});
