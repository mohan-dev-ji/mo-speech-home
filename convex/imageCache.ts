import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const resultValidator = v.object({
  pageId: v.number(),
  title: v.string(),
  thumbnailUrl: v.string(),
  sourceUrl: v.string(),
  attribution: v.string(),
  license: v.string(),
  width: v.number(),
  height: v.number(),
  mime: v.string(),
  provider: v.string(),
});

/**
 * Look up cached image-search results for a (query, page) pair.
 * Returns null on miss or expiry — callers fall through to the live provider.
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

    return row.results;
  },
});

/**
 * Persist provider results for a (query, page) pair with a 24h TTL.
 * If a row exists (expired or otherwise), it is replaced — the index has at
 * most one row per (query, page).
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
      });
    } else {
      await ctx.db.insert("imageSearchCache", {
        query: args.query,
        page: args.page,
        results: args.results,
        expiresAt,
      });
    }
  },
});

// ─── AI image cache (Imagen 4 Fast) ──────────────────────────────────────────

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
 */
export const writeAi = mutation({
  args: {
    hash: v.string(),
    prompt: v.string(),
    style: v.string(),
    r2Key: v.string(),
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
