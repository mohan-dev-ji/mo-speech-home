import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Look up a TTS cache entry.
 * Checks the symbols table first (free SymbolStix audio), then ttsCache.
 * Returns enough info for the Next.js route to resolve the R2 key or decide to generate.
 */
export const lookup = query({
  args: {
    text: v.string(),    // normalised (lowercase, trimmed)
    voiceId: v.string(),
  },
  handler: async (ctx, { text, voiceId }) => {
    // Check if text exactly matches a SymbolStix word
    const symbol = await ctx.db
      .query("symbols")
      .withIndex("by_words_eng", (q) => q.eq("words.eng", text))
      .first();

    if (symbol) {
      return {
        source: "symbolstix" as const,
        audioDefault: symbol.audio.eng.default,
      };
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
