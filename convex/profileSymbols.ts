import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCallerAccountId } from "./lib/account";
import { syncCategoryToPackIfPublished } from "./resourcePacks";

const audioSourceValidator = v.object({
  type: v.union(v.literal("r2"), v.literal("tts"), v.literal("recorded")),
  path: v.string(),
  ttsText: v.optional(v.string()),
  language: v.optional(v.string()),
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
    v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("xl"))
  ),
  borderColour: v.optional(v.string()),
  borderWidth: v.optional(v.number()),
  showLabel: v.optional(v.boolean()),
  showImage: v.optional(v.boolean()),
  shape: v.optional(
    v.union(v.literal("square"), v.literal("rounded"), v.literal("circle"))
  ),
});

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
 * Create a new profileSymbol in a category on the caller's account.
 */
export const createProfileSymbol = mutation({
  args: {
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
    const { accountId } = await requireCallerAccountId(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category) throw new Error("Category not found");
    if (category.accountId !== accountId) throw new Error("Not authorised");

    const existing = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .collect();

    const now = Date.now();

    // Bump existing symbols up by 1 to make room at position 0
    await Promise.all(
      existing.map((s) => ctx.db.patch(s._id, { order: s.order + 1, updatedAt: now }))
    );

    const newId = await ctx.db.insert("profileSymbols", {
      accountId,
      profileCategoryId: args.profileCategoryId,
      order: 0,
      imageSource: args.imageSource,
      label: args.label,
      audio: args.audio,
      display: args.display,
      updatedAt: now,
    });

    // Auto-sync: if the parent category is published to a pack, rebuild the
    // pack's snapshot of this category so the new symbol appears in the library.
    await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);

    return newId;
  },
});

export const reorderProfileSymbols = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    orderedIds: v.array(v.id("profileSymbols")),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId)
      throw new Error("Category not found or not authorised");

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const sym = await ctx.db.get(args.orderedIds[i]);
      if (!sym || sym.profileCategoryId !== args.profileCategoryId)
        throw new Error("Symbol not found or not in this category");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }

    // Auto-sync: rebuild the parent category's snapshot once with the new order.
    await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);
  },
});

export const deleteProfileSymbol = mutation({
  args: { profileSymbolId: v.id("profileSymbols") },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) throw new Error("Symbol not found");
    if (ps.accountId !== accountId) throw new Error("Not authorised");

    const parentCategoryId = ps.profileCategoryId;
    await ctx.db.delete(args.profileSymbolId);

    // Auto-sync: rebuild the parent category's snapshot without this symbol.
    await syncCategoryToPackIfPublished(ctx, parentCategoryId);

    return args.profileSymbolId;
  },
});

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
    const { accountId } = await requireCallerAccountId(ctx);

    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) throw new Error("Symbol not found");
    if (ps.accountId !== accountId) throw new Error("Not authorised");

    const targetCategory = await ctx.db.get(args.profileCategoryId);
    if (!targetCategory || targetCategory.accountId !== accountId)
      throw new Error("Target category not found or not authorised");

    const previousCategoryId = ps.profileCategoryId;

    await ctx.db.patch(args.profileSymbolId, {
      profileCategoryId: args.profileCategoryId,
      imageSource: args.imageSource,
      label: args.label,
      audio: args.audio,
      display: args.display,
      updatedAt: Date.now(),
    });

    // Auto-sync: rebuild the affected category snapshot(s). If the symbol moved
    // between categories, both the old and new parent need rebuilding.
    if (previousCategoryId !== args.profileCategoryId) {
      await syncCategoryToPackIfPublished(ctx, previousCategoryId);
    }
    await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);

    return args.profileSymbolId;
  },
});
