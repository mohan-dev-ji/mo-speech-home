/**
 * Cache identity — the guard on `imageSearchCache` (MOS-31).
 *
 * ## The problem this exists to prevent
 *
 * `imageSearchCache` keys on *content* (the query) but historically carried
 * nothing about *the code that produced the cached content*. So when the
 * producing code was fixed, the cache kept serving pre-fix results and the
 * bug looked unfixed. This bit on 2026-08-23: the cache stores fully-resolved
 * `fullImageUrl`s and the route returns hits without calling the provider at
 * all. After the MOS-8 Wikimedia fix shipped, a repeat search returned the
 * pre-fix URLs — the corrected provider code never ran. Only invalidation was
 * a 24h TTL.
 *
 * ## The pattern
 *
 * Every cached row records the identity of the code that produced it, and a
 * lookup whose stored identity does not match the current identity is a MISS.
 * `IMAGE_SEARCH_CACHE_VERSION` lives as a column on the row, compared in
 * `lookupSearch`, which returns null on a mismatch — the search cache's
 * results are cheap, TTL'd, and replaced in place, so the identity can live
 * on the row rather than in a key.
 *
 * (A second cache, for AI-generated images, used to share this file and this
 * guard — its identity lived *inside* the key, because generated images were
 * permanent and expensive. ADR-023 deleted that cache; only the search
 * cache's guard remains.)
 *
 * ## Bump procedure
 *
 * ONE LINE, in this file. Nothing else to run — no wipe mutation, no manual
 * step. The next lookup misses and the cache repopulates from live code.
 *
 *  - Changed what the image-search providers *store* in a cached result
 *    (`fullImageUrl` resolution, thumbnail sizing, a new/removed field,
 *    provider set)? → increment `IMAGE_SEARCH_CACHE_VERSION` below.
 *
 * After a bump, the now-unreachable rows are dead storage. Enumerate them
 * with `node --env-file=.env.local scripts/sweep-cache-orphans.mjs` — read-only,
 * it prints what a sweep would remove and never deletes anything.
 */

/**
 * Identity of the image-search provider code. Stamped onto `imageSearchCache`
 * rows by `imageCache.writeSearch`, compared by `imageCache.lookupSearch`.
 *
 * A row with no `cacheVersion` at all was written before this guard existed
 * (i.e. by the pre-MOS-8 Wikimedia provider) and is treated as a mismatch.
 *
 * BUMP THIS whenever a change to `lib/image-providers/*` alters what ends up
 * in a cached result. See the bump procedure above.
 */
export const IMAGE_SEARCH_CACHE_VERSION = 2;
