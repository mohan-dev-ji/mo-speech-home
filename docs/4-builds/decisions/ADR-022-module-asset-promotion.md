# ADR-022 — Published modules own their assets

**Status:** accepted
**Date:** 2026-08-22
**Supersedes:** the V1 note in `convex/contentModules/publish.ts` ("assets referenced in place")
**Related:** ADR-010 (pack storage shift), ADR-014 (content modules)

## Context

Publishing a category or folder as a `libraryModules` row serialised its R2 asset
paths verbatim. For an all-SymbolStix catalogue that was harmless: `symbols/…`
is a shared namespace nobody deletes.

It stops being harmless the moment a module carries custom imagery. Those assets
live under `accounts/<admin>/images/…`, and:

- `isPersonalAssetKey` (`convex/lib/contentModuleDelete.ts`) classifies anything
  under `accounts/` or `profiles/` as deletable on uninstall;
- `collectReferencedPersonalKeys` (`convex/lib/personalAssetRefs.ts`) scans only
  ONE account, via `by_account_id`, and never consults `libraryModules`.

So an admin uninstalling their own copy of a module they published deletes the
R2 objects that the published module — and every account that installed it —
still points at. The catalogue silently breaks.

This repo had already solved it once. `promoteAssetsToPackPrefix`, in the
pack-era `app/api/admin/pack-publish/route.ts`, copied account-scoped keys to
`library_packs/<slug>/…` at publish — covering images and all three audio path
fields across categories, lists and sentences. That is why the `space` module's
images survive today while a newly published one would not.

It was removed wholesale in `7083f1a` (Phase 14.5 pack teardown) with the rest
of the pack surface. The teardown deliberately left the R2 data in place and
assumed the module publish path would inherit the promotion step; it never did,
leaving only the "revisit" note at `publish.ts:16`. This ADR actions that note.

## Decision

At publish, copy every personal R2 asset the source references to a
module-scoped shared prefix and write the promoted paths into the module row:

    library_modules/<tree>/<slug>/<kind>/<filename>      kind ∈ {images, audio}

- **Copy, don't move.** The admin's own profile still references the original;
  duplicating costs a few MB and avoids breaking the authoring account.
- **Idempotent.** Re-publishing overwrites the same destination key. Already
  promoted paths are detected and skipped.
- **Non-personal keys pass through untouched** — `symbols/…`, `ai-cache/…`,
  `audio/<voice>/tts/…`, and legacy `library_packs/…`.
- **R2 unconfigured is not a publish failure.** The copy is skipped and paths
  are left alone, matching the prior pack-publish behaviour.
- **A failed copy aborts the publish.** If any individual copy throws,
  `promote-module-assets` reports it in `stats.failed` and the modal throws
  before either publish mutation runs — no module row is written. This
  diverges from the prior art: pack-era `promoteAsset`
  (`7083f1a^:app/api/admin/pack-publish/route.ts`) returned the original path
  on failure and let the publish continue. That's the wrong default here — a
  module row written with even one unpromoted `accounts/…` path is the exact
  bug this ADR exists to prevent, so partial promotion fails loudly instead of
  publishing silently.

Convex mutations cannot perform R2 I/O, so the copy runs in a Clerk-admin-gated
Next.js route (`/api/admin/promote-module-assets`) which the publish modal calls
before the mutation, passing the resulting key mapping in.

## Consequences

- Published modules are self-contained: uninstalling, or deleting the authoring
  account, cannot break them.
- Publishing gets one extra network round trip and one R2 copy per custom asset.
  Negligible for the tens-of-images modules we author.
- Bucket storage roughly doubles for custom-imagery modules (original + promoted).
  Accepted: correctness over a few MB, and the originals are collectable later.
- Modules published BEFORE this ADR keep in-place `accounts/…` paths. Re-publish
  to promote them. Only the three Task 8 modules are affected in practice —
  `space` and the other legacy modules use `library_packs/…` or `symbols/…`.
- `library_packs/` is not migrated. It is a valid shared prefix; churning it
  would invalidate the committed artifact for no benefit.
- A source row whose personal asset no longer exists in R2 (deleted object,
  stale key) makes its copy fail, which now blocks publish entirely until the
  reference is repaired — an operational cost traded for never publishing a
  half-promoted module.

---

## Amendment — 2026-08-24: legacy `library_packs/` keys are promoted too

**Status:** accepted · amends the Decision and Consequences above; the original
text is left intact as the record of what was decided on 2026-08-22.

### What changed

Two statements above are now wrong and are superseded by this amendment:

- Decision, bullet 3: "**Non-personal keys pass through untouched** — `symbols/…`,
  `ai-cache/…`, `audio/<voice>/tts/…`, **and legacy `library_packs/…`**."
  → `library_packs/…` is no longer in that list. It is now **promoted** like a
  personal key. The other three still pass through untouched.
- Consequences, bullet 5: "`library_packs/` is not migrated. It is a valid
  shared prefix; churning it would invalidate the committed artifact for no
  benefit."
  → There is now a benefit: retiring the prefix entirely.

### Why

`space` is the last module still on the pack-era prefix — all 16 of its images
live under `library_packs/space/images/…` (4.1 MB in the folder, 1.94 MB
actually referenced). The owner wants `library_packs/` deleted outright, which
requires `space` to be sitting on `library_modules/` first.

Re-publishing `space` did not achieve that, because promotion refused
non-personal keys at *two* independent layers:

1. `collectSourcePersonalKeys` (`convex/lib/personalAssetRefs.ts`) filtered
   through `isPersonalAssetKey`, so `library_packs/` keys were never even
   *collected* — the promote route never saw them.
2. `/api/admin/promote-module-assets` re-checked the same two prefixes and
   skipped anything else.

Both layers now use a wider predicate, so re-publishing `space` copies its 16
images to `library_modules/categories/space/images/…`, writes the promoted
paths into the module row via `assetPathMap`, and leaves the originals in
place for a later sweep of the whole prefix.

### The predicate that deliberately did NOT change

`isPersonalAssetKey` is untouched, and this is the load-bearing decision of the
amendment. That function has a *second*, unrelated job: it is the delete-path
gate. `collectReferencedPersonalKeys`, `countRowsReferencingKeys`,
`collectListOrphanKeys`, `collectSentenceOrphanKeys` and
`collectPhraseOrphanKeys` all use it to decide which R2 objects an uninstall or
a row delete may destroy.

Teaching *that* predicate about `library_packs/` would classify a published
module's shared assets as deletable by any account that uninstalls the module —
the precise catastrophe this ADR was written to prevent, reintroduced through
the back door.

So the widening lives in a separate, deliberately-distinct predicate in the
same file, `convex/lib/contentModuleDelete.ts`:

    isPersonalAssetKey(key)    // may uninstall DELETE it?   accounts/ | profiles/
    isPromotableAssetKey(key)  // should publish COPY it?    personal + library_packs/

Copying is additive and always safe; deleting is destructive and is not. That
asymmetry is why the two sets differ and why they must stay two functions. A
"PROMOTABLE ≠ PERSONAL" docblock sits between them saying so.

To make the separation structural rather than advisory, the per-table key
extractors in `personalAssetRefs.ts` no longer hard-code a predicate — each
takes a `keep: KeyFilter` parameter. The delete-path collectors pass
`isPersonalAssetKey`; only `collectSourcePromotableKeys` (renamed from
`collectSourcePersonalKeys`) passes `isPromotableAssetKey`. The delete path
therefore cannot silently inherit a future widening of the promotion rule.

### Consequences of the amendment

- Re-publishing any pre-ADR-022 module now migrates it off `library_packs/`.
  In practice that means `space`, the only remaining occupant.
- `library_packs/` can be deleted once every module on it has been
  re-published and the resulting module rows verified — a separate, owner-run
  operation, not a code change.
- Storage briefly doubles for `space` (originals + promoted copies) until the
  prefix is swept, consistent with the ADR's existing copy-don't-move stance.
- Field coverage still cannot drift between the delete and publish paths: both
  walk the same extractors, differing only in `keep`.
