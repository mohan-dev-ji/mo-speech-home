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
import { findVariantInGroup, variantGroupIdOf } from "./lib/variantAuthoring";
import { collectPhraseOrphanKeys } from "./lib/contentModuleDelete";

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
      authoredLanguage: p.authoredLanguage, // Phase 15 (3c)
      variantGroupId: p.variantGroupId, // ADR-016 — sibling-variant link
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
    // Phase 15 (Thread 3) — the language this phrase is authored in. Structure-
    // bound content is re-authored per language, so stamp the board language at
    // create time (ADR-016 — drives variant resolution + the "Made in" badge).
    authoredLanguage: v.optional(v.string()),
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
      ...(args.authoredLanguage ? { authoredLanguage: args.authoredLanguage } : {}),
      updatedAt: Date.now(),
    });
  },
});

// ADR-016 §1/§3 — author a per-language variant of an existing phrase. Creates a
// sibling seeded from the source's words + name (the instructor then re-orders /
// re-words for the target language) and links it into the source's variant group
// (lazily materialising the group on the source). Idempotent per (group,
// language): returns the existing variant if one exists.
export const createPhraseVariant = mutation({
  args: {
    sourcePhraseId: v.id("profilePhrases"),
    authoredLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const source = await ctx.db.get(args.sourcePhraseId);
    if (!source || source.accountId !== accountId) throw new Error("Not authorised");

    // Materialise the group lazily + find any existing same-language sibling
    // (shared logic; see convex/lib/variantAuthoring.ts).
    const siblings = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const { groupId, existing } = findVariantInGroup(source, siblings, args.authoredLanguage);
    if (existing) return existing._id;
    if (!source.variantGroupId) {
      await ctx.db.patch(source._id, { variantGroupId: groupId, updatedAt: Date.now() });
    }

    return await ctx.db.insert("profilePhrases", {
      accountId,
      kind: "phrase" as const,
      name: source.name,
      order: source.order,
      ...(source.folderId ? { folderId: source.folderId } : {}),
      words: source.words,
      authoredLanguage: args.authoredLanguage,
      variantGroupId: groupId,
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
  handler: async (ctx, args): Promise<string[]> => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    // Variants share word-image/audio R2 keys with their source/siblings (seeded by
    // copy). On single-row revert, free only keys unique to this row.
    const ownKeys = collectPhraseOrphanKeys(phrase);
    const groupId = variantGroupIdOf(phrase);
    const rows = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const survivingKeys = new Set<string>();
    for (const p of rows) {
      if (p._id === phrase._id) continue;
      if ((p.variantGroupId ?? p._id) !== groupId) continue;
      for (const k of collectPhraseOrphanKeys(p)) survivingKeys.add(k);
    }
    await ctx.db.delete(args.profilePhraseId);
    return ownKeys.filter((k) => !survivingKeys.has(k));
  },
});

// Stage 4 — delete the whole phrase item (source + every sibling variant).
export const deletePhraseGroup = mutation({
  args: { profilePhraseId: v.id("profilePhrases") },
  handler: async (ctx, args): Promise<string[]> => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const row = await ctx.db.get(args.profilePhraseId);
    if (!row || row.accountId !== accountId) throw new Error("Not authorised");
    const groupId = variantGroupIdOf(row);
    const rows = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const group = rows.filter((p) => (p.variantGroupId ?? p._id) === groupId);
    const orphanKeys: string[] = [];
    for (const p of group) {
      orphanKeys.push(...collectPhraseOrphanKeys(p));
      await ctx.db.delete(p._id);
    }
    return Array.from(new Set(orphanKeys));
  },
});

export const moveProfilePhraseToFolder = mutation({
  args: {
    profilePhraseId: v.id("profilePhrases"),
    // Destination bank (Phrases-tree folder). Null moves the phrase to Ungrouped.
    folderId: v.union(v.id("profileFolders"), v.null()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profilePhraseId, {
      folderId: args.folderId ?? undefined,
      updatedAt: Date.now(),
    });
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
