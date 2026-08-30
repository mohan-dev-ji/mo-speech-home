import { STYLE_PRESETS, isStyleId } from "./ai-style-prompts";

/**
 * Cache identity — one guard, shared by both image caches (MOS-31).
 *
 * ## The problem this exists to prevent
 *
 * `imageSearchCache` and `aiImageCache` both key on *content* (the query, or
 * the prompt) but historically carried nothing about *the code that produced
 * the cached content*. So when the producing code was fixed, the cache kept
 * serving pre-fix results and the bug looked unfixed. This bit twice on
 * 2026-08-23:
 *
 *  - `imageSearchCache` stores fully-resolved `fullImageUrl`s and the route
 *    returns hits without calling the provider at all. After the MOS-8
 *    Wikimedia fix shipped, a repeat search returned the pre-fix URLs — the
 *    corrected provider code never ran. Only invalidation was a 24h TTL.
 *  - `aiImageCache` was keyed `sha256(style|prompt)` with no model component,
 *    so Imagen-era and Gemini-era images collided under one hash.
 *
 * ## The shared pattern
 *
 * Every cached row records the identity of the code that produced it, and a
 * lookup whose stored identity does not match the current identity is a MISS.
 * The two caches express it in the two possible places, for reasons below,
 * but it is the same mechanism and the same one-line bump:
 *
 * | cache              | identity            | where it lives | mismatch ⇒ |
 * |--------------------|---------------------|----------------|------------|
 * | `imageSearchCache` | `IMAGE_SEARCH_CACHE_VERSION` | a column on the row | compared in `lookupSearch`, returns null |
 * | `aiImageCache`     | `AI_IMAGE_MODEL`    | inside the key | the key is unreachable, so lookup misses by construction |
 *
 * The AI cache puts its identity *in the key* (shipped in `0c26d70`) because
 * generated images are permanent and expensive: a stale-identity row must stay
 * addressable-but-unmatched rather than be overwritten. The search cache puts
 * its identity *on the row* because search results are cheap, TTL'd, and
 * replaced in place.
 *
 * ## Bump procedure
 *
 * ONE LINE, in this file. Nothing else to run — no wipe mutation, no manual
 * step. The next lookup misses and the cache repopulates from live code.
 *
 *  - Changed what the image-search providers *store* in a cached result
 *    (`fullImageUrl` resolution, thumbnail sizing, a new/removed field,
 *    provider set)? → increment `IMAGE_SEARCH_CACHE_VERSION` below.
 *  - Changed the AI image model? → change `AI_IMAGE_MODEL` below.
 *
 * After either bump, the now-unreachable rows are dead storage. Enumerate them
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

/**
 * Identity of the AI image generator. Part of the `aiImageCache` key (see
 * `aiImageCacheHashInput`) and stamped onto the row by `imageCache.writeAi`.
 *
 * Google retired the Imagen publisher models from Vertex (confirmed 2026-08:
 * zero `^imagen` models under publishers/google/models across us-central1,
 * europe-west1/2/4, and global). Image generation now lives in the Gemini
 * image family.
 *
 * CHANGE THIS for the next retirement — it is the model swap point *and* the
 * cache identity in one. Note the request/response shape in
 * `app/api/ai-generate/imagen/route.ts` is Gemini's `:generateContent`
 * contract and will need to move too if a future model changes it.
 */
export const AI_IMAGE_MODEL = "gemini-2.5-flash-image";

/**
 * The exact string that gets SHA-256'd into an `aiImageCache.hash`.
 *
 * Single source of truth on purpose: the route hashes it to look a row up, and
 * `imageCache.listCacheRowsForSweep` returns it per row so the sweep script can
 * re-derive each row's *current* key and find the rows whose key can no longer
 * be produced. If this recipe lived in two places, the sweep would silently
 * misclassify the moment they drifted.
 */
export function aiImageCacheHashInput(style: string, prompt: string): string {
  const normalised = prompt.toLowerCase().trim();
  // THE TEMPLATE IS PART OF THE IDENTITY (MOS-46). It used to hash the RAW
  // prompt, so the key described the ingredients but not the recipe — and the
  // recipe is what reaches the provider. Editing a template then had no effect
  // on anyone who had already generated that subject in that style: they kept
  // being served the image the OLD wording produced, forever, with no way to
  // tell. That is MOS-31's bug in a different cache.
  //
  // `AI_IMAGE_MODEL` above already invalidates on a model swap — the gap was
  // specifically template edits, which are the FREQUENT change. Wrapping here
  // closes it: any edit to a template changes every key that uses it.
  //
  // An unknown style (a row written before a style was renamed or removed)
  // falls back to the bare prompt. It cannot be wrapped, and it should not
  // silently collide with a valid style's key either — the `style` segment
  // keeps them apart, and the sweep will report it as unreachable, which is
  // the correct outcome for a row whose style no longer exists.
  const preset = isStyleId(style) ? STYLE_PRESETS[style] : undefined;
  const recipe = preset ? preset.template(normalised) : normalised;
  return `${AI_IMAGE_MODEL}|${style}|${recipe}`;
}
