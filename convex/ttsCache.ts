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
  voiceId: string,
  tone?: string,
  // `skipSymbolstix` (Variant Lifecycle Stage 2 perf): literal requests bypass the
  // SymbolStix default lookup so a KNOWN word (e.g. "breakfast") still resolves the
  // cached literal TTS clip instead of short-circuiting at symbolstix + regenerating.
  skipSymbolstix?: boolean,
): Promise<ResolveResult> {
  // ANY requested tone — including the emoji row's "neutral" — is a fluent
  // Gemini clip with its own cache key. Only the tone-LESS path (▶ replay,
  // library playback) is the free Wavenet voice; that pins tone=undefined so
  // the index prefix matches legacy (untoned) rows exactly.
  const viaGemini = !!tone;
  const toneKey = viaGemini ? tone : undefined;

  // SymbolStix seeded audio is the neutral cheap voice only — skip it for any
  // requested tone (a Gemini clip is never seeded).
  if (!viaGemini && !skipSymbolstix) {
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
  }

  // Check global TTS cache — keyed by (text, voiceId, tone). The tone-less
  // path pins tone === undefined, matching legacy rows.
  const cached = await ctx.db
    .query("ttsCache")
    .withIndex("by_text_voice_tone", (q) =>
      q.eq("text", text).eq("voiceId", voiceId).eq("tone", toneKey)
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
    tone: v.optional(v.string()), // absent = free Wavenet/seeded; present (incl. 'neutral') = Gemini clip
    skipSymbolstix: v.optional(v.boolean()), // literal requests: bypass SymbolStix so cached literal clip resolves
  },
  handler: async (ctx, { text, voiceId, tone, skipSymbolstix }) =>
    resolveCachedAudio(ctx, text, voiceId, tone, skipSymbolstix),
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
 *
 * NOTE (2026-07-19): today all three consumers read only `.available` (a status
 * badge) — the `r2Key` is deliberately NOT yet fed into playback. Wiring it in to
 * skip the /api/tts round-trip is a *latency* win only (the round-trip is a cache
 * HIT, no paid-API cost), and it is NOT a safe drop-in: this query resolves with
 * `(text, voiceId)` — no `skipSymbolstix`, no tone — so its `r2Key` mismatches the
 * play surfaces in three ways. (1) A literal single-word item resolves the
 * SymbolStix *translated default* here, not the literal clip → playing it would
 * regress board-accent literal-TTS. (2) A toned (Gemini) play needs the tone-keyed
 * clip, not this tone-less one. (3) `PersistentTalker` resolves a phrase's voice
 * from its own language, which can differ from this `voiceId`. Any future wiring
 * must guard per-surface (skip on literal single-word / on tone / on voice
 * mismatch) — see the audit in the phase-15.6 tts-cache plan.
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
    tone: v.optional(v.string()), // omitted for neutral (legacy-compatible rows)
    r2Key: v.string(),
    charCount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Tone-less (free Wavenet) rows pin tone === undefined to match legacy
    // rows; every Gemini clip stores its tone, including "neutral".
    const toneKey = args.tone || undefined;

    // Race condition guard — another request may have written first
    const existing = await ctx.db
      .query("ttsCache")
      .withIndex("by_text_voice_tone", (q) =>
        q.eq("text", args.text).eq("voiceId", args.voiceId).eq("tone", toneKey)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("ttsCache", {
      text: args.text,
      voiceId: args.voiceId,
      ...(toneKey ? { tone: toneKey } : {}),
      r2Key: args.r2Key,
      charCount: args.charCount,
    });
  },
});
