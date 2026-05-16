import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import {
  removeSentenceFromPack,
  syncSentenceToPackIfPublished,
} from "./resourcePacks";

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
      publishedToPackId: s.publishedToPackId,
      packSlug: s.packSlug,
      librarySourceId: s.librarySourceId,
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

// `propagateToPack` opt-in flag: pack snapshot only updates when caller is
// admin AND in admin viewMode. Default false — admin in instructor / student
// view leaves the pack untouched. See ADR-008 + ADR-009 follow-up.

export const updateProfileSentenceName = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    name: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, { name: args.name, updatedAt: Date.now() });
    if (args.propagateToPack) {
      await syncSentenceToPackIfPublished(ctx, args.profileSentenceId);
    }
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
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, {
      slots:     args.slots,
      updatedAt: Date.now(),
    });
    if (args.propagateToPack) {
      await syncSentenceToPackIfPublished(ctx, args.profileSentenceId);
    }
  },
});

export const updateProfileSentenceAudio = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    text:      v.optional(v.string()),
    audioPath: v.optional(v.string()),
    propagateToPack: v.optional(v.boolean()),
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
    if (args.propagateToPack) {
      await syncSentenceToPackIfPublished(ctx, args.profileSentenceId);
    }
  },
});

export const deleteProfileSentence = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");

    // Only remove from pack snapshot when admin opted in. Without the
    // flag, the profile row is deleted but the pack snapshot retains its
    // entry (with a now-orphan sourceProfileSentenceId) until the admin
    // returns to admin view to clean up.
    if (args.propagateToPack) {
      await removeSentenceFromPack(ctx, args.profileSentenceId);
    }
    await ctx.db.delete(args.profileSentenceId);
  },
});

export const reorderProfileSentences = mutation({
  args: {
    orderedIds: v.array(v.id("profileSentences")),
    propagateToPack: v.optional(v.boolean()),
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

    if (args.propagateToPack) {
      for (const id of args.orderedIds) {
        await syncSentenceToPackIfPublished(ctx, id);
      }
    }
  },
});
