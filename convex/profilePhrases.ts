/**
 * Profile-level phrases (ADR-015) — reusable, named, audio-bearing chunks of
 * words, surfaced in the talker dropdown's phrase banks and snapshotted into
 * sentences as phrase-units. Mirrors `profileSentences` but holds `words[]`
 * (one level deep, no phrase-in-phrase) and files into the Phrases tree.
 * Phrases are new (post ADR-010), so there is no resourcePacks propagation.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import { requireProTier } from "./lib/access";

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

// A phrase's inner words (the compositionWord shape from schema.ts).
const phraseWordsSchema = v.array(
  v.object({
    order:        v.number(),
    imagePath:    v.optional(v.string()),
    audioPath:    v.optional(v.string()),
    label:        v.optional(v.record(v.string(), v.string())),
    displayProps: displayPropsSchema,
  })
);

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getProfilePhrases = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    const phrases = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id_and_order", (q) =>
        q.eq("accountId", resolved.accountId)
      )
      .order("asc")
      .collect();

    return phrases.map((p) => ({
      _id:   p._id,
      name:  p.name,
      order: p.order,
      words: [...p.words].sort((a, b) => a.order - b.order),
      audioPath: p.audioPath,
      // Mirror getProfileSentences: surface a legacy recording-prefixed audioPath
      // as the recording override.
      recordedAudioPath:
        p.recordedAudioPath ??
        (p.audioPath?.startsWith("accounts/") ? p.audioPath : undefined),
      librarySourceId: p.librarySourceId,
      folderId: p.folderId, // ADR-015 — bank membership (Phrases tree)
    }));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createProfilePhrase = mutation({
  args: {
    name: v.record(v.string(), v.string()),
    // File the new phrase into a bank (Phrases-tree folder). Omit to leave it
    // Ungrouped.
    folderId: v.optional(v.id("profileFolders")),
    words: v.optional(phraseWordsSchema),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const last = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
      .order("desc")
      .first();

    return ctx.db.insert("profilePhrases", {
      accountId,
      kind:  "phrase",
      name:  args.name,
      order: last ? last.order + 1 : 0,
      words: args.words ?? [],
      ...(args.folderId ? { folderId: args.folderId } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const updateProfilePhraseName = mutation({
  args: {
    profilePhraseId: v.id("profilePhrases"),
    name: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profilePhraseId, { name: args.name, updatedAt: Date.now() });
  },
});

export const updateProfilePhraseWords = mutation({
  args: {
    profilePhraseId: v.id("profilePhrases"),
    words: phraseWordsSchema,
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profilePhraseId, { words: args.words, updatedAt: Date.now() });
  },
});

export const updateProfilePhraseAudio = mutation({
  args: {
    profilePhraseId: v.id("profilePhrases"),
    // Whole-phrase recording override (null clears). TTS is resolved dynamically
    // from the phrase text/words elsewhere; only the recording is stored.
    recordedAudioPath: v.optional(v.union(v.string(), v.null())),
    audioPath: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.recordedAudioPath !== undefined)
      patch.recordedAudioPath = args.recordedAudioPath ?? undefined;
    if (args.audioPath !== undefined) patch.audioPath = args.audioPath ?? undefined;
    await ctx.db.patch(args.profilePhraseId, patch);
  },
});

export const deleteProfilePhrase = mutation({
  args: { profilePhraseId: v.id("profilePhrases") },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.delete(args.profilePhraseId);
  },
});

export const reorderProfilePhrases = mutation({
  args: { orderedIds: v.array(v.id("profilePhrases")) },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const phrase = await ctx.db.get(args.orderedIds[i]);
      if (!phrase || phrase.accountId !== accountId)
        throw new Error("Phrase not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});
