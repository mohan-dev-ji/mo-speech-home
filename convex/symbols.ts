import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Batch insert for seeding — dev/admin use only.
 * Accepts the new schema shape (words.eng, synonyms.eng, etc.).
 * TODO: convert to internalMutation before production launch.
 */
export const batchInsertSymbols = mutation({
  args: {
    symbols: v.array(
      v.object({
        words: v.object({ eng: v.string(), hin: v.optional(v.string()) }),
        synonyms: v.optional(
          v.object({
            eng: v.optional(v.array(v.string())),
            hin: v.optional(v.array(v.string())),
          })
        ),
        imagePath: v.string(),
        audio: v.object({
          eng: v.object({ default: v.string() }),
          hin: v.optional(v.object({ default: v.string() })),
        }),
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
 *   "eng" → search_words_eng (words.eng field)
 *   "hin" → search_words_hin (words.hin field)
 *
 * Returns [] immediately when searchTerm is blank — the client
 * skips calling this when blank, but the guard is defensive.
 *
 * Never hard-code "eng" as a default — always pass the language from
 * ProfileContext. The fallback to eng index is only for unknown codes.
 */
export const searchSymbols = query({
  args: {
    searchTerm: v.string(),
    language: v.string(), // "eng" | "hin" — open-ended, never cast to a fixed union
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { searchTerm, language, limit = 20 } = args;

    if (!searchTerm.trim()) return [];

    if (language === "hin") {
      return ctx.db
        .query("symbols")
        .withSearchIndex("search_words_hin", (q) =>
          q.search("words.hin", searchTerm)
        )
        .take(limit);
    }

    return ctx.db
      .query("symbols")
      .withSearchIndex("search_words_eng", (q) =>
        q.search("words.eng", searchTerm)
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
 * the eng label and id — keeps the payload small.
 */
export const listMultiWordEng = query({
  args: {
    /** Optional regex filter (case-insensitive) applied to words.eng. Used
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
      .filter((s) => s.words.eng.includes(" "))
      .filter((s) => (re ? re.test(s.words.eng) : true))
      .map((s) => ({ _id: s._id, eng: s.words.eng }))
      .sort((a, b) => a.eng.length - b.eng.length);

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
 * Batch-fetch symbols by exact word labels (eng).
 * Uses the by_words_eng index for O(1) per word.
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
          .withIndex("by_words_eng", (q) => q.eq("words.eng", word))
          .first()
      )
    );
    return results.filter((s): s is NonNullable<typeof s> => s !== null);
  },
});
