import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all lists for a category in display order.
 * Includes the first 4 symbol image paths as thumbnails for each list.
 */
export const getProfileLists = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    const lists = await ctx.db
      .query("profileLists")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .order("asc")
      .collect();

    return Promise.all(
      lists.map(async (list) => {
        const firstFour = [...list.items]
          .sort((a, b) => a.order - b.order)
          .slice(0, 4);

        const thumbnails = await Promise.all(
          firstFour.map(async (item) => {
            const ps = await ctx.db.get(item.profileSymbolId);
            if (!ps) return { imagePath: undefined as string | undefined };

            if (ps.imageSource.type === "symbolstix") {
              const sym = await ctx.db.get(ps.imageSource.symbolId);
              return { imagePath: sym?.imagePath as string | undefined };
            }
            const src = ps.imageSource as { imagePath: string };
            return { imagePath: src.imagePath as string | undefined };
          })
        );

        return {
          _id: list._id,
          name: list.name,
          order: list.order,
          displayFormat: list.displayFormat ?? ("rows" as const),
          showNumbers: list.showNumbers ?? false,
          showChecklist: list.showChecklist ?? false,
          itemCount: list.items.length,
          thumbnails,
        };
      })
    );
  },
});

/**
 * Returns a single list with all items and resolved symbol data.
 */
export const getProfileListWithItems = query({
  args: { profileListId: v.id("profileLists") },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.profileListId);
    if (!list) return null;

    const sortedItems = [...list.items].sort((a, b) => a.order - b.order);

    const items = await Promise.all(
      sortedItems.map(async (item) => {
        const ps = await ctx.db.get(item.profileSymbolId);
        let imagePath: string | undefined;
        let labelEng: string | undefined;
        let labelHin: string | undefined;

        if (ps) {
          labelEng = ps.label.eng;
          labelHin = ps.label.hin;
          if (ps.imageSource.type === "symbolstix") {
            const sym = await ctx.db.get(ps.imageSource.symbolId);
            if (sym) imagePath = sym.imagePath;
          } else {
            const src = ps.imageSource as { imagePath: string };
            imagePath = src.imagePath;
          }
        }

        return {
          profileSymbolId: item.profileSymbolId,
          order: item.order,
          description: item.description,
          imagePath,
          labelEng,
          labelHin,
        };
      })
    );

    return {
      _id: list._id,
      profileCategoryId: list.profileCategoryId,
      name: list.name,
      displayFormat: list.displayFormat ?? ("rows" as const),
      showNumbers: list.showNumbers ?? false,
      showChecklist: list.showChecklist ?? false,
      items,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createProfileList = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    profileCategoryId: v.id("profileCategories"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const last = await ctx.db
      .query("profileLists")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .order("desc")
      .first();

    return ctx.db.insert("profileLists", {
      profileId: args.profileId,
      profileCategoryId: args.profileCategoryId,
      name: args.name,
      order: last ? last.order + 1 : 0,
      items: [],
      displayFormat: "rows",
      showNumbers: false,
      showChecklist: false,
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
        profileSymbolId: v.id("profileSymbols"),
        order: v.number(),
        description: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.patch(args.profileListId, { items: args.items, updatedAt: Date.now() });
  },
});

export const updateProfileListDisplay = mutation({
  args: {
    profileListId: v.id("profileLists"),
    displayFormat: v.union(v.literal("rows"), v.literal("columns"), v.literal("grid")),
    showNumbers: v.boolean(),
    showChecklist: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    await ctx.db.patch(args.profileListId, {
      displayFormat: args.displayFormat,
      showNumbers: args.showNumbers,
      showChecklist: args.showChecklist,
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
    profileCategoryId: v.id("profileCategories"),
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
