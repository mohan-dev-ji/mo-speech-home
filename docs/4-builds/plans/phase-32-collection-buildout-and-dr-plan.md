# Phase 32 — Collection build-out + resource-library DR test

> **Standalone.** Written 2026-08-27 for a fresh session. Everything needed to start is here.

**Status:** not started
**Follows:** Phase 31 (`docs/4-builds/plans/phase-31-image-credit-registry-plan.md`) — shipped and
acceptance-tested 2026-08-25/26. Phase 30 before it.
**Tickets:** MOS-25 (In Progress) · MOS-13 (In Progress) · then the fix queue below.

---

## Starting prompt for the next session

Paste this:

> Read `docs/4-builds/plans/phase-32-collection-buildout-and-dr-plan.md`. We are continuing
> from phase 31, which shipped and passed a full live acceptance run. I have already purged the
> three throwaway `acceptance-*` test modules and published some real tiered **category**
> modules into the collection.
>
> Next I want to author **one lists module and one sentences module**, both mixed
> SymbolStix + custom imagery, publish them, install everything into my test account, and then
> do the **wipe/restore of the resource library** (MOS-25). After that we move to the ticket
> queue. I will drive the browser; you verify each step and run the terminal side.
>
> Start by checking the current state — do not assume the numbers in the plan are still current.

---

## Where things stand

Phase 31 replaced per-placement image-credit storage with a per-account **`imageCredits`
registry keyed by the R2 object key**. Credits ride inside published modules and are written
into the installing account's registry. All of it was verified live, not argued:

- 12 credits published across 3 trees and 3 shape mappers, **0 keyed by a source path**
- covers (category **and** folder) credited — MOS-35 closed as superseded
- a talker-built sentence with **no slot provenance at all** published fully credited — MOS-36 closed
- **14 shared `library_modules/` objects survived both removal paths**, including a promoted
  personal recording — Phase 30 §1's guards, live
- 41 published modules, 0 shipping an image without a travelling credit

Tooling added: `migrations:deleteLibraryModule` (targeted unpublish, `47d43e3`) and
`scripts/backfill-image-credits.mjs` (dry-run default, `--apply`, `--check`).

### Live state at handoff (VERIFY, do not trust)

| Thing | Was | How to check |
|---|---|---|
| `imageCredits` rows | 46 (34 admin / 12 test) | `npx convex data imageCredits --limit 500 --format jsonArray` |
| `libraryModules` rows | 41, +N new tiered categories | `npx convex data libraryModules` |
| `library_modules/` in R2 | test modules purged; real ones added | `rclone lsf r2:mo-speech-bucket-v2/library_modules -R --files-only` |
| Known orphan | `accounts/j578wzn…/images/faf830fb-….webp` | may have been cleaned up |

Accounts: admin `j5717je37k1h19ndtjn0bsgc49892p0v` (msveraitch@) ·
test `j578wzn2kszv6n8mfjra89yqkn8crk8s` (moveraitch@).

---

## Global constraints (binding — carried forward)

- **Work on `main`.** No branch, no worktree.
- **Dev server is owner-run on :3000.** Never `npm run dev`. Never `npx convex dev`.
- `--no-push` on every `npx convex run`. Node 20.17.0
  (`source ~/.nvm/nvm.sh && nvm use 20.17.0`).
- **No test framework and none may be added.** "Test" = a runnable command with a stated
  expected output.
- Baselines: `npx tsc -p convex/tsconfig.json --noEmit` clean/exit 0 · `npx tsc --noEmit`
  **4** pre-existing errors · `npm run lint` exactly `✖ 66 problems (36 errors, 30 warnings)`.
- New UI copy in `messages/en.json` **only**.
- No hard-coded colours/spacing/radii/font sizes — `--theme-*` from `app/globals.css`.
- Convex schema changes additive and `v.optional(...)`.
- Do not modify `isPersonalAssetKey` / `isPromotableAssetKey` (`convex/lib/contentModuleDelete.ts:41-77`).
- **Never run `scripts/export-library-modules.mjs` while throwaway modules exist** — it dumps
  ALL modules and would commit them into the DR artifact.

---

## Task 1 — Author + publish the lists and sentences modules

Owner drives the browser; the session verifies each save and publish.

**Content:** one lists module, one sentences module, both **mixed SymbolStix + Image Search
(+ AI if wanted)**, each with a cover image. Real names/slugs — these are for the collection,
not throwaways, so **the slug is permanent** (`isUpdate` locks it on every re-publish).

**Classification:** choose deliberately. `Default` auto-installs into every new account.

**Verify after each publish** (the pattern that worked):
1. R2 keys land under `library_modules/<tree>/<slug>/images/` (and `/audio/` if a recording).
2. `libraryModules.credits` are keyed by the **promoted** `library_modules/…` path — **zero
   `accounts/…`**. This is the silent failure mode; it looks correct in the DB and joins to
   nothing after install.
3. Cover promoted and credited.
4. SymbolStix items produce no credit rows; uploads produce none either.

**Gotcha:** the `imageOnly` cover editor pre-fills the search box with the folder/category name
and **auto-searches it** on tab switch — clear it with the ✕ first or it burns image-search
quota (30/day). This cost 5 searches during the last run and is unticketed.

---

## Task 2 — Install everything into the test account

Confirm the installing account's registry gains **exactly** the credits that travelled with the
modules — keyed on `library_modules/…`, with **no leakage** from the admin's own rows.

```bash
npx convex data imageCredits --limit 500 --format jsonArray
```
Group by `accountId` and check the key prefixes. Do **not** grep for the account id — it
appears both as `accountId` and inside `accounts/<id>/…` keys, so a grep double-counts.

---

## Task 3 — Resource-library wipe / restore (MOS-25)

**The DR test. Destructive. Snapshot first.**

```bash
npx convex export --path backups/<date>-pre-library-wipe.zip
```

Before wiping, the committed artifact must match live, or the restore will not reproduce what
you have:

```bash
node scripts/export-library-modules.mjs      # only once the collection is final
git add convex/data && git commit
node scripts/verify-module-roundtrip.mjs     # must exit 0, 0 drift
```

Then:

```bash
npx convex run migrations:wipeLibraryModules '{"confirm":"WIPE"}' --no-push
npx convex run migrations:seedLibraryModulesFromJSON '{}' --no-push
node scripts/verify-module-roundtrip.mjs     # must exit 0
```

**Confirm after restore:** module count matches, `credits` arrays survived (they are a
top-level column and carried explicitly — `exportModules.ts:63` / `migrations.ts:531`), covers
render, and the resource library lists everything.

**Watch for:** `seedCoreWordModules` may be needed to re-resolve core word-categories. Check
whether the restored set matches the pre-wipe count exactly before declaring it passed.

---

## Task 4 — The fix queue

In the order they matter.

### MOS-41 — delete vs uninstall (start here)
Two real bugs plus a design decision:
1. **Deleting a category orphans every personal R2 asset it held.** `CategoriesContent` calls
   `deleteCategory` directly; `getCategoryModuleDeleteOrphanKeys` has exactly one caller
   (`uninstall-content-module/route.ts`) and categories never reach it. Affects user-made
   categories too. Confirmed orphan found live.
2. **Copy** — one dialog for four different operations; an installed module is removed with
   words written for permanent deletion.
3. **Design decision the ticket exists to force:** what happens when a user personalises an
   installed module and then removes it. Owner has rejected copy-on-write; prefers fully
   shared or fully copied. Not yet resolved.

> **Handle as a delete path, not a wiring job.** It looks like ten minutes. This repo has been
> bitten three times by delete paths that looked like ten minutes, including Phase 30 §1 whose
> scope table was wrong in three separate ways. Give it its own review cycle.

### MOS-40 — Photorealistic AI style 502s
Diagnosed to the line. Gemini returns **200 with no image part** — a refusal — and the code
discards the explanation. **Fix step 1 is to stop discarding it** (surface `finishReason` and
the text parts in the thrown error), then read what it says. Standing hypothesis: the template
is the only one containing `no watermark`. Also: a failed generation still decrements quota.

### MOS-39 — 8 orphaned account ids own dangling content rows
87 images, all SymbolStix, zero credit impact. Data hygiene.

### MOS-37 — `translate-modules` skips custom-image symbol labels
~72 hand translations, or extend the pipeline to fall back to the row's own label. Matters as
soon as the new modules ship to non-English boards.

### MOS-38 — provenance shape declared 9× (deferred, not superseded)
The bug class this repo keeps hitting is "a field list forgot a field".

### Also open
MOS-32 (per-language symbol variants) · MOS-28 (phantom 14-day trial) · MOS-29 (Stripe error
swallowed) · MOS-13 (rebuild defaults for marketing).

**Unticketed, worth filing:** the image-search pre-fill auto-search that burns quota; and
re-published modules never shed credits or R2 objects for images they no longer use (both
"never delete" choices that accumulate over a module's life).

---

## Then

`library_packs/` retirement — backfill `space`, re-publish onto `library_modules/`, **reinstall
so installed copies repoint**, and only then purge the prefix.

**Before purging anything, check nobody still references it.** As of 2026-08-26 `space` was
still installed on **both** accounts — purging it then would have blanked live boards. The
check: look for `profileCategories` / `profileFolders` rows whose `librarySourceId` matches the
slug. Non-empty means stop. Worth turning into `scripts/check-module-references.mjs`.

Per-module teardown recipe (row first, objects second — the reverse leaves a broken library card):

```bash
npx convex run migrations:deleteLibraryModule --no-push '{"tree":"categories","slug":"<slug>","confirm":"<slug>"}'
rclone purge --dry-run r2:mo-speech-bucket-v2/library_modules/<tree>/<slug>
rclone purge r2:mo-speech-bucket-v2/library_modules/<tree>/<slug>
```

After the retirement, re-run the backfill so the 16 deferred `library_packs/` credits per
account get recorded under their new keys, and confirm the deferred bucket drops to 0.
