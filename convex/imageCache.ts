import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  AI_IMAGE_MODEL,
  IMAGE_SEARCH_CACHE_VERSION,
  aiImageCacheHashInput,
} from "../lib/cache-identity";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const resultValidator = v.object({
  providerId: v.string(),
  provider: v.string(),
  title: v.string(),
  thumbnailUrl: v.string(),
  fullImageUrl: v.string(),
  sourceUrl: v.string(),
  attribution: v.string(),
  license: v.string(),
  width: v.number(),
  height: v.number(),
  mime: v.string(),
});

/**
 * Look up cached image-search results for a (query, page) pair.
 * Returns null on miss, expiry, or stale identity — callers fall through to
 * the live provider.
 */
export const lookupSearch = query({
  args: { query: v.string(), page: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("imageSearchCache")
      .withIndex("by_query_and_page", (q) =>
        q.eq("query", args.query).eq("page", args.page)
      )
      .unique();

    if (!row) return null;
    if (row.expiresAt <= Date.now()) return null;
    // Identity guard (MOS-31). A row produced by provider code that has since
    // changed is a MISS, exactly like an expired one — otherwise a provider
    // fix stays invisible behind hits for up to the full TTL. `undefined`
    // (written before the guard shipped) never equals the current version, so
    // pre-guard rows fall through too. See lib/cache-identity.ts.
    if (row.cacheVersion !== IMAGE_SEARCH_CACHE_VERSION) return null;

    return row.results;
  },
});

/**
 * Persist provider results for a (query, page) pair with a 24h TTL, stamped
 * with the current provider-code identity.
 * If a row exists (expired, stale or otherwise), it is replaced — the index has
 * at most one row per (query, page).
 */
export const writeSearch = mutation({
  args: {
    query: v.string(),
    page: v.number(),
    results: v.array(resultValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("imageSearchCache")
      .withIndex("by_query_and_page", (q) =>
        q.eq("query", args.query).eq("page", args.page)
      )
      .unique();

    const expiresAt = Date.now() + CACHE_TTL_MS;

    if (existing) {
      await ctx.db.replace(existing._id, {
        query: args.query,
        page: args.page,
        results: args.results,
        expiresAt,
        cacheVersion: IMAGE_SEARCH_CACHE_VERSION,
      });
    } else {
      await ctx.db.insert("imageSearchCache", {
        query: args.query,
        page: args.page,
        results: args.results,
        expiresAt,
        cacheVersion: IMAGE_SEARCH_CACHE_VERSION,
      });
    }
  },
});

// ─── AI image cache (Gemini image family) ────────────────────────────────────

/**
 * Look up a cached AI image by hash. Returns null on miss.
 * No expiry — the AI cache is permanent.
 */
export const lookupAi = query({
  args: { hash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("aiImageCache")
      .withIndex("by_hash", (q) => q.eq("hash", args.hash))
      .unique();

    if (!row) return null;
    return { r2Key: row.r2Key, prompt: row.prompt, style: row.style };
  },
});

/**
 * Persist a freshly generated image. Inserts on miss; replaces on (rare) race.
 *
 * `model` is the caller's generator id. It is already baked into `hash` (that
 * is this cache's identity guard — see lib/cache-identity.ts); it is passed
 * explicitly rather than read from the constant here so the stored value can
 * never disagree with the hash the caller actually used. Optional so a route
 * deployed ahead of this function still writes a valid row.
 */
export const writeAi = mutation({
  args: {
    hash: v.string(),
    prompt: v.string(),
    style: v.string(),
    r2Key: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiImageCache")
      .withIndex("by_hash", (q) => q.eq("hash", args.hash))
      .unique();

    if (existing) {
      // Race: another concurrent request landed first. Keep the existing row
      // (its r2Key is already referenced by the response that won the race) and
      // bump hits so this generation isn't lost from analytics.
      await ctx.db.patch(existing._id, { hits: existing.hits + 1 });
      return;
    }

    await ctx.db.insert("aiImageCache", {
      hash: args.hash,
      prompt: args.prompt,
      style: args.style,
      r2Key: args.r2Key,
      hits: 0,
      model: args.model,
    });
  },
});

/**
 * Increment the hit counter on a cached entry. Called from the route on a
 * cache hit so the hits counter stays free of side-effects in the query.
 */
export const recordAiHit = mutation({
  args: { hash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("aiImageCache")
      .withIndex("by_hash", (q) => q.eq("hash", args.hash))
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, { hits: row.hits + 1 });
  },
});

// ─── Orphan sweep (read-only) ────────────────────────────────────────────────

/**
 * Read-only census of both image caches for the orphan sweep (MOS-31).
 *
 * Returns the *current* cache identity alongside every row's *stored* identity
 * so the caller can classify each row without duplicating the recipe:
 *
 *  - `imageSearchCache`: compare `cacheVersion` to
 *    `identity.imageSearchCacheVersion`; a mismatch (including `undefined`) is
 *    a row `lookupSearch` can never return again.
 *  - `aiImageCache`: SHA-256 `hashInput` and compare to `hash`. `hashInput` is
 *    built here from the row's own prompt/style via the shared
 *    `aiImageCacheHashInput`, so it is the key this row WOULD have today. A
 *    mismatch means the key can no longer be produced — `lookupAi` can never
 *    reach the row again.
 *
 * Deliberately returns `resultCount`/`providers` rather than the cached
 * `results` arrays: a single search row holds ~20-40 fully-populated results
 * and the sweep only needs to describe rows, not reproduce them.
 *
 * `.collect()` on both tables is safe at this scale — `imageSearchCache` is
 * TTL'd to a day of searches and `aiImageCache` holds one row per distinct
 * (model, style, prompt). Revisit if either ever grows past a few thousand.
 *
 * Internal: driven by `scripts/sweep-cache-orphans.mjs` via the Convex CLI,
 * which has no caller identity. Run:
 *   npx convex run imageCache:listCacheRowsForSweep '{}' --no-push
 */
export const listCacheRowsForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    const searchRows = await ctx.db.query("imageSearchCache").collect();
    const aiRows = await ctx.db.query("aiImageCache").collect();

    return {
      identity: {
        imageSearchCacheVersion: IMAGE_SEARCH_CACHE_VERSION,
        aiImageModel: AI_IMAGE_MODEL,
      },
      now: Date.now(),
      imageSearch: searchRows.map((row) => ({
        _id: row._id,
        query: row.query,
        page: row.page,
        expiresAt: row.expiresAt,
        cacheVersion: row.cacheVersion,
        resultCount: row.results.length,
        providers: [...new Set(row.results.map((r) => r.provider))].sort(),
      })),
      aiImage: aiRows.map((row) => ({
        _id: row._id,
        hash: row.hash,
        prompt: row.prompt,
        style: row.style,
        r2Key: row.r2Key,
        hits: row.hits,
        model: row.model,
        hashInput: aiImageCacheHashInput(row.style, row.prompt),
      })),
    };
  },
});
