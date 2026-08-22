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
