import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { DEFAULT_CATEGORIES } from "./data/defaultCategorySymbols";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import type { Id } from "./_generated/dataModel";

// ─── Internal: seed ───────────────────────────────────────────────────────────

/**
 * Seed the default categories + symbols onto an account.
 * Account-scoped: idempotent against re-runs — skips if the account already has any categories.
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

    const now = Date.now();

    for (let catIndex = 0; catIndex < DEFAULT_CATEGORIES.length; catIndex++) {
      const cat = DEFAULT_CATEGORIES[catIndex];

      let folderImagePath: string | undefined;
      if (cat.folderWord) {
        const folderSym = await ctx.db
          .query("symbols")
          .withIndex("by_words_eng", (q) => q.eq("words.eng", cat.folderWord!))
          .first();
        if (folderSym) folderImagePath = folderSym.imagePath;
      }

      const profileCategoryId = await ctx.db.insert("profileCategories", {
        accountId: args.accountId,
        name: cat.name,
        icon: cat.icon,
        colour: cat.colour,
        ...(folderImagePath ? { imagePath: folderImagePath } : {}),
        order: catIndex,
        updatedAt: now,
      });

      let symbolOrder = 0;
      let matched = 0;
      let skipped = 0;

      for (const word of cat.words) {
        const candidates = await ctx.db
          .query("symbols")
          .withIndex("by_words_eng", (q) => q.eq("words.eng", word))
          .take(3);

        const wordLower = word.toLowerCase();
        const match =
          candidates.find(
            (s) =>
              s.words.eng.toLowerCase() === wordLower &&
              s.categories.some((c) => cat.symbolstixCategories.includes(c))
          ) ?? candidates.find((s) => s.words.eng.toLowerCase() === wordLower);

        if (!match) {
          skipped++;
          continue;
        }

        matched++;

        await ctx.db.insert("profileSymbols", {
          accountId: args.accountId,
          profileCategoryId,
          order: symbolOrder++,
          imageSource: { type: "symbolstix", symbolId: match._id },
          label: {
            eng: match.words.eng,
            ...(match.words.hin ? { hin: match.words.hin } : {}),
          },
          updatedAt: now,
        });
      }

      console.log(
        `[seedDefaultAccount] "${cat.id}": ${matched} symbols seeded, ${skipped} not found`
      );
    }

    console.log(`[seedDefaultAccount] done for accountId=${args.accountId}`);
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
