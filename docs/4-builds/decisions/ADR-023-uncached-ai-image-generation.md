# ADR-023 — AI image generation is uncached

**Status:** accepted
**Date:** 2026-08-31
**Supersedes:** the AI half of `lib/cache-identity.ts` (MOS-31) and the template-in-key fix (MOS-46) — both correct, for a cache that this ADR removes
**Related:** ADR-005 (symbol editor: image search + AI generate) · ADR-022 (module asset promotion — `ai-cache/` passthrough) · MOS-48 · MOS-47 (the tab UI built on top of this)

## Context

`aiImageCache` stored **one image per `(model, style, template, prompt)`**, forever, globally. Generate `wolf` in 3D Claymation twice and you got the identical wolf — for all users, for all time. That is not a bug in the cache; it is the cache working. The assumption underneath it — *one prompt means one image* — is what turned out to be wrong.

Every other AI image tool re-rolls: same prompt, new result, keep going until one is good. An AAC instructor picking artwork for a child's board needs exactly that, and could not have it.

### What the live data said

A read-only census (`scripts/sweep-cache-orphans.mjs`, 2026-08-31) of the production table:

| measure | value |
|---|---|
| rows | 48 |
| total hits | 22 |
| rows with ≥1 hit | 17 |
| rows already unreachable (Imagen-era + pre-MOS-46 keys) | **38 of 48** |

The hit counter does not measure what its name suggests. The most-hit row in the table is `wolf | claymation | 4 hits` — one person pressing Generate four times wanting a different wolf. **The cache's success metric was counting the frustration that MOS-48 exists to fix.** Strip those out and cross-account reuse is indistinguishable from zero.

That is not an accident of low usage. It is structural. MOS-47 defines this feature as being for *tangible, generic objects absent from SymbolStix and unfindable by image search* — the long tail, by construction. A cache keyed on free text pays off only when two people type the same string, and the feature exists precisely for the strings nobody else will type. The stored prompts bear it out: "An outdoor park gym", "A white school bus used in the uk for children with disabilities", "make cute cuddly version of the hindu god shiva".

Meanwhile 38 of 48 rows had already gone unreachable twice in a month (the Imagen retirement, then the MOS-46 re-key) and nothing got worse. That is a natural experiment in "what if there were no cache", already run, with a null result.

### Two costs the cache was carrying quietly

**Privacy.** `aiImageCache` is global and keyed on user-authored text. One family's generated image is served to another family. Today that includes religious subjects. Tomorrow somebody types a description of their own child and that image becomes the canonical result of that sentence for every other account. Nothing else in this app shares user content across accounts — the adopted copy is account-scoped under `accounts/<id>/images/…`; only the cache was shared.

**Storage.** One ~880KB PNG per generation under `ai-cache/`, never deleted, ~79% of it already dead.

### The economics

Max is £14.99/mo (~£14.57 net of Stripe). A generation costs roughly $0.039 (≈£0.031) on `gemini-2.5-flash-image` — **confirm against the actual Vertex bill before treating this as load-bearing.**

The decisive observation: the cache does nothing about the expensive user. Someone burning their whole allowance is typing unique strings, so every one of them is a miss. The cache only ever protected against *repeats* — the exact thing this feature now needs to charge for.

## Decision

**Remove the shared cache. Every Generate is a live provider call, and quota is the only limiter.**

Re-generation then needs no implementation at all: `gemini-2.5-flash-image` is non-deterministic and no seed is pinned, so the same prompt already returns a different image. The cache was the only reason it didn't.

1. **`aiImageCache` is deleted** — table, `lookupAi` / `writeAi` / `recordAiHit`, the `aiImage` branch of `listCacheRowsForSweep`, the `rehashAiImageCache` migration, and `aiImageCacheHashInput`. `lib/cache-identity.ts` survives as the image-**search** cache's guard only.
2. **`AI_IMAGE_MODEL` moves to `lib/ai-style-prompts.ts`.** It was doing two jobs — model id and cache identity — and only one remains. Its new home is beside the four templates, which are verified against that model and only that model (MOS-40); model and prompts should now move together or not at all.
3. **The request-path R2 upload goes.** Every generation was uploaded to `ai-cache/{uuid}.png` and its key returned as `X-R2-Key` — a header nothing reads (verified by grep, 2026-08-31; the tab uses `res.blob()` and ignores the response headers entirely). With no cache to feed, the upload has no consumer. The bytes go straight to the client and R2 is touched only when the user adopts an image.
4. **Two meters replace one: 20/day and 100/month.** The month is the real budget — matching how the feature is actually used, a burst while setting up a board and then nothing for weeks — and the day is a runaway guard. Once a monthly ceiling exists the daily cap is free to be generous, because the month bounds the spend either way.
5. **A session reel replaces the cache's accidental memory.** Generated images are held in the tab's own state for the editing session so nothing already paid for is lost mid-task. MOS-47 builds the controls on top.

### Why not a variant list (`hash` → N images + per-user cursor)

The obvious alternative, and the one MOS-48 opened with. It buys free re-rolls on a prompt someone has already generated — the event the census says does not happen. In exchange: variant ordering, a per-(user, hash) cursor, cursor invalidation on template edits, N× storage, and a *sharper* version of the privacy problem, since user B's first-choice image becomes user A's rejects in A's chosen order. More machinery than the null option, for a saving the evidence does not support.

A per-account variant list (privacy fixed, modest win) was also considered and rejected as unearned complexity: the images an instructor actually wanted are already saved on their symbols.

## Consequences

**Gained**

- Re-generate behaves as every AI image tool does, with less code than exists today.
- No cross-account sharing of user-derived imagery.
- The whole class of bug MOS-31 and MOS-46 were fighting — a cached artefact outliving the code that produced it — cannot recur. You cannot serve a stale image if you never keep one.
- ~1s off each generation and one fewer failure mode in the request path (the R2 write).
- `ai-cache/` stops growing.

**Lost — accepted deliberately**

- **An image generated and not adopted is gone permanently once the modal closes.** Previously the prompt could be retyped and the cache would return it. The session reel covers this within a session and nothing covers it across sessions. This is the single real regression and it is a decision, not an oversight.
- A repeat prompt now costs ~8s and one credit where it was instant and free. That unfairness cut the other way too: identical users got different value from "10/day" depending on whether a stranger had generated their subject first.
- The `prompt` column's analytics value goes with the table. Replaced by PostHog events that deliberately carry style and counts but never prompt text.

**Existing data**

`ai-cache/` R2 objects are **kept, not deleted** — the 2026-08-24 owner decision (imagery retained for the storybook module) stands, and legacy `profileSymbols` rows may still carry `ai-cache/…` image paths from before adoption re-uploaded into the account namespace. The Convex rows go; the pictures stay. `isPersonalAssetKey` already refuses to delete anything outside `accounts/` and `profiles/`, so no delete path can reach them.

**Falsified by this ADR**

`getProfileSymbolDeleteOrphanKeys` (`convex/profileSymbols.ts`) and `getCategoryReloadOrphanKeys` (`convex/profileCategories.ts`) both skip `aiGenerated` images on the stated grounds that they "live in shared `ai-cache/`". That has been untrue since adoption started re-uploading to `accounts/<id>/images/<uuid>.webp` (Phase 29), and after this ADR there is no shared object at all. Every deleted AI symbol therefore strands its image. Tracked separately — it is a pre-existing orphan bug, not one this change introduces.
