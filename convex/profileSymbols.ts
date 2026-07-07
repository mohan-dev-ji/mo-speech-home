import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCallerAccountId, resolveCallerAccountId } from "./lib/account";
import { requireProTier } from "./lib/access";

const audioSourceValidator = v.object({
  type: v.union(v.literal("r2"), v.literal("tts"), v.literal("recorded")),
  path: v.string(),
  ttsText: v.optional(v.string()),
  language: v.optional(v.string()),
  alternates: v.optional(
    v.object({
      default:   v.optional(v.string()),
      generated: v.optional(v.string()),
      recorded:  v.optional(v.string()),
    })
  ),
});

const imageSourceValidator = v.union(
  v.object({ type: v.literal("symbolstix"), symbolId: v.id("symbols") }),
  v.object({
    type: v.literal("imageSearch"),
    imagePath: v.string(),
    imageSourceUrl: v.optional(v.string()),
    attribution: v.optional(v.string()),
    license: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("aiGenerated"),
    imagePath: v.string(),
    aiPrompt: v.optional(v.string()),
  }),
  v.object({ type: v.literal("userUpload"), imagePath: v.string() }),
  // Empty/placeholder — symbol has a label but no image yet. Mirrors the
  // schema; see profileSymbols.imageSource in convex/schema.ts.
  v.object({ type: v.literal("placeholder") })
);

const displayValidator = v.object({
  bgColour: v.optional(v.string()),
  textColour: v.optional(v.string()),
  textSize: v.optional(
    v.union(v.literal("sm"), v.literal("md"), v.literal("lg"), v.literal("xl"))
  ),
  borderColour: v.optional(v.string()),
  borderWidth: v.optional(v.number()),
  showLabel: v.optional(v.boolean()),
  showImage: v.optional(v.boolean()),
  shape: v.optional(
    v.union(v.literal("square"), v.literal("rounded"), v.literal("circle"))
  ),
});

export const getProfileSymbol = query({
  args: { profileSymbolId: v.id("profileSymbols") },
  handler: async (ctx, args) => {
    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) return null;

    let symbolRecord: {
      words: Record<string, string>;
      imagePath: string;
      // Per ADR-009 §4 audio is a voice-keyed boolean map post Phase 8.0.
      // Path is convention-resolved client-side; this field surfaces only
      // "has a seeded recording" presence.
      audio: Record<string, boolean>;
      // Legacy en-GB-News-M filename — needed because the MVP's R2 layout
      // doesn't follow `<word>.mp3`. See `lib/audio/resolveAudioPath.ts`.
      audioBasename?: string;
    } | null = null;

    if (ps.imageSource.type === "symbolstix") {
      const sym = await ctx.db.get(ps.imageSource.symbolId);
      if (sym) {
        symbolRecord = {
          words: sym.words,
          imagePath: sym.imagePath,
          audio: sym.audio as Record<string, boolean>,
          ...(sym.audioBasename ? { audioBasename: sym.audioBasename } : {}),
        };
      }
    }

    return { ...ps, symbolRecord };
  },
});

/**
 * Create a new profileSymbol in a category on the caller's account.
 */
export const createProfileSymbol = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    imageSource: imageSourceValidator,
    label: v.record(v.string(), v.string()),
    audio: v.optional(v.record(v.string(), audioSourceValidator)),
    display: v.optional(displayValidator),
    // Stable-slot placement (talker dropbar core board): insert at this exact
    // slot index (= `order`) without bumping other symbols, so gaps are
    // preserved. Omit for the default "prepend at 0 + bump" behaviour.
    slot: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category) throw new Error("Category not found");
    if (category.accountId !== accountId) throw new Error("Not authorised");

    const now = Date.now();

    let order: number;
    if (args.slot !== undefined) {
      // Fixed-slot placement — occupy `slot` as-is, leaving all other slots
      // (and any gaps) untouched. Caller places into an empty cell.
      order = args.slot;
    } else {
      // Default: make room at position 0 by bumping existing symbols up by 1.
      const existing = await ctx.db
        .query("profileSymbols")
        .withIndex("by_profile_category_id", (q) =>
          q.eq("profileCategoryId", args.profileCategoryId)
        )
        .collect();
      await Promise.all(
        existing.map((s) => ctx.db.patch(s._id, { order: s.order + 1, updatedAt: now }))
      );
      order = 0;
    }

    const newId = await ctx.db.insert("profileSymbols", {
      accountId,
      profileCategoryId: args.profileCategoryId,
      order,
      imageSource: args.imageSource,
      label: args.label,
      audio: args.audio,
      display: args.display,
      updatedAt: now,
    });

    return newId;
  },
});

/**
 * Move a symbol to a fixed slot index (= `order`) on the talker dropbar core
 * board. If another symbol already occupies the target slot they swap, so the
 * grid never collapses gaps. Unlike `reorderProfileSymbols` this does NOT
 * renumber densely — slots stay stable for motor planning.
 */
export const moveProfileSymbolToSlot = mutation({
  args: {
    profileSymbolId: v.id("profileSymbols"),
    slot: v.number(),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const sym = await ctx.db.get(args.profileSymbolId);
    if (!sym || sym.accountId !== accountId) throw new Error("Symbol not found or not authorised");
    if (sym.order === args.slot) return;

    const now = Date.now();

    // Swap with whatever symbol currently holds the target slot in this board.
    const occupant = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", sym.profileCategoryId).eq("order", args.slot)
      )
      .first();

    if (occupant) {
      await ctx.db.patch(occupant._id, { order: sym.order, updatedAt: now });
    }
    await ctx.db.patch(args.profileSymbolId, { order: args.slot, updatedAt: now });
  },
});

export const reorderProfileSymbols = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    orderedIds: v.array(v.id("profileSymbols")),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId)
      throw new Error("Category not found or not authorised");

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const sym = await ctx.db.get(args.orderedIds[i]);
      if (!sym || sym.profileCategoryId !== args.profileCategoryId)
        throw new Error("Symbol not found or not in this category");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
  },
});

/**
 * Returns the personal R2 keys that should be deleted when this symbol is
 * removed. Mirrors the logic of `getCategoryReloadOrphanKeys` — only
 * uploads, image-search picks, and recorded audio are personal; SymbolStix
 * defaults, AI-generated images (shared `ai-cache/`) and TTS clips
 * (shared `audio/<voice>/tts/`) are kept.
 *
 * Auth-checked. Returns `[]` for missing / not-owned symbols rather than
 * throwing — the orchestrating API route falls through to the mutation
 * which throws its own NOT_FOUND.
 */
export const getProfileSymbolDeleteOrphanKeys = query({
  args: { profileSymbolId: v.id("profileSymbols") },
  handler: async (ctx, { profileSymbolId }) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const { accountId } = resolved;

    const sym = await ctx.db.get(profileSymbolId);
    if (!sym || sym.accountId !== accountId) return [];

    const keys: string[] = [];

    // Image: delete only uploads + image-search. Skip symbolstix (no
    // separate R2 path) and aiGenerated (lives in shared ai-cache/).
    if (
      sym.imageSource.type === "userUpload" ||
      sym.imageSource.type === "imageSearch"
    ) {
      keys.push(sym.imageSource.imagePath);
    }

    // Audio: per-language. Delete `recorded` paths + `recorded` alternates.
    // Keep `tts` (shared cache) and `r2` (SymbolStix default). Post Phase 8.0
    // the per-language map is an open record keyed by ISO code — iterate
    // values rather than naming locales.
    const audioMap =
      (sym.audio as Record<string, { type: string; path: string; alternates?: { recorded?: string } } | undefined>) ?? {};
    for (const a of Object.values(audioMap)) {
      if (!a) continue;
      if (a.type === "recorded") keys.push(a.path);
      if (a.alternates?.recorded && a.alternates.recorded !== a.path) {
        keys.push(a.alternates.recorded);
      }
    }

    return keys;
  },
});

export const deleteProfileSymbol = mutation({
  args: {
    profileSymbolId: v.id("profileSymbols"),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) throw new Error("Symbol not found");
    if (ps.accountId !== accountId) throw new Error("Not authorised");

    await ctx.db.delete(args.profileSymbolId);

    return args.profileSymbolId;
  },
});

export const updateProfileSymbol = mutation({
  args: {
    profileSymbolId: v.id("profileSymbols"),
    profileCategoryId: v.id("profileCategories"),
    imageSource: imageSourceValidator,
    label: v.record(v.string(), v.string()),
    audio: v.optional(v.record(v.string(), audioSourceValidator)),
    display: v.optional(displayValidator),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const ps = await ctx.db.get(args.profileSymbolId);
    if (!ps) throw new Error("Symbol not found");
    if (ps.accountId !== accountId) throw new Error("Not authorised");

    const targetCategory = await ctx.db.get(args.profileCategoryId);
    if (!targetCategory || targetCategory.accountId !== accountId)
      throw new Error("Target category not found or not authorised");

    await ctx.db.patch(args.profileSymbolId, {
      profileCategoryId: args.profileCategoryId,
      imageSource: args.imageSource,
      label: args.label,
      audio: args.audio,
      display: args.display,
      updatedAt: Date.now(),
    });

    return args.profileSymbolId;
  },
});
