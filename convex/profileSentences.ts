import { mutation, query } from "./_generated/server";
import { v, type Infer } from "convex/values";
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

// Composition unit validators (ADR-015) — mirror schema.ts `compositionUnit`.
// Used by talker saves (createProfileSentence) to persist the bar's units[]
// while keeping phrase decomposition + per-unit clips.
const compositionWordSchema = v.object({
  order:        v.number(),
  imagePath:    v.optional(v.string()),
  audioPath:    v.optional(v.string()),
  label:        v.optional(v.record(v.string(), v.string())),
  displayProps: displayPropsSchema,
});

const compositionUnitSchema = v.union(
  v.object({
    kind:         v.literal("word"),
    order:        v.number(),
    imagePath:    v.optional(v.string()),
    audioPath:    v.optional(v.string()),
    label:        v.optional(v.record(v.string(), v.string())),
    displayProps: displayPropsSchema,
  }),
  v.object({
    kind:              v.literal("phrase"),
    order:             v.number(),
    name:              v.record(v.string(), v.string()),
    audioPath:         v.optional(v.string()),
    recordedAudioPath: v.optional(v.string()),
    librarySourceId:   v.optional(v.string()),
    words:             v.array(compositionWordSchema),
  })
);

type CompositionUnit = Infer<typeof compositionUnitSchema>;

// Flatten units → flat word slots (the back-compat / fluent-fallback view kept in
// sync on every unit write). A phrase expands to its words' imagePaths; a word
// contributes its own. Order is reindexed. Mirrors the talker-save flatten in
// PersistentTalker.handleSaveConfirm.
function flattenUnitsToSlots(
  units: CompositionUnit[]
): Array<{ order: number; imagePath?: string }> {
  const slots: Array<{ order: number; imagePath?: string }> = [];
  for (const u of units) {
    if (u.kind === "phrase") {
      for (const w of u.words) {
        slots.push({ order: slots.length, ...(w.imagePath ? { imagePath: w.imagePath } : {}) });
      }
    } else {
      slots.push({ order: slots.length, ...(u.imagePath ? { imagePath: u.imagePath } : {}) });
    }
  }
  return slots;
}

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
      // ADR-015 — expose the composition so talker-saved ("sequence") sentences
      // can render + play as blocks. `slots` stays for the fluent/legacy path.
      units:     s.units,
      kind:      s.kind,
      playback:  s.playback,
      authoredLanguage: s.authoredLanguage, // Phase 15 (3c) — drives block resolution + badge
      variantGroupId: s.variantGroupId, // ADR-016 — sibling-variant link (client collapses by board lang)
      librarySourceId: s.librarySourceId,
      folderId: s.folderId, // ADR-014 — group membership (Sentences tree)
    }));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createProfileSentence = mutation({
  args: {
    name: v.record(v.string(), v.string()),
    // ADR-014 — file the new sentence into a group (set when created from inside
    // a Sentence Group). Omit to leave it Ungrouped.
    folderId: v.optional(v.id("profileFolders")),
    // ADR-015 — talker saves persist a full composition: `units[]` retains phrase
    // decomposition + per-unit clips; `slots[]` stays the flat rendered source;
    // `playback:"sequence"` plays each unit's clip in turn (no whole-sentence TTS).
    kind:     v.optional(v.literal("sentence")),
    playback: v.optional(v.union(v.literal("sequence"), v.literal("fluent"))),
    // Phase 15 (3b) — the language this sentence is authored in. Block sentences
    // resolve their text + voice against this, never a later board language.
    authoredLanguage: v.optional(v.string()),
    units:    v.optional(v.array(compositionUnitSchema)),
    slots:    v.optional(
      v.array(
        v.object({
          order:        v.number(),
          imagePath:    v.optional(v.string()),
          displayProps: displayPropsSchema,
        })
      )
    ),
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
      slots:      args.slots ?? [],
      ...(args.kind ? { kind: args.kind } : {}),
      ...(args.units ? { units: args.units } : {}),
      ...(args.playback ? { playback: args.playback } : {}),
      ...(args.authoredLanguage ? { authoredLanguage: args.authoredLanguage } : {}),
      ...(args.folderId ? { folderId: args.folderId } : {}),
      updatedAt:  Date.now(),
    });
  },
});

export const updateProfileSentenceName = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    name: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
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
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, {
      slots:     args.slots,
      updatedAt: Date.now(),
    });
  },
});

// ADR-015 — edit a talker-saved ("sequence") sentence at the unit level (phrases
// stay atomic blocks). Patches `units` and regenerates `slots` from them so the
// flat fallback view stays valid for the fluent path + any slot readers.
export const updateProfileSentenceUnits = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    units: v.array(compositionUnitSchema),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    await ctx.db.patch(args.profileSentenceId, {
      units:     args.units,
      slots:     flattenUnitsToSlots(args.units),
      updatedAt: Date.now(),
    });
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
  },
});

export const deleteProfileSentence = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
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
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const sentence = await ctx.db.get(args.orderedIds[i]);
      if (!sentence || sentence.accountId !== accountId)
        throw new Error("Sentence not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});
