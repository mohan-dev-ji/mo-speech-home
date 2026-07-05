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

    const module = await getModuleBySlug(ctx, "categories", slug);
    if (!module) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `Category module "${slug}" not found.`,
      });
    }

    assertModuleInstallable({
      slug,
      isStarter: module.isStarter ?? false,
      defaultTier: module.defaultTier,
      lifecycle:
        module.publishedAt === undefined
          ? null
          : {
              publishedAt: module.publishedAt,
              expiresAt: module.expiresAt,
              tierOverride: module.tierOverride,
            },
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
    const now = Date.now();
    const modules = await getAllModules(ctx, "categories");
    return modules
      .map((module) => {
        const isStarter = module.isStarter ?? false;
        if (
          !isModuleVisible({
            isStarter,
            lifecycle:
              module.publishedAt === undefined
                ? null
                : {
                    publishedAt: module.publishedAt,
                    expiresAt: module.expiresAt,
                  },
            now,
          })
        )
          return null;
        return {
          slug: module.slug,
          name: module.name,
          description: module.description ?? null,
          coverImagePath: module.coverImagePath ?? null,
          isStarter,
          isDefault: module.isDefault ?? false,
          featured: module.featured,
          effectiveTier: (module.tierOverride ?? module.defaultTier) as
            | "free"
            | "pro"
            | "max",
          // A category module is one folder; its meaningful size is the number
          // of symbols across its grids, not the (always-1) category count.
          counts: {
            symbols: module.items.reduce(
              (sum, cat) => sum + cat.symbols.length,
              0,
            ),
          },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

/**
 * Personal R2 keys (uploads, image-search picks, recordings) on every category
 * this module installed flat into the caller's account. Collected by the
 * uninstall route BEFORE `deleteCategoryModule` runs. Mirrors
 * `getCategoryReloadOrphanKeys` but spans all of the module's categories.
 */
export const getCategoryModuleDeleteOrphanKeys = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const { accountId } = resolved;
    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const keys: string[] = [];
    for (const cat of cats) {
      if (cat.librarySourceId !== slug) continue;
      const symbols = await ctx.db
        .query("profileSymbols")
        .withIndex("by_profile_category_id", (q) =>
          q.eq("profileCategoryId", cat._id)
        )
        .collect();
      for (const s of symbols) {
        if (
          s.imageSource.type === "userUpload" ||
          s.imageSource.type === "imageSearch"
        ) {
          keys.push(s.imageSource.imagePath);
        }
        const audioMap =
          (s.audio as Record<
            string,
            { type: string; path: string; alternates?: { recorded?: string } } | undefined
          >) ?? {};
        for (const a of Object.values(audioMap)) {
          if (!a) continue;
          if (a.type === "recorded") keys.push(a.path);
          if (a.alternates?.recorded && a.alternates.recorded !== a.path) {
            keys.push(a.alternates.recorded);
          }
        }
      }
    }
    return Array.from(new Set(keys));
  },
});

/**
 * Uninstall a category module (ADR-014 §5): delete every flat category the
 * module installed (matched by `librarySourceId`) plus its symbols. Touches
 * ONLY module-sourced categories — user-authored categories are never matched.
 * R2 orphans are deleted by the route afterwards.
 */
export const deleteCategoryModule = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    let categoriesDeleted = 0;
    let symbolsDeleted = 0;
    for (const cat of cats) {
      if (cat.librarySourceId !== slug) continue;
      const symbols = await ctx.db
        .query("profileSymbols")
        .withIndex("by_profile_category_id", (q) =>
          q.eq("profileCategoryId", cat._id)
        )
        .collect();
      for (const s of symbols) {
        await ctx.db.delete(s._id);
        symbolsDeleted++;
      }
      await ctx.db.delete(cat._id);
      categoriesDeleted++;
    }
    return { slug, categoriesDeleted, symbolsDeleted };
  },
});

function deriveStatus(
  lifecycle: { publishedAt?: number; expiresAt?: number } | null,
  now: number
): "draft" | "scheduled" | "live" | "expired" {
  if (!lifecycle || lifecycle.publishedAt === undefined) return "draft";
  if (lifecycle.publishedAt > now) return "scheduled";
  if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now)
    return "expired";
  return "live";
}

/** Admin catalogue: every category module row with its merged lifecycle. */
export const listAllCategoryModulesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const now = Date.now();
    const modules = await getAllModules(ctx, "categories");
    return modules.map((module) => {
      return {
        slug: module.slug,
        name: module.name,
        description: module.description ?? null,
        coverImagePath: module.coverImagePath ?? null,
        defaultTier: module.defaultTier,
        isStarter: module.isStarter ?? false,
        provenance: module.provenance ?? null,
        lifecycleId: module._id,
        publishedAt: module.publishedAt ?? null,
        expiresAt: module.expiresAt ?? null,
        featured: module.featured,
        tierOverride: module.tierOverride ?? null,
        tags: module.tags ?? [],
        notes: module.notes ?? null,
        updatedAt: module.updatedAt,
        createdBy: module.createdBy,
        status: deriveStatus(module, now),
        effectiveTier: (module.tierOverride ?? module.defaultTier) as
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
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) =>
        q.eq("tree", "categories").eq("slug", args.slug)
      )
      .unique();
    if (!row) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `No category module for slug "${args.slug}".`,
      });
    }
    const now = Date.now();
    const patch: Partial<Doc<"libraryModules">> & { updatedAt: number } = {
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

    await ctx.db.patch(row._id, patch);
    return { slug: args.slug, lifecycleId: row._id };
  },
});

/** Unpublish a category module (returns it to draft). Content row is kept. */
export const deleteCategoryLifecycle = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) =>
        q.eq("tree", "categories").eq("slug", slug)
      )
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        publishedAt: undefined,
        expiresAt: undefined,
        tierOverride: undefined,
        tags: undefined,
        notes: undefined,
        featured: false,
        updatedAt: Date.now(),
      });
    }
    return { slug };
  },
});
