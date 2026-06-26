/**
 * Profile folders (ADR-014 §2) — the shared organisation primitive read layer.
 * One folder mechanism, three trees on top; queries are tree-scoped.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCallerAccountId, resolveCallerAccountId } from "./lib/account";

const TREE = v.union(
  v.literal("categories"),
  v.literal("lists"),
  v.literal("sentences")
);

// Folder CRUD is only meaningful for the foldered trees. A category IS a group
// of symbols, so the Categories tree stays flat (ADR-014 pivot 2026-06-26).
const FOLDERED_TREE = v.union(v.literal("lists"), v.literal("sentences"));

/**
 * All folders for the caller's account in one tree, in display order.
 * Returns `[]` for unauthenticated callers (the layout renders before sign-in).
 */
export const getProfileFolders = query({
  args: { tree: TREE },
  handler: async (ctx, { tree }) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    return ctx.db
      .query("profileFolders")
      .withIndex("by_account_id_and_tree_and_order", (q) =>
        q.eq("accountId", resolved.accountId).eq("tree", tree)
      )
      .order("asc")
      .collect();
  },
});

/** A single folder by id — for breadcrumb labels on folder + item pages. */
export const getProfileFolder = query({
  args: { folderId: v.id("profileFolders") },
  handler: async (ctx, { folderId }) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return null;
    const folder = await ctx.db.get(folderId);
    if (!folder || folder.accountId !== resolved.accountId) return null;
    return folder;
  },
});

// ─── Folder CRUD (Lists + Sentences groups) ─────────────────────────────────────

/** Create a user group (folder) at the end of the tree's order. */
export const createFolder = mutation({
  args: {
    tree: FOLDERED_TREE,
    name: v.record(v.string(), v.string()),
    colour: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const last = await ctx.db
      .query("profileFolders")
      .withIndex("by_account_id_and_tree_and_order", (q) =>
        q.eq("accountId", accountId).eq("tree", args.tree)
      )
      .order("desc")
      .first();
    return await ctx.db.insert("profileFolders", {
      accountId,
      tree: args.tree,
      name: args.name,
      ...(args.icon ? { icon: args.icon } : {}),
      ...(args.colour ? { colour: args.colour } : {}),
      order: last ? last.order + 1 : 0,
      source: "user",
      updatedAt: Date.now(),
    });
  },
});

/** Rename a folder (user or module — renaming a module folder is a harmless
 * local customisation; reinstall brings a fresh copy). */
export const renameFolder = mutation({
  args: {
    folderId: v.id("profileFolders"),
    name: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { folderId, name }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const folder = await ctx.db.get(folderId);
    if (!folder || folder.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found." });
    }
    await ctx.db.patch(folderId, { name, updatedAt: Date.now() });
    return { folderId };
  },
});

/**
 * Delete a folder AND every list/sentence inside it (per owner decision — the
 * delete dialog warns loudly). R2 asset orphans from deleted items are left for
 * the Phase 13.3 orphan-cleanup pass (storage-only, not correctness).
 */
export const deleteFolder = mutation({
  args: { folderId: v.id("profileFolders") },
  handler: async (ctx, { folderId }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const folder = await ctx.db.get(folderId);
    if (!folder || folder.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found." });
    }
    let deletedItems = 0;
    if (folder.tree === "lists") {
      const items = await ctx.db
        .query("profileLists")
        .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
        .collect();
      for (const it of items) await ctx.db.delete(it._id);
      deletedItems = items.length;
    } else if (folder.tree === "sentences") {
      const items = await ctx.db
        .query("profileSentences")
        .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
        .collect();
      for (const it of items) await ctx.db.delete(it._id);
      deletedItems = items.length;
    }
    await ctx.db.delete(folderId);
    return { folderId, deletedItems };
  },
});

/** Persist a new folder order for a tree (drag-and-drop in the groups view). */
export const reorderFolders = mutation({
  args: { tree: FOLDERED_TREE, orderedIds: v.array(v.id("profileFolders")) },
  handler: async (ctx, { tree, orderedIds }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const now = Date.now();
    for (let i = 0; i < orderedIds.length; i++) {
      const folder = await ctx.db.get(orderedIds[i]);
      if (!folder || folder.accountId !== accountId || folder.tree !== tree) {
        continue; // skip foreign/mismatched ids defensively
      }
      if (folder.order !== i) await ctx.db.patch(orderedIds[i], { order: i, updatedAt: now });
    }
    return { count: orderedIds.length };
  },
});

/** Move a list into a group (or to Ungrouped when folderId is null). */
export const moveListToGroup = mutation({
  args: {
    listId: v.id("profileLists"),
    folderId: v.union(v.id("profileFolders"), v.null()),
  },
  handler: async (ctx, { listId, folderId }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const list = await ctx.db.get(listId);
    if (!list || list.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "List not found." });
    }
    if (folderId) {
      const folder = await ctx.db.get(folderId);
      if (!folder || folder.accountId !== accountId || folder.tree !== "lists") {
        throw new ConvexError({ code: "BAD_FOLDER", message: "Invalid target group." });
      }
    }
    await ctx.db.patch(listId, { folderId: folderId ?? undefined, updatedAt: Date.now() });
    return { listId, folderId };
  },
});

/** Move a sentence into a group (or to Ungrouped when folderId is null). */
export const moveSentenceToGroup = mutation({
  args: {
    sentenceId: v.id("profileSentences"),
    folderId: v.union(v.id("profileFolders"), v.null()),
  },
  handler: async (ctx, { sentenceId, folderId }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(sentenceId);
    if (!sentence || sentence.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sentence not found." });
    }
    if (folderId) {
      const folder = await ctx.db.get(folderId);
      if (!folder || folder.accountId !== accountId || folder.tree !== "sentences") {
        throw new ConvexError({ code: "BAD_FOLDER", message: "Invalid target group." });
      }
    }
    await ctx.db.patch(sentenceId, { folderId: folderId ?? undefined, updatedAt: Date.now() });
    return { sentenceId, folderId };
  },
});
