import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Batch insert for seeding — dev/admin use only.
 * Accepts the new ISO-keyed shape (`words.en`, `synonyms.en`, etc.) per ADR-009 §2.
 * TODO: convert to internalMutation before production launch.
 */
export const batchInsertSymbols = mutation({
  args: {
    symbols: v.array(
      v.object({
        // Mirror the schema's `symbolWords` / `symbolSynonyms` shape — the
        // indexable languages are named so search indexes can target them.
        // Adding a language is a code edit per ADR-009 §6.6.
        words: v.object({
          en: v.string(),
          hi: v.optional(v.string()),
        }),
        synonyms: v.optional(
          v.object({
            en: v.optional(v.array(v.string())),
            hi: v.optional(v.array(v.string())),
          })
        ),
        imagePath: v.string(),
        // Voice-keyed boolean map per ADR-009 §4 — "is voice seeded".
        // Path is convention-resolved by lib/audio/resolveAudioPath.ts.
        audio: v.record(v.string(), v.boolean()),
        tags: v.array(v.string()),
        categories: v.array(v.string()),
        priority: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids: string[] = [];
    for (const symbol of args.symbols) {
      const id = await ctx.db.insert("symbols", symbol);
      ids.push(id);
    }
    return { count: ids.length };
  },
});

/**
 * Language-aware full-text symbol search.
 *
 * Uses the correct search index for the active language:
 *   "en" → search_words_en (words.en field)
 *   "hi" → search_words_hi (words.hi field)
 *
 * Other languages currently fall back to the en index — Convex search indexes
 * are static (not record-aware), so each stable language needs an explicit
 * index defined on `symbols` in schema.ts. Adding indexes for new stable
 * languages is a deliberate step in the 8.6 promotion-to-stable flow per ADR-009.
 *
 * Returns [] immediately when searchTerm is blank — the client skips calling
 * this when blank, but the guard is defensive.
 *
 * Never hard-code a language as default — always pass the language from
 * ProfileContext. The fallback to the en index is only for non-indexed languages.
 */
export const searchSymbols = query({
  args: {
    searchTerm: v.string(),
    language: v.string(), // ISO 639-1 — open-ended, never cast to a fixed union
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { searchTerm, language, limit = 20 } = args;

    if (!searchTerm.trim()) return [];

    if (language === "hi") {
      return ctx.db
        .query("symbols")
        .withSearchIndex("search_words_hi", (q) =>
          q.search("words.hi", searchTerm)
        )
        .take(limit);
    }

    return ctx.db
      .query("symbols")
      .withSearchIndex("search_words_en", (q) =>
        q.search("words.en", searchTerm)
      )
      .take(limit);
  },
});

/**
 * Admin / curation helper: returns SymbolStix entries whose English label
 * contains a space (multi-word phrases or sentences). Used to seed
 * conversational chat categories with ready-made full-phrase symbols.
 *
 * Returns up to `limit` entries (default 2000), sorted by length ascending
 * so shorter conversational phrases surface first. Each entry returns just
 * the en label and id — keeps the payload small.
 */
export const listMultiWordEn = query({
  args: {
    /** Optional regex filter (case-insensitive) applied to words.en. Used
     *  to narrow down to conversational chat phrases vs the full 19k+
     *  multi-word set. */
    contains: v.optional(v.string()),
    /** 1-indexed page number for the 32k-doc-per-call read limit. The
     *  symbols table has ~52k rows, so page 1 + page 2 covers everything. */
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pageSize = args.pageSize ?? 32000;
    const page = args.page ?? 1;
    const skip = (page - 1) * pageSize;

    // Convex doesn't support .skip() — workaround: take(skip + pageSize)
    // and slice off the head. For our two-page scan this keeps each call
    // under the 32k read limit.
    const window = await ctx.db.query("symbols").take(skip + pageSize);
    const slice = window.slice(skip);

    const re = args.contains
      ? new RegExp(args.contains, "i")
      : null;

    const filtered = slice
      .filter((s) => (s.words.en ?? "").includes(" "))
      .filter((s) => (re ? re.test(s.words.en ?? "") : true))
      .map((s) => ({ _id: s._id, en: s.words.en }))
      .sort((a, b) => (a.en ?? "").length - (b.en ?? "").length);

    const items = filtered.slice(0, 5000);
    return {
      page,
      pageSize,
      sliceLength: slice.length,
      multiWordCount: filtered.length,
      returned: items.length,
      items,
    };
  },
});

/**
 * Batch-fetch symbols by exact word labels (en).
 * Uses the by_words_en index for O(1) per word.
 * Returns only found symbols — missing words are silently skipped.
 * Used by TalkerDropdown to load real images and audio for little-words groups.
 */
export const getSymbolsByWords = query({
  args: { words: v.array(v.string()) },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.words.map((word) =>
        ctx.db
          .query("symbols")
          .withIndex("by_words_en", (q) => q.eq("words.en", word))
          .first()
      )
    );
    return results.filter((s): s is NonNullable<typeof s> => s !== null);
  },
});
