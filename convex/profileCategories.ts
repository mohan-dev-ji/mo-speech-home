import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { DEFAULT_CATEGORIES } from "./data/defaultCategorySymbols";

// ─── Internal: seed ───────────────────────────────────────────────────────────

/**
 * Seed the 17 default categories + symbols into a newly created student profile.
 * Scheduled via ctx.scheduler.runAfter(0, ...) from createStudentProfile so it
 * runs immediately after profile creation without blocking the mutation.
 *
 * For each category in DEFAULT_CATEGORIES:
 *   1. Insert a profileCategories record.
 *   2. For each word, query symbols by words.eng exact match.
 *      Prefer symbols whose categories overlap with symbolstixCategories.
 *      Skip gracefully if no match found.
 */
export const seedDefaultProfile = internalMutation({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (let catIndex = 0; catIndex < DEFAULT_CATEGORIES.length; catIndex++) {
      const cat = DEFAULT_CATEGORIES[catIndex];

      const profileCategoryId = await ctx.db.insert("profileCategories", {
        profileId: args.profileId,
        name: cat.name,
        icon: cat.icon,
        colour: cat.colour,
        order: catIndex,
        updatedAt: now,
      });

      let symbolOrder = 0;
      let matched = 0;
      let skipped = 0;

      for (const word of cat.words) {
        // Use the search index (guaranteed backfilled on existing symbols table).
        // Take more candidates than needed so we can filter for exact match + right category.
        const candidates = await ctx.db
          .query("symbols")
          .withSearchIndex("search_words_eng", (q) => q.search("words.eng", word))
          .take(20);

        const wordLower = word.toLowerCase();

        // First pass: exact word match AND category overlap
        let match =
          candidates.find(
            (s) =>
              s.words.eng.toLowerCase() === wordLower &&
              s.categories.some((c) => cat.symbolstixCategories.includes(c))
          ) ??
          // Second pass: exact word match, any category
          candidates.find((s) => s.words.eng.toLowerCase() === wordLower);

        if (!match) {
          skipped++;
          continue;
        }

        matched++;

        await ctx.db.insert("profileSymbols", {
          profileId: args.profileId,
          profileCategoryId,
          order: symbolOrder++,
          imageSource: {
            type: "symbolstix",
            symbolId: match._id,
          },
          label: {
            eng: match.words.eng,
            ...(match.words.hin ? { hin: match.words.hin } : {}),
          },
          updatedAt: now,
        });
      }

      console.log(
        `[seedDefaultProfile] "${cat.id}": ${matched} symbols seeded, ${skipped} words not found`
      );
    }

    console.log(`[seedDefaultProfile] done for profileId=${args.profileId}`);
  },
});

// ─── Dev helpers ─────────────────────────────────────────────────────────────

/**
 * Re-seed default categories for an existing profile.
 * Wipes any existing profileCategories + profileSymbols first.
 * Dev/admin use — call from Convex dashboard or CLI.
 * TODO: remove or gate behind admin check before production.
 */
export const reseedProfile = mutation({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    // Delete existing symbols
    const existingSymbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_id", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const s of existingSymbols) await ctx.db.delete(s._id);

    // Delete existing categories
    const existingCats = await ctx.db
      .query("profileCategories")
      .withIndex("by_profile_id", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const c of existingCats) await ctx.db.delete(c._id);

    // Schedule fresh seed
    await ctx.scheduler.runAfter(
      0,
      internal.profileCategories.seedDefaultProfile,
      { profileId: args.profileId }
    );

    return { deleted: { categories: existingCats.length, symbols: existingSymbols.length } };
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return all categories for a profile in display order.
 * Used by the categories list screen.
 */
export const getProfileCategories = query({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profileCategories")
      .withIndex("by_profile_id_and_order", (q) =>
        q.eq("profileId", args.profileId)
      )
      .order("asc")
      .collect();
  },
});

/**
 * Return all symbols in a category in display order.
 * Used by the category detail board screen.
 */
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

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Persist a new order for the categories on a profile.
 * Caller sends the full ordered array of categoryIds.
 */
export const reorderCategories = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    orderedIds: v.array(v.id("profileCategories")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const cat = await ctx.db.get(args.orderedIds[i]);
      if (!cat || cat.profileId !== args.profileId)
        throw new Error("Category not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});

/**
 * Delete a category and all its symbols from a profile.
 */
export const deleteCategory = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const cat = await ctx.db.get(args.profileCategoryId);
    if (!cat) throw new Error("Category not found");

    // Delete all symbols in this category first
    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .collect();

    for (const sym of symbols) {
      await ctx.db.delete(sym._id);
    }

    await ctx.db.delete(args.profileCategoryId);
  },
});
