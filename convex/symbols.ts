import { internalMutation, mutation, query } from "./_generated/server";
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
 * Mark a batch of symbols as seeded for a voice — flips `symbols.audio[voiceId]`
 * to `true`. Used by `scripts/seed-voice-audio.mjs` (Phase 8.4) after each
 * symbol's audio is uploaded to R2. Batched to keep Convex function-call count
 * low across a ~58k-symbol seed run. Seed/admin use only.
 *
 * Migration-safe: rebuilds the audio value from existing boolean entries only,
 * dropping any legacy `{ eng: { default } }` shape, so the patched value always
 * satisfies `v.record(string, boolean)`.
 */
export const setVoiceSeededBatch = mutation({
  args: { symbolIds: v.array(v.id("symbols")), voiceId: v.string() },
  handler: async (ctx, { symbolIds, voiceId }) => {
    let updated = 0;
    for (const id of symbolIds) {
      const sym = await ctx.db.get(id);
      if (!sym) continue;
      const existing = (sym.audio ?? {}) as Record<string, unknown>;
      const next: Record<string, boolean> = {};
      for (const [k, val] of Object.entries(existing)) {
        if (typeof val === "boolean") next[k] = val;
      }
      next[voiceId] = true;
      await ctx.db.patch(id, { audio: next });
      updated += 1;
    }
    return { updated };
  },
});

/**
 * Language-aware full-text symbol search.
 *
 * Uses the correct search index for the active language, searching the
 * combined `searchText.<code>` surface (word + synonyms + transliterations),
 * not the bare `words.<code>` — so "kutta" matches कुत्ता (ADR-009 §9):
 *   "en" → search_text_en (searchText.en field)
 *   "hi" → search_text_hi (searchText.hi field)
 *   "es" → search_text_es (searchText.es field)
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

    // Per ADR-009 §6.6: Convex search indexes are static, so each
    // searchable language needs its own `searchIndex(...)` declared in
    // `convex/schema.ts`. New languages added to the registry but without
    // a search index here will fall through to the English index (so
    // typing in English still works during the machine-translation
    // window before promotion-to-stable adds the index).
    if (language === "hi") {
      return ctx.db
        .query("symbols")
        .withSearchIndex("search_text_hi", (q) =>
          q.search("searchText.hi", searchTerm)
        )
        .take(limit);
    }

    if (language === "es") {
      return ctx.db
        .query("symbols")
        .withSearchIndex("search_text_es", (q) =>
          q.search("searchText.es", searchTerm)
        )
        .take(limit);
    }

    return ctx.db
      .query("symbols")
      .withSearchIndex("search_text_en", (q) =>
        q.search("searchText.en", searchTerm)
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

/**
 * Paginated dump of the full `symbols` table — drives
 * `scripts/backup-symbols.mjs`. The whole table is too large (~16 MB raw
 * JSON, 52k rows) to return in a single query call, so the script paginates
 * with 2000-row pages until `isDone: true`.
 *
 * Ordering is ascending by `_id` so that two backups taken at different
 * times produce a stable line ordering — that's what makes the resulting
 * JSONL files diff cleanly in git and lets git's pack-file delta
 * compression dedupe identical lines across snapshots.
 *
 * Public query — backups are intended to run from a local CLI / CI
 * environment with no auth context. Symbol data is global / non-sensitive
 * (SymbolStix is the upstream licensor, not user data).
 */
export const dumpSymbolsPage = query({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, pageSize = 2000 }) => {
    const result = await ctx.db
      .query("symbols")
      .order("asc")
      .paginate({
        numItems: pageSize,
        cursor: cursor ?? null,
      });
    return {
      symbols: result.page,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Phase 8.2 — read a page of symbols that still need translating into
 * `slug`. Internal: called from `translationActions.translateSymbolsBatch`
 * to drive the cursor-based loop.
 *
 * Returns up to `pageSize` rows where `words[slug]` is missing or empty
 * — already-translated rows are filtered server-side so the action
 * spends its time-budget on real work, not skip-then-discard cycles.
 *
 * NOTE: filtering happens in JS after the page fetch (no index on
 * "missing field"), so this DOES scan `pageSize` rows even when most
 * are translated. The Phase 8.2 loop accepts the inefficiency on
 * partial re-runs in exchange for not adding a "needsTranslation"
 * denormalised flag per symbol per language.
 */
export const fetchUntranslatedPage = internalMutation({
  args: {
    slug: v.string(),
    cursor: v.union(v.string(), v.null()),
    pageSize: v.number(),
  },
  handler: async (ctx, { slug, cursor, pageSize }) => {
    const result = await ctx.db
      .query("symbols")
      .order("asc")
      .paginate({ numItems: pageSize, cursor });

    // Filter to symbols missing this language. We do this server-side
    // so the action's outbound payload stays small.
    const needsTranslation = result.page.filter((sym) => {
      const words = sym.words as Record<string, string | undefined>;
      const existing = words[slug];
      return typeof existing !== "string" || existing.length === 0;
    });

    return {
      page: needsTranslation.map((sym) => ({
        _id: sym._id,
        wordsEn: sym.words.en,
      })),
      // Number of rows in the raw page (used by the action to advance the
      // cursor even when every row in the page is already translated).
      rawPageSize: result.page.length,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Phase 8.2 — patch one Gemini batch's results into the `symbols` table.
 * Internal: only called by `translationActions.translateSymbolsBatch`.
 *
 * Each entry overwrites `words[slug]` and `synonyms[slug]` for one row.
 * Existing keys in other languages are preserved (the spread is
 * destructive only on the target language slot).
 *
 * Up to 100 patches per call by design — matches the Gemini batch size.
 * Each patch is ~50 bytes so 100 fits comfortably inside Convex's per-
 * mutation budget (1s execution, 16 MB total writes).
 */
export const applyTranslationsBatch = internalMutation({
  args: {
    slug: v.string(),
    entries: v.array(
      v.object({
        symbolId: v.id("symbols"),
        word: v.string(),
        synonyms: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, { slug, entries }) => {
    let patched = 0;
    for (const entry of entries) {
      const sym = await ctx.db.get(entry.symbolId);
      if (!sym) continue; // row vanished between read + write — skip silently
      const nextWords = {
        ...(sym.words as Record<string, string>),
        [slug]: entry.word,
      };
      const nextSynonyms = {
        ...((sym.synonyms ?? {}) as Record<string, string[]>),
        [slug]: entry.synonyms,
      };
      // Keep the indexed search surface in sync: word + all synonyms /
      // transliterations joined into one string (see schema `symbolSearchText`
      // + `search_text_<code>`). Mirrors `migrations.backfillSearchText`.
      const nextSearchText = {
        ...((sym.searchText ?? {}) as Record<string, string>),
        [slug]: [entry.word, ...entry.synonyms]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(" "),
      };
      await ctx.db.patch(entry.symbolId, {
        words: nextWords,
        synonyms: nextSynonyms,
        searchText: nextSearchText,
      });
      patched++;
    }
    return { patched };
  },
});
