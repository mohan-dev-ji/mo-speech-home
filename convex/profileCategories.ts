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

      // Resolve folder cover image — exact index lookup (1 read)
      let folderImagePath: string | undefined;
      if (cat.folderWord) {
        const folderSym = await ctx.db
          .query("symbols")
          .withIndex("by_words_eng", (q) =>
            q.eq("words.eng", cat.folderWord!)
          )
          .first();
        if (folderSym) folderImagePath = folderSym.imagePath;
      }

      const profileCategoryId = await ctx.db.insert("profileCategories", {
        profileId: args.profileId,
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
        // Exact btree index lookup — only reads documents where words.eng === word.
        // Take 3 in case the same word exists across multiple SymbolStix categories;
        // the category filter below picks the best match.
        const candidates = await ctx.db
          .query("symbols")
          .withIndex("by_words_eng", (q) => q.eq("words.eng", word))
          .take(3);

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
 * Return a single category by its document ID.
 * Used by the category detail screen for the header.
 */
export const getProfileCategory = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.profileCategoryId);
  },
});

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

/**
 * Return profileSymbols with image paths and audio resolved.
 * For symbolstix sources the symbols record is fetched and joined.
 * Returns a flat shape ready for SymbolCard without needing client-side joins.
 */
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
            imagePath  = sym.imagePath;
            audioEng   = ps.audio?.eng?.path ?? sym.audio.eng.default;
            audioHin   = ps.audio?.hin?.path ?? sym.audio.hin?.default;
          }
        } else {
          // googleImages | aiGenerated | userUpload — all have imagePath
          const src = ps.imageSource as { imagePath: string };
          imagePath  = src.imagePath;
          audioEng   = ps.audio?.eng?.path;
          audioHin   = ps.audio?.hin?.path;
        }

        return {
          _id:               ps._id,
          profileCategoryId: ps.profileCategoryId,
          order:             ps.order,
          label:             ps.label,
          display:           ps.display,
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
 * Update a category's colour and/or folder cover image.
 * Called by the board edit mode banner save.
 */
export const updateCategoryMeta = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    colour: v.optional(v.string()),
    imagePath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const cat = await ctx.db.get(args.profileCategoryId);
    if (!cat) throw new Error("Category not found");

    const profile = await ctx.db.get(cat.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!user || user._id !== profile.accountId)
      throw new Error("Not authorised");

    await ctx.db.patch(args.profileCategoryId, {
      ...(args.colour !== undefined && { colour: args.colour }),
      ...(args.imagePath !== undefined && { imagePath: args.imagePath }),
      updatedAt: Date.now(),
    });

    return args.profileCategoryId;
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
