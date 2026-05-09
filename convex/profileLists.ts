import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import {
  removeListFromPack,
  syncListToPackIfPublished,
} from "./resourcePacks";

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all lists for the caller's account in display order.
 * Includes the first 4 item image paths as thumbnails — the row UI shows
 * them and renders an overflow "…" tile when `itemCount > 4`.
 */
export const getProfileLists = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    const lists = await ctx.db
      .query("profileLists")
      .withIndex("by_account_id_and_order", (q) =>
        q.eq("accountId", resolved.accountId)
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
        publishedToPackId: list.publishedToPackId,
      };
    });
  },
});

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
      publishedToPackId: list.publishedToPackId,
      items,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createProfileList = mutation({
  args: {
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const last = await ctx.db
      .query("profileLists")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
      .order("desc")
      .first();

    return ctx.db.insert("profileLists", {
      accountId,
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
    // See ADR-008 + ADR-009 follow-up: pack snapshot only updates when the
    // caller is admin AND in admin viewMode. Non-admin views (and normal
    // users) never propagate to the pack.
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) throw new Error("Not authorised");

    await ctx.db.patch(args.profileListId, { name: args.name, updatedAt: Date.now() });
    if (args.propagateToPack) {
      await syncListToPackIfPublished(ctx, args.profileListId);
    }
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
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) throw new Error("Not authorised");

    await ctx.db.patch(args.profileListId, { items: args.items, updatedAt: Date.now() });
    if (args.propagateToPack) {
      await syncListToPackIfPublished(ctx, args.profileListId);
    }
  },
});

export const addItemFromSymbol = mutation({
  args: {
    profileListId: v.id("profileLists"),
    profileSymbolId: v.id("profileSymbols"),
    insertAtIndex: v.optional(v.number()),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const sym = await ctx.db.get(args.profileSymbolId);
    if (!sym) throw new Error("profileSymbol not found");
    if (sym.accountId !== accountId) throw new Error("Not authorised");

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
    if (list.accountId !== accountId) throw new Error("Not authorised");

    const items = [...list.items].sort((a, b) => a.order - b.order);

    if (args.insertAtIndex !== undefined && args.insertAtIndex < items.length) {
      items[args.insertAtIndex] = { ...items[args.insertAtIndex], imagePath };
    } else {
      items.push({ imagePath, order: items.length, description: undefined });
    }

    const reindexed = items.map((item, i) => ({ ...item, order: i }));
    await ctx.db.patch(args.profileListId, { items: reindexed, updatedAt: Date.now() });
    if (args.propagateToPack) {
      await syncListToPackIfPublished(ctx, args.profileListId);
    }
  },
});

export const updateProfileListDisplay = mutation({
  args: {
    profileListId: v.id("profileLists"),
    displayFormat: v.union(v.literal("rows"), v.literal("columns"), v.literal("grid")),
    showNumbers: v.boolean(),
    showChecklist: v.boolean(),
    showFirstThen: v.boolean(),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) throw new Error("Not authorised");

    await ctx.db.patch(args.profileListId, {
      displayFormat: args.displayFormat,
      showNumbers: args.showNumbers,
      showChecklist: args.showChecklist,
      showFirstThen: args.showFirstThen,
      updatedAt: Date.now(),
    });
    if (args.propagateToPack) {
      await syncListToPackIfPublished(ctx, args.profileListId);
    }
  },
});

export const deleteProfileList = mutation({
  args: {
    profileListId: v.id("profileLists"),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) throw new Error("Not authorised");

    // Only remove from the pack snapshot when admin opted in. Without the
    // flag, the profile row is deleted but the pack snapshot retains its
    // entry (with a now-orphan sourceProfileListId). Deliberate: an admin
    // in instructor / student view should not silently mutate the pack.
    if (args.propagateToPack) {
      await removeListFromPack(ctx, args.profileListId);
    }
    await ctx.db.delete(args.profileListId);
  },
});

export const reorderProfileLists = mutation({
  args: {
    orderedIds: v.array(v.id("profileLists")),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const list = await ctx.db.get(args.orderedIds[i]);
      if (!list || list.accountId !== accountId)
        throw new Error("List not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }

    if (args.propagateToPack) {
      for (const id of args.orderedIds) {
        await syncListToPackIfPublished(ctx, id);
      }
    }
  },
});
