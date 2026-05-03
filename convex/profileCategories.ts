import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import {
  loadStarterTemplateInline,
  removeCategoryFromPack,
  syncCategoryToPackIfPublished,
} from "./resourcePacks";

// ─── Internal: seed ───────────────────────────────────────────────────────────

/**
 * Seed the default categories + symbols onto an account.
 * Account-scoped: idempotent against re-runs — skips if the account already has any categories.
 *
 * Phase 6 foundation: this delegates to loadStarterTemplate, which materialises
 * the canonical starter resourcePack (created by migrations.materialiseStarterPack)
 * into the account. The DEFAULT_CATEGORIES module is no longer load-bearing at
 * runtime — it's only used by materialiseStarterPack to build/refresh the starter
 * pack. See convex/resourcePacks.ts and ADR-008.
 *
 * Pre-condition: migrations.materialiseStarterPack must have been run on this
 * deployment. If it hasn't, loadStarterTemplate logs a warning and returns;
 * the new account ends up with zero categories until the starter is materialised.
 */
export const seedDefaultAccount = internalMutation({
  args: {
    accountId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", args.accountId))
      .first();
    if (existing) {
      console.log(
        `[seedDefaultAccount] account ${args.accountId} already has categories — skipping`
      );
      return;
    }

    await loadStarterTemplateInline(ctx, args.accountId);
  },
});

// ─── Dev helpers ─────────────────────────────────────────────────────────────

/**
 * Re-seed default categories for an account.
 * Wipes any existing profileCategories + profileSymbols on the account first.
 * Dev/admin use only.
 */
export const reseedAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const existingSymbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const s of existingSymbols) await ctx.db.delete(s._id);

    const existingCats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const c of existingCats) await ctx.db.delete(c._id);

    await ctx.scheduler.runAfter(
      0,
      internal.profileCategories.seedDefaultAccount,
      { accountId }
    );

    return {
      deleted: { categories: existingCats.length, symbols: existingSymbols.length },
    };
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getProfileCategory = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.profileCategoryId);
  },
});

/**
 * Return all categories for the caller's account in display order.
 */
export const getProfileCategories = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    return ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", resolved.accountId))
      .order("asc")
      .collect();
  },
});

export const getProfileSymbols = query({
  args: {
    profileCategoryId: v.id("profileCategories"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .order("asc")
      .collect();
  },
});

export const getProfileSymbolsWithImages = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .order("asc")
      .collect();

    return Promise.all(
      rows.map(async (ps) => {
        let imagePath: string | undefined;
        let audioEng: string | undefined;
        let audioHin: string | undefined;

        if (ps.imageSource.type === "symbolstix") {
          const sym = await ctx.db.get(ps.imageSource.symbolId);
          if (sym) {
            imagePath = sym.imagePath;
            audioEng = ps.audio?.eng?.path ?? sym.audio.eng.default;
            audioHin = ps.audio?.hin?.path ?? sym.audio.hin?.default;
          }
        } else {
          const src = ps.imageSource as { imagePath: string };
          imagePath = src.imagePath;
          audioEng = ps.audio?.eng?.path;
          audioHin = ps.audio?.hin?.path;
        }

        return {
          _id: ps._id,
          profileCategoryId: ps.profileCategoryId,
          order: ps.order,
          label: ps.label,
          display: ps.display,
          imagePath,
          audioEng,
          audioHin,
        };
      })
    );
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Persist a new order for the categories on the caller's account.
 */
export const reorderCategories = mutation({
  args: {
    orderedIds: v.array(v.id("profileCategories")),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const cat = await ctx.db.get(args.orderedIds[i]);
      if (!cat || cat.accountId !== accountId)
        throw new Error("Category not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }

    // Auto-sync: rebuild any published categories' snapshots so reorder
    // reflects in the pack. Most categories aren't published — fast no-op.
    for (const id of args.orderedIds) {
      await syncCategoryToPackIfPublished(ctx, id);
    }
  },
});

export const updateCategoryMeta = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    colour: v.optional(v.string()),
    imagePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const cat = await ctx.db.get(args.profileCategoryId);
    if (!cat) throw new Error("Category not found");
    if (cat.accountId !== accountId) throw new Error("Not authorised");

    await ctx.db.patch(args.profileCategoryId, {
      ...(args.colour !== undefined && { colour: args.colour }),
      ...(args.imagePath !== undefined && { imagePath: args.imagePath }),
      updatedAt: Date.now(),
    });

    // Auto-sync: if this category is published to a pack, rebuild the snapshot.
    await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);

    return args.profileCategoryId;
  },
});

export const deleteCategory = mutation({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const cat = await ctx.db.get(args.profileCategoryId);
    if (!cat) throw new Error("Category not found");
    if (cat.accountId !== accountId) throw new Error("Not authorised");

    // Auto-sync: if this category is published, remove the entry from the pack
    // (and delete the pack if it becomes empty + non-starter). Done before the
    // actual delete so the helper can still read the row.
    await removeCategoryFromPack(ctx, args.profileCategoryId);

    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .collect();

    for (const sym of symbols) await ctx.db.delete(sym._id);

    await ctx.db.delete(args.profileCategoryId);
  },
});
