import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Look up a TTS cache entry.
 *
 * Checks the symbols table first (free SymbolStix audio), then `ttsCache`.
 * Returns either a resolved R2 path or `source: "none"` to tell the caller
 * to synthesise fresh TTS.
 *
 * Per ADR-009 §4: audio paths are convention-resolved by the audio resolver
 * (`lib/audio/resolveAudioPath.ts`) — never stored on `symbols.audio`.
 * `symbols.audio[voiceId]` is a boolean meaning "this voice has been seeded
 * with a SymbolStix recording for this symbol."
 *
 * Cache key is per-voice (not per-language). The expected cache wipe on
 * the Phase 8.0 deploy is intentional — Phase 8.0 plan notes this.
 */
export const lookup = query({
  args: {
    text: v.string(),    // normalised (lowercase, trimmed)
    voiceId: v.string(),
  },
  handler: async (ctx, { text, voiceId }) => {
    // Match against SymbolStix case-insensitively. The exact-match index
    // (by_words_en) is case-sensitive — "pringles" wouldn't find "Pringles" —
    // so we hit the tokenised search index and confirm a result's label
    // matches when lowercased. Confirmation guards against false positives
    // ("apple" → "Apple Pie") that the search index would otherwise rank.
    //
    // Take a small batch instead of just `.first()`: the relevance ranker can
    // surface a longer/multi-word symbol above the exact single-word match
    // (e.g. searching "shiva" might rank "Shiva Goddess" first), and stopping
    // at the top result would cause us to miss a perfectly valid SymbolStix
    // recording and fall through to fresh TTS synthesis.
    const candidates = await ctx.db
      .query("symbols")
      .withSearchIndex("search_words_en", (q) => q.search("words.en", text))
      .take(10);

    const exact = candidates.find(
      (c) => (c.words.en ?? "").toLowerCase().trim() === text
    );
    if (exact) {
      // `audio` is a voice-keyed boolean map post-migration. Some legacy rows
      // may briefly carry the migration-union shape until the migration runs;
      // both paths are handled defensively here.
      const audioMap = exact.audio as Record<string, unknown>;
      const seeded =
        audioMap?.[voiceId] === true ||
        // Legacy union shape during migration window
        (voiceId === "en-GB-News-M" && typeof audioMap?.eng === "object");

      if (seeded) {
        return {
          source: "symbolstix" as const,
          // The route handler resolves the final R2 path via
          // lib/audio/resolveAudioPath.ts using this English word.
          englishWord: exact.words.en,
        };
      }
    }

    // Check global TTS cache
    const cached = await ctx.db
      .query("ttsCache")
      .withIndex("by_text_voice", (q) =>
        q.eq("text", text).eq("voiceId", voiceId)
      )
      .first();

    if (cached) {
      return { source: "ttsCache" as const, r2Key: cached.r2Key };
    }

    return { source: "none" as const };
  },
});

/**
 * Write a new TTS cache entry after generation.
 * Requires auth — only called server-side from /api/tts after Clerk verification.
 * Guards against duplicates from concurrent requests.
 */
export const write = mutation({
  args: {
    text: v.string(),
    voiceId: v.string(),
    r2Key: v.string(),
    charCount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Race condition guard — another request may have written first
    const existing = await ctx.db
      .query("ttsCache")
      .withIndex("by_text_voice", (q) =>
        q.eq("text", args.text).eq("voiceId", args.voiceId)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("ttsCache", {
      text: args.text,
      voiceId: args.voiceId,
      r2Key: args.r2Key,
      charCount: args.charCount,
    });
  },
});
