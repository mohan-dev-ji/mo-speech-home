import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all lists for a profile in display order.
 * Includes the first 4 item image paths as thumbnails.
 */
export const getProfileLists = query({
  args: { profileId: v.id("studentProfiles") },
  handler: async (ctx, args) => {
    const lists = await ctx.db
      .query("profileLists")
      .withIndex("by_profile_id_and_order", (q) =>
        q.eq("profileId", args.profileId)
      )
      .order("asc")
      .collect();

    return lists.map((list) => {
      const firstFour = [...list.items]
        .sort((a, b) => a.order - b.order)
        .slice(0, 4);

      return {
        _id: list._id,
        name: list.name,
        order: list.order,
        displayFormat: list.displayFormat ?? ("rows" as const),
        showNumbers: list.showNumbers ?? false,
        showChecklist: list.showChecklist ?? false,
        showFirstThen: list.showFirstThen ?? false,
        itemCount: list.items.length,
        thumbnails: firstFour.map((item) => ({ imagePath: item.imagePath })),
      };
    });
  },
});

/**
 * Returns a single list with all items sorted by order.
 * Items carry imagePath directly — no join needed.
 */
export const getProfileListWithItems = query({
  args: { profileListId: v.id("profileLists") },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.profileListId);
    if (!list) return null;

    const items = [...list.items].sort((a, b) => a.order - b.order);

    return {
      _id: list._id,
      name: list.name,
      displayFormat: list.displayFormat ?? ("rows" as const),
      showNumbers: list.showNumbers ?? false,
      showChecklist: list.showChecklist ?? false,
      showFirstThen: list.showFirstThen ?? false,
      items,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createProfileList = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const last = await ctx.db
      .query("profileLists")
      .withIndex("by_profile_id_and_order", (q) =>
        q.eq("profileId", args.profileId)
      )
      .order("desc")
      .first();

    return ctx.db.insert("profileLists", {
      profileId: args.profileId,
      name: args.name,
      order: last ? last.order + 1 : 0,
      items: [],
      displayFormat: "rows",
      showNumbers: false,
      showChecklist: false,
      showFirstThen: false,
      updatedAt: Date.now(),
    });
  },
});

export const updateProfileListName = mutation({
  args: {
    profileListId: v.id("profileLists"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.patch(args.profileListId, { name: args.name, updatedAt: Date.now() });
  },
});

export const updateProfileListItems = mutation({
  args: {
    profileListId: v.id("profileLists"),
    items: v.array(
      v.object({
        imagePath: v.optional(v.string()),
        order: v.number(),
        description: v.optional(v.string()),
        audioPath: v.optional(v.string()),
        activeAudioSource: v.optional(v.union(
          v.literal("default"), v.literal("generate"), v.literal("record")
        )),
        defaultAudioPath:   v.optional(v.string()),
        generatedAudioPath: v.optional(v.string()),
        recordedAudioPath:  v.optional(v.string()),
        imageSourceType: v.optional(v.union(
          v.literal("symbolstix"), v.literal("upload"),
          v.literal("imageSearch"), v.literal("aiGenerated")
        )),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.patch(args.profileListId, { items: args.items, updatedAt: Date.now() });
  },
});

/**
 * Saves a symbol editor result into a list item.
 * Resolves the profileSymbol's imagePath server-side so items remain self-contained.
 * Pass insertAtIndex to replace an existing slot; omit to append.
 */
export const addItemFromSymbol = mutation({
  args: {
    profileListId: v.id("profileLists"),
    profileSymbolId: v.id("profileSymbols"),
    insertAtIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const sym = await ctx.db.get(args.profileSymbolId);
    if (!sym) throw new Error("profileSymbol not found");

    let imagePath: string | undefined;
    if (sym.imageSource.type === "symbolstix") {
      const libSym = await ctx.db.get(sym.imageSource.symbolId);
      imagePath = libSym?.imagePath;
    } else {
      const src = sym.imageSource as { imagePath?: string };
      imagePath = src.imagePath;
    }

    const list = await ctx.db.get(args.profileListId);
    if (!list) throw new Error("profileList not found");

    const items = [...list.items].sort((a, b) => a.order - b.order);

    if (args.insertAtIndex !== undefined && args.insertAtIndex < items.length) {
      items[args.insertAtIndex] = { ...items[args.insertAtIndex], imagePath };
    } else {
      items.push({ imagePath, order: items.length, description: undefined });
    }

    const reindexed = items.map((item, i) => ({ ...item, order: i }));
    await ctx.db.patch(args.profileListId, { items: reindexed, updatedAt: Date.now() });
  },
});

export const updateProfileListDisplay = mutation({
  args: {
    profileListId: v.id("profileLists"),
    displayFormat: v.union(v.literal("rows"), v.literal("columns"), v.literal("grid")),
    showNumbers: v.boolean(),
    showChecklist: v.boolean(),
    showFirstThen: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.patch(args.profileListId, {
      displayFormat: args.displayFormat,
      showNumbers: args.showNumbers,
      showChecklist: args.showChecklist,
      showFirstThen: args.showFirstThen,
      updatedAt: Date.now(),
    });
  },
});

export const deleteProfileList = mutation({
  args: { profileListId: v.id("profileLists") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.delete(args.profileListId);
  },
});

export const reorderProfileLists = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    orderedIds: v.array(v.id("profileLists")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});
