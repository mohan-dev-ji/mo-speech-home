import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { resolveSymbolAudioPath } from "../lib/audio/resolveAudioPath";

type ResolveResult =
  | { source: "symbolstix"; englishWord: string; audioBasename?: string }
  | { source: "ttsCache"; r2Key: string }
  | { source: "none" };

/**
 * Shared resolution used by `lookup` (the /api/tts entry point) and `checkMany`
 * (the authoring availability signal). Checks SymbolStix seeded audio first
 * (free), then the global `ttsCache`, else "none". Index reads only — no R2
 * HEAD; the seeded boolean flag is trusted (same optimism as before).
 *
 * Per ADR-009 §4: audio paths are convention-resolved by the audio resolver
 * (`lib/audio/resolveAudioPath.ts`) — never stored on `symbols.audio`.
 * `symbols.audio[voiceId]` is a boolean meaning "this voice has been seeded
 * with a SymbolStix recording for this symbol." Cache key is per-voice.
 */
async function resolveCachedAudio(
  ctx: QueryCtx,
  text: string,
  voiceId: string
): Promise<ResolveResult> {
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
    .withSearchIndex("search_text_en", (q) => q.search("searchText.en", text))
    .take(10);

  const exact = candidates.find(
    (c) => (c.words.en ?? "").toLowerCase().trim() === text
  );
  if (exact) {
    const audioMap = exact.audio as Record<string, boolean>;
    if (audioMap?.[voiceId] === true) {
      return {
        source: "symbolstix",
        englishWord: exact.words.en,
        audioBasename: exact.audioBasename,
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
    return { source: "ttsCache", r2Key: cached.r2Key };
  }

  return { source: "none" };
}

/**
 * Look up a TTS cache entry (entry point for /api/tts).
 *
 * Returns either a resolved R2 path or `source: "none"` to tell the caller
 * to synthesise fresh TTS.
 */
export const lookup = query({
  args: {
    text: v.string(),    // normalised (lowercase, trimmed)
    voiceId: v.string(),
  },
  handler: async (ctx, { text, voiceId }) => resolveCachedAudio(ctx, text, voiceId),
});

/**
 * Batch availability check for the authoring "needs generation for this voice"
 * signal (Phase 8.5). For each text, returns whether audio is already available
 * for the voice (SymbolStix seeded OR cached TTS) and, when available, the
 * ready-to-play `r2Key` so the client can play cached audio SYNCHRONOUSLY
 * inside a tap (gesture-safe on iOS — no /api/tts round-trip needed).
 *
 * Index reads only — cheap for the ~10–50 rows on a Lists/Sentences page.
 * Texts are normalised here (lowercase + trim) exactly like /api/tts, and the
 * returned map is keyed by that normalised text.
 */
export const checkMany = query({
  args: {
    texts: v.array(v.string()),
    voiceId: v.string(),
  },
  // Returns an ARRAY of { text, available, r2Key? } — NOT an object keyed by text.
  // Convex object field names must be non-control ASCII, so a Hindi/Punjabi text
  // (e.g. "मुझे प्यास लगी है") as a key crashes serialization of the query result.
  // Callers rebuild a client-side lookup (JS objects allow non-ASCII keys).
  handler: async (ctx, { texts, voiceId }) => {
    const out: Array<{ text: string; available: boolean; r2Key?: string }> = [];
    const seen = new Set<string>();
    for (const raw of texts) {
      const text = raw.toLowerCase().trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      const res = await resolveCachedAudio(ctx, text, voiceId);
      if (res.source === "ttsCache") {
        out.push({ text, available: true, r2Key: res.r2Key });
      } else if (res.source === "symbolstix") {
        // Convention-resolve the seeded path so a cached tap can play it
        // synchronously. `true` = seeded (flag already confirmed above).
        const key = resolveSymbolAudioPath(
          voiceId,
          res.englishWord,
          true,
          res.audioBasename
        );
        out.push({ text, available: true, r2Key: key ?? undefined });
      } else {
        out.push({ text, available: false });
      }
    }
    return out;
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
