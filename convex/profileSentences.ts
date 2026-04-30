import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";

const displayPropsSchema = v.optional(
  v.object({
    bgColour:   v.optional(v.string()),
    textColour: v.optional(v.string()),
    textSize:   v.optional(v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("xl"))),
    showLabel:  v.optional(v.boolean()),
    showImage:  v.optional(v.boolean()),
    cardShape:  v.optional(v.union(v.literal("square"), v.literal("rounded"), v.literal("circle"))),
  })
);

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getProfileSentences = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    const sentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_account_id_and_order", (q) =>
        q.eq("accountId", resolved.accountId)
      )
      .order("asc")
      .collect();

    return sentences.map((s) => ({
      _id:       s._id,
      name:      s.name,
      order:     s.order,
      text:      s.text,
      audioPath: s.audioPath,
      slots:     [...s.slots].sort((a, b) => a.order - b.order),
    }));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createProfileSentence = mutation({
  args: {
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const last = await ctx.db
      .query("profileSentences")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
      .order("desc")
      .first();

    return ctx.db.insert("profileSentences", {
      accountId,
      name:       args.name,
      order:      last ? last.order + 1 : 0,
      slots:      [],
      updatedAt:  Date.now(),
    });
  },
});

export const updateProfileSentenceName = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, { name: args.name, updatedAt: Date.now() });
  },
});

export const updateProfileSentenceSlots = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    slots: v.array(
      v.object({
        order:        v.number(),
        imagePath:    v.optional(v.string()),
        displayProps: displayPropsSchema,
      })
    ),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, {
      slots:     args.slots,
      updatedAt: Date.now(),
    });
  },
});

export const updateProfileSentenceAudio = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    text:      v.optional(v.string()),
    audioPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, {
      text:      args.text,
      audioPath: args.audioPath,
      updatedAt: Date.now(),
    });
  },
});

export const deleteProfileSentence = mutation({
  args: { profileSentenceId: v.id("profileSentences") },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.delete(args.profileSentenceId);
  },
});

export const reorderProfileSentences = mutation({
  args: {
    orderedIds: v.array(v.id("profileSentences")),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const sentence = await ctx.db.get(args.orderedIds[i]);
      if (!sentence || sentence.accountId !== accountId)
        throw new Error("Sentence not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});
