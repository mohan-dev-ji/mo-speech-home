import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const audioSourceValidator = v.object({
  type: v.union(v.literal("r2"), v.literal("tts"), v.literal("recorded")),
  path: v.string(),
  ttsText: v.optional(v.string()),
  language: v.optional(v.string()),
  // Inactive sources held alongside the active one so the editor can flip
  // between default/generate/record on re-edit without losing them.
  alternates: v.optional(
    v.object({
      default:   v.optional(v.string()),
      generated: v.optional(v.string()),
      recorded:  v.optional(v.string()),
    })
  ),
});

const imageSourceValidator = v.union(
  v.object({ type: v.literal("symbolstix"), symbolId: v.id("symbols") }),
  v.object({
    type: v.literal("imageSearch"),
    imagePath: v.string(),
    imageSourceUrl: v.optional(v.string()),
    attribution: v.optional(v.string()),
    license: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("aiGenerated"),
    imagePath: v.string(),
    aiPrompt: v.optional(v.string()),
  }),
  v.object({ type: v.literal("userUpload"), imagePath: v.string() })
);

const displayValidator = v.object({
  bgColour: v.optional(v.string()),
  textColour: v.optional(v.string()),
  textSize: v.optional(
    v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("xl")) // xl kept for backward compat with existing data
  ),
  borderColour: v.optional(v.string()),
  borderWidth: v.optional(v.number()),
  showLabel: v.optional(v.boolean()),
  showImage: v.optional(v.boolean()),
  shape: v.optional(
    v.union(v.literal("square"), v.literal("rounded"), v.literal("circle"))
  ),
});

/**
 * Fetch a single profileSymbol with its joined symbols record (for SymbolStix label/audio
 * pre-population) and its parent category (for the category dropdown default).
 */
export const getProfileSymbol = query({
  args: { profileSymbolId: v.id("profileSymbols") },
  handler: async (ctx, args) => {
    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) return null;

    let symbolRecord: {
      words: { eng: string; hin?: string };
      imagePath: string;
      audio: {
        eng: { default: string };
        hin?: { default: string };
      };
    } | null = null;

    if (ps.imageSource.type === "symbolstix") {
      const sym = await ctx.db.get(ps.imageSource.symbolId);
      if (sym) {
        symbolRecord = {
          words: sym.words,
          imagePath: sym.imagePath,
          audio: sym.audio,
        };
      }
    }

    return { ...ps, symbolRecord };
  },
});

/**
 * Create a new profileSymbol in a category.
 * Order is derived from the current symbol count so it appends to the end.
 */
export const createProfileSymbol = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    profileCategoryId: v.id("profileCategories"),
    imageSource: imageSourceValidator,
    label: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    audio: v.optional(
      v.object({
        eng: v.optional(audioSourceValidator),
        hin: v.optional(audioSourceValidator),
      })
    ),
    display: v.optional(displayValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!user || user._id !== profile.accountId)
      throw new Error("Not authorised");

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.profileId !== args.profileId)
      throw new Error("Category not found or not on this profile");

    const existing = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .collect();

    const now = Date.now();

    // Bump all existing symbols up by 1 to make room at position 0
    await Promise.all(
      existing.map((s) => ctx.db.patch(s._id, { order: s.order + 1, updatedAt: now }))
    );

    return ctx.db.insert("profileSymbols", {
      profileId: args.profileId,
      profileCategoryId: args.profileCategoryId,
      order: 0,
      imageSource: args.imageSource,
      label: args.label,
      audio: args.audio,
      display: args.display,
      updatedAt: now,
    });
  },
});

/**
 * Persist a new display order for symbols within a category.
 * Caller sends the full ordered array of profileSymbolIds.
 */
export const reorderProfileSymbols = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    orderedIds: v.array(v.id("profileSymbols")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const sym = await ctx.db.get(args.orderedIds[i]);
      if (!sym || sym.profileCategoryId !== args.profileCategoryId)
        throw new Error("Symbol not found or not in this category");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});

/**
 * Delete a profileSymbol. Called from the board edit mode symbol card.
 */
export const deleteProfileSymbol = mutation({
  args: { profileSymbolId: v.id("profileSymbols") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) throw new Error("Symbol not found");

    const profile = await ctx.db.get(ps.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!user || user._id !== profile.accountId)
      throw new Error("Not authorised");

    await ctx.db.delete(args.profileSymbolId);
    return args.profileSymbolId;
  },
});

/**
 * Update an existing profileSymbol.
 * Allows moving to a different category (profileCategoryId may change).
 */
export const updateProfileSymbol = mutation({
  args: {
    profileSymbolId: v.id("profileSymbols"),
    profileCategoryId: v.id("profileCategories"),
    imageSource: imageSourceValidator,
    label: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    audio: v.optional(
      v.object({
        eng: v.optional(audioSourceValidator),
        hin: v.optional(audioSourceValidator),
      })
    ),
    display: v.optional(displayValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) throw new Error("Symbol not found");

    const profile = await ctx.db.get(ps.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!user || user._id !== profile.accountId)
      throw new Error("Not authorised");

    const targetCategory = await ctx.db.get(args.profileCategoryId);
    if (!targetCategory || targetCategory.profileId !== ps.profileId)
      throw new Error("Target category not found or not on this profile");

    await ctx.db.patch(args.profileSymbolId, {
      profileCategoryId: args.profileCategoryId,
      imageSource: args.imageSource,
      label: args.label,
      audio: args.audio,
      display: args.display,
      updatedAt: Date.now(),
    });

    return args.profileSymbolId;
  },
});
