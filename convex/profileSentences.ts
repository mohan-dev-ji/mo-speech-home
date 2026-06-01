import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import { requireProTier } from "./lib/access";
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
      // Phase 8.5 — human recording override. Read-time backfill: a legacy
      // `audioPath` under the recording prefix (accounts/<id>/audio/...) is a
      // recording, so surface it as the override even before it was migrated.
      // Legacy TTS audioPaths are NOT surfaced here — they're superseded by
      // dynamic per-voice resolution.
      recordedAudioPath:
        s.recordedAudioPath ??
        (s.audioPath?.startsWith("accounts/") ? s.audioPath : undefined),
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
    name: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

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
    name: v.record(v.string(), v.string()),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
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
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
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
    // Phase 8.5: TTS is no longer stored here — it's resolved per (text, voice)
    // from the global ttsCache. Pass `recordedAudioPath` for a human recording
    // (null clears it). `audioPath` kept for back-compat (null clears). Only
    // fields explicitly provided are patched, so a TTS-only save leaves any
    // existing recording intact.
    recordedAudioPath: v.optional(v.union(v.string(), v.null())),
    audioPath: v.optional(v.union(v.string(), v.null())),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.text !== undefined) patch.text = args.text;
    if (args.recordedAudioPath !== undefined) patch.recordedAudioPath = args.recordedAudioPath ?? undefined;
    if (args.audioPath !== undefined) patch.audioPath = args.audioPath ?? undefined;
    await ctx.db.patch(args.profileSentenceId, patch);
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
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
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
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
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
