import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { IMAGE_SEARCH_CACHE_VERSION } from "../lib/cache-identity";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const resultValidator = v.object({
  providerId: v.string(),
  provider: v.string(),
  title: v.string(),
  thumbnailUrl: v.string(),
  // Optional: Wikimedia results omit it — the proxy resolves their save URL
  // from `providerId` (the pageid). See lib/image-providers/types.ts.
  fullImageUrl: v.optional(v.string()),
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

// ─── Orphan sweep (read-only) ────────────────────────────────────────────────

/**
 * Read-only census of the image-search cache for the orphan sweep (MOS-31).
 *
 * Returns the *current* cache identity alongside every row's *stored*
 * `cacheVersion` so the caller can classify each row without duplicating the
 * recipe: compare `cacheVersion` to `identity.imageSearchCacheVersion`; a
 * mismatch (including `undefined`) is a row `lookupSearch` can never return
 * again.
 *
 * Deliberately returns `resultCount`/`providers` rather than the cached
 * `results` arrays: a single search row holds ~20-40 fully-populated results
 * and the sweep only needs to describe rows, not reproduce them.
 *
 * `.collect()` is safe at this scale — `imageSearchCache` is TTL'd to a day
 * of searches. Revisit if it ever grows past a few thousand rows.
 *
 * Internal: driven by `scripts/sweep-cache-orphans.mjs` via the Convex CLI,
 * which has no caller identity. Run:
 *   npx convex run imageCache:listCacheRowsForSweep '{}' --no-push
 */
export const listCacheRowsForSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    const searchRows = await ctx.db.query("imageSearchCache").collect();

    return {
      identity: {
        imageSearchCacheVersion: IMAGE_SEARCH_CACHE_VERSION,
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
    };
  },
});
