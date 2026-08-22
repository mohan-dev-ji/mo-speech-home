# Phase 29 — Module Artifact Restore + Wipe/Restore DR Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tickets:** MOS-25 (re-baseline the backup + prove wipe/restore) · closes out MOS-13 (default module remake, including its open "build 2–3 demo-tier category modules to test the Publish button" item).

**Goal:** Bring the committed `convex/data/**` JSON artifact back into sync with the remade live `libraryModules` table, restore the six orphaned legacy modules, make published modules' custom imagery delete-proof, build the first three custom-imagery modules (image-search, AI-generated, uploaded), and then prove the wipe→restore round-trip is lossless with a repeatable verification script.

**Architecture:** The live `libraryModules` table is the source of truth; the per-slug JSON under `convex/data/{categories,lists,sentences,phrases}/` is the git backup/rollback artifact, produced by `scripts/export-library-modules.mjs` and consumed on restore by `migrations:seedLibraryModulesFromJSON` via the auto-generated `_index.ts` barrels. This phase (a) removes dead JSON, (b) closes the one field that breaks round-trip symmetry (`featured`), (c) adds a diff tool that makes "lossless" a measurable claim rather than an assertion, (d) re-syncs the artifact and restores the legacy modules, (e) promotes personal R2 assets to a shared module-scoped prefix at publish so custom-imagery modules survive an admin uninstall, (f) authors three custom-imagery modules at three tiers, and (g) runs the destructive DR test against the resulting verified artifact.

**Tech Stack:** Convex 1.x (EU deployment `wandering-marmot-955`), Node 20.17.0, Cloudflare R2 (`mo-speech-bucket-v2`), Next.js 16 dev server on port 3000.

## Global Constraints

- **Work on `main`.** Do not create a branch or worktree for this phase (standing user preference). Commit incrementally on `main`.
- **The dev server is already running on port 3000.** Never run `npm run dev`.
- **Never run `npx convex dev`** in a worktree. This phase runs in the main checkout, where `convex dev` is already running and auto-pushes; use `--no-push` on every `npx convex run` so a half-edited file can't deploy mid-command.
- **Node 20.17.0 is required** by the Convex CLI. If nvm is in play, prefix with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **Take a full deployment snapshot before every destructive step:** `npx convex export --path backups/<date>-<label>.zip`. `backups/` is gitignored.
- **This repo has no test framework** (no vitest/jest/playwright, no `test` script) and **must not gain one** — phase-17 settled that. "Test" in this plan means: a runnable command with a stated expected output. Do not add a test runner, a test file, or a test dependency; do not report "no tests written" as a defect.
- **Verification baseline, measured 2026-08-22.** Compare against these, never against zero:
  - `npx tsc -p convex/tsconfig.json --noEmit` → **clean, exit 0.** Any error is yours.
  - `npx tsc --noEmit` → **4 pre-existing errors**, all unrelated: three stale `.next/types/validator.ts` references to routes deleted long ago (`app/(admin)/admin/library/page.js`, `app/api/admin/pack-publish/route.js`, `app/api/reload-category-defaults/route.js`) and one Stripe `apiVersion` literal mismatch in `lib/stripe.ts:8`. `.next/types/validator.ts` is generated — the count may legitimately change when a route is added.
  - `npm run lint` → **66 problems (36 errors, 30 warnings)**, all pre-existing. Known noise includes `no-assign-module-variable` in `convex/contentModules/{detail,phrases,sentences}.ts` (their legitimate `const module = …`), unused vars in `convex/schema.ts:32`, `convex/translationJobs.ts:42`, `lib/languages/variants.ts:158`, `scripts/pack-migrate.mjs`, and several React-hooks warnings in `SymbolEditorModal.tsx`, `GroupsView.tsx`, `ListsModeContent.tsx`, `SentencesModeContent.tsx`.
  - **Do not fix pre-existing errors or warnings.** They are outside this phase. Only regressions you introduce count.
- **Admin Clerk user id** is needed by `seedLibraryModulesFromJSON`. Derive it, never hard-code it into committed files:
  ```bash
  npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' > /dev/null && \
  npx convex data libraryModules --limit 1 | grep -o 'user_[A-Za-z0-9]\{20,\}' | head -1
  ```
- **No UI copy is added or changed in this phase.** If any step surfaces a new string, it goes in `messages/en.json` only — never hand-added to `hi.json`/`es.json`.

---

## Established Baseline (measured 2026-08-22, before any task runs)

Re-measure at the start of execution; these are the numbers the plan was written against.

**Live `libraryModules`: 32 rows** — 23 categories, 4 lists, 4 sentences, 1 phrases. 30 are `isDefault`; the two non-defaults are `lists/self-help` and `sentences/expressing-feelings`.

**Committed JSON is stale.** Last export `d1c861b` (2026-08-01, "pre-remake defaults").

| Drift | Slugs |
|---|---|
| Live, **no JSON on disk** (5) | `general`, `joining-words`, `letters`, `position-words`, `pronouns` |
| JSON on disk, **superseded** (7) | `core-general`, `core-joining-words`, `core-letters`, `core-numbers`, `core-position-words`, `core-pronouns`, `core-time` |
| JSON on disk, **legacy orphans to restore** (6) | `christmas`, `dinosaurs`, `diwali`, `religion`, `vehicles`, `space` |

**The six legacy modules were verified restorable** — every field validates against `libraryModuleCategoryItems` (`convex/schema.ts:148`), every R2 object is present, every `symbolId` still resolves to a live `symbols` row:

| Slug | Tier | Symbols | Image sources | R2 | symbolIds |
|---|---|---|---|---|---|
| `space` | free | 16 | 13 imageSearch, 2 aiGenerated, 1 symbolstix | 16/16 | 1/1 |
| `christmas` | max | 17 | symbolstix | 1/1 | 17/17 |
| `diwali` | max | 18 | symbolstix | 1/1 | 18/18 |
| `religion` | free | 25 | symbolstix | 1/1 | 25/25 |
| `vehicles` | pro | 21 | symbolstix | 1/1 | 21/21 |
| `dinosaurs` | pro | 16 | symbolstix | 1/1 | 16/16 |

**Why `space` matters disproportionately:** the entire live catalogue is 100% SymbolStix (1,394 image-bearing entries, zero custom). `space` is the only artifact anywhere carrying `imageSearch` or `aiGenerated` symbols, so it is our only end-to-end proof that those `imageSourceType` values survive publish→export→seed→install. There are **zero** `upload`-sourced symbols anywhere. Tasks 7–8 close that gap.

### The R2 asset-namespace hazard (drives Task 7)

`convex/contentModules/publish.ts:12` records a deliberate V1 shortcut:

> R2 assets: list/sentence items reference personal R2 keys under `accounts/<admin>/…` **IN PLACE for V1** (no promotion to a module-scoped prefix). … revisit (mirror `promoteAssetsToPackPrefix`) if external contributors publish.

`collectReferencedPersonalKeys` (`convex/lib/personalAssetRefs.ts:93`) is scoped to a **single account** — it queries `by_account_id`, and never consults `libraryModules` or any other account. `isPersonalAssetKey` (`convex/lib/contentModuleDelete.ts:25`) treats anything under `accounts/` or `profiles/` as deletable-on-uninstall. Uploads land at `accounts/{userId}/(images|audio)/<filename>` (`app/api/upload-asset/route.ts:59`).

**The failure chain:** admin authors a category with uploaded / image-searched / AI-generated images → assets sit under `accounts/<admin>/…` → admin publishes it as a module, paths kept in place → another account installs it, referencing the admin's objects → **admin uninstalls their own copy** → orphan collection finds no surviving reference within the admin's account → deletes the R2 objects → the published module and every installed copy render broken.

`space` is safe because its assets sit under `library_packs/space/`, which matches neither personal prefix. That was **not** luck — see below. The three modules built in Task 8 would not be safe, which is why the fix lands before they are authored rather than after.

**Every image pipeline writes to the personal namespace.** `SymbolEditorModal.tsx:623` is explicit: "upload, image-search proxy, and AI generate all land a blob here that needs to go to R2" — all three persist to `accounts/${accountId}/images/${uuid}` (lines 624, 653, 682, 741). `R2_PATHS.aiCache` (`ai-cache/<uuid>.png`, `lib/r2-paths.ts:48`) is only the *generation-side* cache; once a generated image is chosen it is re-uploaded into the account namespace. So `jobs` needs promotion exactly as much as `my-home` — there is no free pass for AI-generated content.

#### This pipeline existed and was deliberately removed

`promoteAssetsToPackPrefix`, in the retired `app/api/admin/pack-publish/route.ts`, is what put `space`'s images under `library_packs/`. It walked categories, lists **and** sentences, promoting `imagePath`, `audioPath`, `recordedAudioPath` and `generatedAudioPath` with separate image/audio stat counters, copy-not-move semantics, idempotent re-publish, and a no-op fallback when R2 was unconfigured.

It was deleted wholesale in `7083f1a` (Phase 14.5 pack teardown, 2026-07-07) along with the rest of the pack admin surface. The teardown plan (`docs/4-builds/plans/_done/phase-14.5-ws2-ws3-publishing-and-labels.md:773`) explicitly noted that keys like `library_packs/space/images/...` are R2 object keys rather than code imports and left the data alone. The **data** was preserved on purpose; the **pipeline** was removed on the assumption the module publish path would carry the job forward. It didn't — `publish.ts:16`'s "revisit (mirror `promoteAssetsToPackPrefix`)" is the note-to-self that never got actioned.

Confirmed gone from the current tree — `CopyObjectCommand` appears in no file under `app/`, `convex/` or `lib/`, and no code outside `convex/data/` references `library_packs`. Recover the original verbatim with:

```bash
git show 7083f1a^:app/api/admin/pack-publish/route.ts
```

Task 7 is therefore a **port of prior art from this repo**, not a new design. Read the original before writing the new one.

### The three new modules (Task 8)

Closes MOS-13's open "build 2–3 demo-tier category modules to test the Publish button" (folded in from the cancelled MOS-14). One module per image pipeline, one per tier, so publish, the paywall gates, and the DR test each get all three exercised:

| Slug | Name | Pipeline | Route | Tier |
|---|---|---|---|---|
| `weather` | Weather | image search | `app/api/image-search/search` | free |
| `jobs` | Jobs | AI generation | `app/api/ai-generate/imagen` | pro |
| `my-home` | My home | upload | `app/api/upload-asset` | max |

MOS-10 (core-words EN fallback), previously flagged on MOS-13 as blocking the marketing recordings, was **cancelled** on 2026-07-28 — not a blocker.

**`space` R2 facts:** assets live under `library_packs/space/` (19 objects, 16 referenced, 3 unreferenced orphans). `isPersonalAssetKey` (`convex/lib/contentModuleDelete.ts:25`) only matches `accounts/` and `profiles/` prefixes, so **no uninstall or module-delete path can ever remove these images.** Its 2 `aiGenerated` symbols carry **no `aiPrompt`** — they cannot be regenerated, only preserved.

**Accepted losses (decided, do not re-litigate):**
- `provenance` — present on all six legacy JSONs, absent from `convex/schema.ts`. Its value is identical boilerplate on every one: `{"author":"Mo Speech","licence":"proprietary","version":"1"}`. Recorded here for the historical record; dropped from the artifact. The licences that carry real obligation are per-symbol on `space` (Pixabay ×5, Unsplash ×6, Pexels ×1, GODL-India ×1) and **are** round-tripped via `attribution`/`license`/`imageSourceUrl`.
- `lastPublishedAt` — volatile timestamp, intentionally omitted.
- `tags`, `tierOverride`, `expiresAt`, `translationSnapshot` — not set on any live row; moot.

**De-risked:** `librarySourceId` on installed profile content stores the module **slug**, not the `_id` (`convex/schema.ts:557`). Deleting and re-inserting `libraryModules` rows therefore does **not** orphan installed content, provided slugs are stable.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `convex/data/categories/core-*.json` (7) | Delete | Superseded by the remade `general`/`joining-words`/`letters`/`position-words`/`pronouns`/`numbers`/`time` modules. |
| `scripts/export-library-modules.mjs` | Modify | Add a `--barrels-only` mode so barrels can be regenerated after a manual JSON delete, without a live dump (which would prune the not-yet-seeded legacy files). |
| `convex/contentModules/exportModules.ts` | Modify | Emit `featured`; document the accepted omissions. |
| `convex/migrations.ts` | Modify | `seedLibraryModulesFromJSON` restores `featured` from the JSON instead of hard-coding `false`. |
| `convex/data/_shared/types.ts` | Modify | Add `featured?: boolean` to `ContentModuleBase`; mark `provenance` as artifact-only. |
| `scripts/verify-module-roundtrip.mjs` | Create | The verification harness: deep-diff the live dump against the committed JSON, exit non-zero on any difference. |
| `convex/data/categories/{christmas,dinosaurs,diwali,religion,vehicles,space}.json` | Rewritten by exporter | Re-emitted in current export shape once seeded (loses `provenance`, gains `featured`). |
| `docs/4-builds/decisions/ADR-022-module-asset-promotion.md` | Create | Records why published modules own their assets under a shared prefix, and the prefix contract. |
| `convex/lib/personalAssetRefs.ts` | Modify | Export `collectSourcePersonalKeys` — every personal R2 key one publish source references (the inverse of the existing survivor scan). |
| `convex/contentModules/publish.ts` | Modify | Both publish mutations accept an optional `assetPathMap` and rewrite emitted asset paths through it. |
| `app/api/admin/promote-module-assets/route.ts` | Create | Clerk-admin-gated R2 copy step: `accounts/…` → `library_modules/<tree>/<slug>/<kind>/…`, returns the key mapping. Convex mutations cannot do R2 I/O, so this sits between the modal and the mutation. |
| `app/components/app/shared/modals/PublishModuleModal.tsx` | Modify | Collect keys → POST the promote route → pass `assetPathMap` into the publish mutation. |
| `convex/data/categories/{weather,jobs,my-home}.json` | Created by exporter | The three new custom-imagery modules, once authored and published. |
| `convex/data/*/_index.ts` (4) | Regenerated | Barrels follow the JSON on disk. |
| `docs/4-builds/changelog/2026-MM-DD-module-artifact-restore.md` | Create | Ship record for MOS-13 + MOS-25. |

---

### Task 1: Prune the superseded `core-*` JSON and add barrels-only regeneration

The seven `core-*.json` files describe modules that no longer exist live — the remake renamed them (`core-general` → `general`, etc.). Leaving them is not inert: `seedLibraryModulesFromJSON` walks the barrel, so the DR test in Task 7 would resurrect seven duplicate modules. They must go before anything is seeded.

They cannot be pruned by running the exporter, because the exporter prunes *everything* absent from the live table — which would also delete the six legacy JSONs we still need. Hence a barrels-only mode.

**Files:**
- Delete: `convex/data/categories/core-general.json`, `core-joining-words.json`, `core-letters.json`, `core-numbers.json`, `core-position-words.json`, `core-pronouns.json`, `core-time.json`
- Modify: `scripts/export-library-modules.mjs`
- Regenerated: `convex/data/categories/_index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `node scripts/export-library-modules.mjs --barrels-only` — regenerates all four `_index.ts` barrels from the JSON on disk, performing no network call and no prune. Exit 0.

- [ ] **Step 1: Confirm the seven slugs are genuinely absent from the live table**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const live=new Set(JSON.parse(s).filter(m=>m.tree==="categories").map(m=>m.slug));
      const stale=["core-general","core-joining-words","core-letters","core-numbers","core-position-words","core-pronouns","core-time"];
      for(const s2 of stale) console.log(s2.padEnd(22), live.has(s2)?"STILL LIVE — STOP":"absent ✅");
    })'
```

Expected: all seven print `absent ✅`. If any prints `STILL LIVE — STOP`, halt and re-scope — the remake did not rename that module.

- [ ] **Step 2: Add `--barrels-only` to the exporter**

In `scripts/export-library-modules.mjs`, immediately after the `MAP_NAME` constant block and **before** the `// ── Fetch the dump ──` section, insert:

```js
// ── Barrels-only mode ───────────────────────────────────────────────────────
// Regenerate the four `_index.ts` barrels from whatever JSON is on disk, with
// no live dump and no prune. Needed when JSON is added or removed by hand
// (e.g. pruning superseded modules, or staging a legacy module for a restore)
// and a full export would prune the very files being staged.
const BARRELS_ONLY = process.argv.includes("--barrels-only");
```

Then change the final execution block at the bottom of the file from:

```js
for (const tree of Object.keys(OUT)) regenBarrel(tree);
```

to a guarded early exit. Move the `--barrels-only` handling to run *before* the dump by wrapping the fetch: replace the line

```js
console.log("📦 Exporting libraryModules → committed JSON…\n");
```

with:

```js
if (BARRELS_ONLY) {
  console.log("🧱 Regenerating barrels from on-disk JSON (no dump, no prune)…\n");
  for (const tree of Object.keys(OUT)) regenBarrel(tree);
  console.log("\n✅ Barrels regenerated.");
  process.exit(0);
}

console.log("📦 Exporting libraryModules → committed JSON…\n");
```

`regenBarrel` is a function declaration hoisted to module scope, so calling it above its definition is valid.

- [ ] **Step 3: Verify barrels-only runs clean before deleting anything**

Run: `node scripts/export-library-modules.mjs --barrels-only`
Expected: four `regenerated <tree>/_index.ts (N modules)` lines — `categories (31)`, `lists (4)`, `sentences (4)`, `phrases (1)` — then `✅ Barrels regenerated.` and exit 0.

Run: `git diff --stat convex/data`
Expected: **no output** (the barrels are already correct, so regeneration is a no-op). If files changed, inspect the diff — a non-empty diff here means the committed barrels had drifted from disk.

- [ ] **Step 4: Delete the seven superseded files and regenerate**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
rm convex/data/categories/core-general.json \
   convex/data/categories/core-joining-words.json \
   convex/data/categories/core-letters.json \
   convex/data/categories/core-numbers.json \
   convex/data/categories/core-position-words.json \
   convex/data/categories/core-pronouns.json \
   convex/data/categories/core-time.json
node scripts/export-library-modules.mjs --barrels-only
```

Expected: `regenerated categories/_index.ts (24 modules)`.

- [ ] **Step 5: Type-check**

Run: `npx tsc -p convex/tsconfig.json --noEmit`
Expected: no output, exit 0. (A dangling import in `_index.ts` would fail here.)

- [ ] **Step 6: Commit**

```bash
git add convex/data/categories scripts/export-library-modules.mjs
git commit -m "chore(modules): prune superseded core-* JSON; add exporter --barrels-only

The seven core-* modules were renamed during the MOS-13 remake (core-general
→ general, etc.) and no longer exist in libraryModules. Left on disk they would
be resurrected as duplicates by seedLibraryModulesFromJSON on any restore.

--barrels-only regenerates the _index.ts barrels from on-disk JSON without a
live dump, so JSON can be pruned or staged by hand without the full exporter's
prune deleting files that are not yet in the table.

Refs MOS-13, MOS-25"
```

---

### Task 2: Close the `featured` round-trip gap

`featured` is a curated-library flag on `libraryModules` (`convex/schema.ts`, required `v.boolean()`). `dumpAllModules` does not emit it and `seedLibraryModulesFromJSON` hard-codes `featured: false`, so a wipe→restore silently destroys every featuring decision. Fix both ends plus the shared type.

**Files:**
- Modify: `convex/data/_shared/types.ts`
- Modify: `convex/contentModules/exportModules.ts`
- Modify: `convex/migrations.ts:482-541` (`seedLibraryModulesFromJSON`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: JSON module objects may carry `featured?: boolean`. `dumpAllModules` emits `featured: true` when set and omits it when false. `seedLibraryModulesFromJSON` writes `featured: mod.featured ?? false`.

- [ ] **Step 1: Add `featured` to the shared module type**

In `convex/data/_shared/types.ts`, inside `type ContentModuleBase`, immediately after the `defaultOrder` field, add:

```ts
  /** Curated-library featuring flag. Round-tripped so a wipe/restore does not
   * destroy featuring decisions. Omitted from the artifact when false. Live
   * source of truth: `libraryModules.featured`. */
  featured?: boolean;
```

In the same file, on the `provenance` field of `ContentModuleBase`, replace the existing line with:

```ts
  /** Artifact-only. `libraryModules` has no `provenance` column, so this is
   * dropped on seed and not re-emitted by the exporter. Retained on the type
   * for the legacy pack-converted JSONs that still carry it. */
  provenance?: ModuleProvenance;
```

- [ ] **Step 2: Emit `featured` from the export query**

In `convex/contentModules/exportModules.ts`, inside the `rows.map((m) => ({ ... }))` object, immediately after the `defaultOrder` spread and before `items: m.items,`, add:

```ts
      // Curated-library featuring. Round-tripped (restored by
      // seedLibraryModulesFromJSON) so a wipe/restore keeps the shelf layout.
      ...(m.featured ? { featured: true } : {}),
```

Then extend the file's docblock. Replace the sentence

```
 * Volatile fields (`_id`, timestamps, `createdBy`, publish window) are omitted
```

with:

```
 * Volatile fields (`_id`, timestamps, `createdBy`, publish window) are omitted
 * so committed diffs reflect real content/curation changes, not churn.
 *
 * Deliberately NOT round-tripped, and why:
 *   - `provenance`  — no column on `libraryModules`; the legacy pack JSONs that
 *                     carry it all hold identical boilerplate. Per-symbol
 *                     `attribution`/`license`/`imageSourceUrl` ARE round-tripped,
 *                     and those are the ones that carry obligation.
 *   - `lastPublishedAt` / `publishedAt` / `createdBy` — volatile.
 *   - `tags` / `tierOverride` / `expiresAt` / `translationSnapshot` — unset on
 *     every live row; add here if that ever changes.
 *
 * NOTE: Convex's value encoding returns object fields key-sorted, so the
 * "fixed key order" below governs which keys are present, not their order on
 * disk. Compare artifacts structurally (scripts/verify-module-roundtrip.mjs),
 * never byte-wise.
```

…and delete the now-duplicated trailing `* so committed diffs reflect real content/curation changes, not churn.` line that followed the original sentence.

- [ ] **Step 3: Restore `featured` on seed**

In `convex/migrations.ts`, inside `seedLibraryModulesFromJSON`'s `ctx.db.insert("libraryModules", { ... })` call, replace the line

```ts
          featured: false,
```

with:

```ts
          featured: mod.featured ?? false,
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p convex/tsconfig.json --noEmit`
Expected: no output, exit 0.

- [ ] **Step 5: Verify the deployed query now emits `featured`**

Convex dev auto-pushes on save; give it a moment, then:

```bash
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const m=JSON.parse(s);
      console.log("modules:",m.length,"featured:",m.filter(x=>x.featured).length);
      console.log("keys on first row:",Object.keys(m[0]).join(","));
    })'
```

Expected: `modules: 32`. The `featured:` count is whatever is genuinely set live (0 is a valid result — it means nothing is featured yet, not that the change failed). Confirm the change landed by checking that a row you deliberately feature shows up; if the count is 0 and you want positive proof, feature one module in the admin library UI at `http://localhost:3000/en/library/modules`, re-run, and confirm the count becomes 1 — then unfeature it if that was only for the test.

- [ ] **Step 6: Commit**

```bash
git add convex/data/_shared/types.ts convex/contentModules/exportModules.ts convex/migrations.ts
git commit -m "fix(modules): round-trip \`featured\` through export/seed

dumpAllModules omitted \`featured\` and seedLibraryModulesFromJSON hard-coded
false, so a wipe/restore destroyed every featuring decision. Both ends now
carry it. Documents the fields deliberately left out (provenance, volatile
timestamps, unset lifecycle fields) and warns that Convex key-sorts the dump,
so artifacts must be compared structurally rather than byte-wise.

Refs MOS-25"
```

---

### Task 3: Build the round-trip verification harness

"Lossless" has to be measurable. This script fetches the live dump, compares it structurally against the committed JSON per slug, and exits non-zero on any difference. It is the pass/fail gate for Tasks 5 and 7, and is reusable for every future export.

**Files:**
- Create: `scripts/verify-module-roundtrip.mjs`

**Interfaces:**
- Consumes: `contentModules/exportModules:dumpAllModules`, and `convex/data/{categories,lists,sentences,phrases}/*.json`.
- Produces: `node scripts/verify-module-roundtrip.mjs` → exit 0 when the artifact matches the table exactly; exit 1 with a per-slug report otherwise. Accepts `--json <path>` to compare a previously saved dump instead of fetching live.

- [ ] **Step 1: Write the script**

Create `scripts/verify-module-roundtrip.mjs`:

```js
/**
 * Verify the committed `convex/data/**` JSON artifact matches the live
 * `libraryModules` table exactly.
 *
 * The artifact is the rollback path for the whole content catalogue, so
 * "it looks right" is not good enough — this makes the claim testable. It is
 * the pass/fail gate for the wipe/restore DR test (MOS-25).
 *
 * Compares STRUCTURALLY, not byte-wise: Convex's value encoding returns object
 * fields key-sorted, so on-disk key order carries no meaning.
 *
 * Run:
 *   node scripts/verify-module-roundtrip.mjs
 *   node scripts/verify-module-roundtrip.mjs --json /tmp/dump.json
 *
 * Exit 0 = artifact matches the table. Exit 1 = drift (reported per slug).
 */

import { readFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TREES = ["categories", "lists", "sentences", "phrases"];

// ── Load the live dump ──────────────────────────────────────────────────────
const jsonFlag = process.argv.indexOf("--json");
let live;
if (jsonFlag !== -1) {
  live = JSON.parse(readFileSync(process.argv[jsonFlag + 1], "utf8"));
  console.log(`📄 Comparing against saved dump: ${process.argv[jsonFlag + 1]}\n`);
} else {
  const tmp = join(tmpdir(), `verify_modules_${process.pid}.json`);
  try {
    execSync(
      `npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' > "${tmp}"`,
      { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"], shell: "/bin/bash" }
    );
    live = JSON.parse(readFileSync(tmp, "utf8"));
  } finally {
    if (existsSync(tmp)) { try { unlinkSync(tmp); } catch { /* ignore */ } }
  }
  console.log("🔗 Comparing against the live libraryModules table\n");
}

if (!Array.isArray(live) || live.length === 0) {
  console.error("❌ Dump is empty — refusing to report a match against nothing.");
  process.exit(1);
}

// ── Structural deep-diff ────────────────────────────────────────────────────
/** Recursively collect `path: liveValue != diskValue` differences. */
function diff(a, b, path = "", out = []) {
  if (a === b) return out;
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) {
    out.push(`${path || "<root>"}: type ${ta} (live) vs ${tb} (disk)`);
    return out;
  }
  if (ta === "array") {
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} (live) vs ${b.length} (disk)`);
      return out;
    }
    for (let i = 0; i < a.length; i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (ta === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in a)) { out.push(`${p}: missing live, present on disk`); continue; }
      if (!(k in b)) { out.push(`${p}: present live, missing on disk`); continue; }
      diff(a[k], b[k], p, out);
    }
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} (live) != ${JSON.stringify(b)} (disk)`);
  return out;
}

// ── Compare ─────────────────────────────────────────────────────────────────
const liveByKey = new Map(live.map((m) => [`${m.tree}/${m.slug}`, m]));
const diskByKey = new Map();
for (const tree of TREES) {
  const dir = join(REPO_ROOT, "convex/data", tree);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const slug = f.replace(/\.json$/, "");
    diskByKey.set(`${tree}/${slug}`, JSON.parse(readFileSync(join(dir, f), "utf8")));
  }
}

const onlyLive = [...liveByKey.keys()].filter((k) => !diskByKey.has(k)).sort();
const onlyDisk = [...diskByKey.keys()].filter((k) => !liveByKey.has(k)).sort();
const both = [...liveByKey.keys()].filter((k) => diskByKey.has(k)).sort();

let failed = 0;
for (const k of onlyLive) { console.log(`❌ ${k}: in the table, NO JSON on disk`); failed++; }
for (const k of onlyDisk) { console.log(`❌ ${k}: JSON on disk, NOT in the table`); failed++; }
for (const k of both) {
  const d = diff(liveByKey.get(k), diskByKey.get(k));
  if (d.length === 0) continue;
  failed++;
  console.log(`❌ ${k}: ${d.length} difference(s)`);
  for (const line of d.slice(0, 10)) console.log(`     ${line}`);
  if (d.length > 10) console.log(`     …and ${d.length - 10} more`);
}

console.log(
  `\n${failed ? "❌" : "✅"} ${both.length} compared, ${onlyLive.length} live-only, ` +
  `${onlyDisk.length} disk-only, ${failed} module(s) with drift.`
);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it and confirm it FAILS against today's stale artifact**

Run: `node scripts/verify-module-roundtrip.mjs`
Expected: exit 1. It must report `general`, `joining-words`, `letters`, `position-words`, `pronouns` as `in the table, NO JSON on disk`; the six legacy slugs as `JSON on disk, NOT in the table`; and content drift on most of the 23 remaining categories. A pass here would mean the script is not actually comparing anything — investigate before continuing.

- [ ] **Step 3: Confirm it detects a single-field change**

```bash
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' > /tmp/tamper.json
node -e '
const fs=require("fs");
const m=JSON.parse(fs.readFileSync("/tmp/tamper.json","utf8"));
const target=m.find(x=>x.tree==="categories"&&x.slug==="animals");
target.name.en="__TAMPERED__";
target.items[0].symbols[0].order=999;
fs.writeFileSync("/tmp/tamper.json",JSON.stringify(m));
console.log("tampered categories/animals: name.en and items[0].symbols[0].order");
'
node scripts/verify-module-roundtrip.mjs --json /tmp/tamper.json; echo "exit=$?"
rm -f /tmp/tamper.json
```

Expected: `exit=1`, with output naming both `name.en: "__TAMPERED__" (live) != …` and `items[0].symbols[0].order: 999 (live) != 0 (disk)`. This proves the deep-diff reaches nested array elements, not just top-level fields or the slug set.

(`categories/animals` already differs from disk at this point because the artifact is stale, so expect additional drift lines alongside the two tampered ones — the two named lines are what matters.)

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-module-roundtrip.mjs
git commit -m "test(modules): add libraryModules round-trip verifier

Deep-diffs the live table against the committed convex/data JSON and exits
non-zero on any drift, structurally rather than byte-wise (Convex key-sorts
dump output). This is the pass/fail gate for the MOS-25 wipe/restore test.

Refs MOS-25"
```

---

### Task 4: Seed the six legacy modules into `libraryModules`

With the stale `core-*` files gone, the barrel contains exactly the 32 live slugs plus the six legacy ones. `seedLibraryModulesFromJSON` inserts only modules with no existing row, so a single run inserts precisely those six and leaves the remade 32 untouched.

**Files:** none modified — this is a data operation.

**Interfaces:**
- Consumes: Task 1's pruned barrel; Task 2's `featured`-aware seed.
- Produces: live `libraryModules` at 38 rows.

- [ ] **Step 1: Full deployment snapshot**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
npx convex export --path "backups/$(date +%Y-%m-%d)-pre-legacy-seed.zip"
ls -lh backups/ | tail -3
```

Expected: a new `.zip` of non-trivial size. Do not continue without it.

- [ ] **Step 2: Dry-run what the seed will walk**

`seedLibraryModulesFromJSON` iterates the barrels, and the barrels are a directory scan, so listing the JSON on disk is exactly what it will see:

```bash
node -e '
const fs=require("fs");
for (const t of ["categories","lists","sentences","phrases"]) {
  const slugs=fs.readdirSync("convex/data/"+t).filter(f=>f.endsWith(".json")).map(f=>f.replace(/\.json$/,"")).sort();
  console.log(t+" ("+slugs.length+"): "+slugs.join(", "));
}
'
```

Expected: `categories (24)` — including `christmas`, `dinosaurs`, `diwali`, `religion`, `space`, `vehicles`, and **no** `core-*` entries — plus `lists (4)`, `sentences (4)`, `phrases (1)`. **33 files total.**

Sanity-check the arithmetic before seeding: 33 files = 27 that match a live row + 6 legacy with no row. The five live-only slugs (`general`, `joining-words`, `letters`, `position-words`, `pronouns`) still have no file at this point — the exporter writes them in Task 5. So the seed scans 33, not 38.

- [ ] **Step 3: Seed**

```bash
ADMIN_ID=$(npx convex data libraryModules --limit 1 | grep -o 'user_[A-Za-z0-9]\{20,\}' | head -1)
echo "admin: $ADMIN_ID"
npx convex run migrations:seedLibraryModulesFromJSON --no-push "{\"adminClerkUserId\":\"$ADMIN_ID\"}"
```

Expected: `{ scanned: 33, seeded: 6, alreadyHadRow: 27, skippedStarter: 0 }`.

If `seeded` is anything other than 6, **stop** — an unexpected insert means the barrel still holds a slug that should not be there. Restore from the Step 1 snapshot (`npx convex import --replace backups/<file>.zip`) and re-check Task 1.

**Capture the admin id now** — Task 7 needs it while the table is empty, and `dumpAllModules` does not emit `createdBy`:

```bash
echo "$ADMIN_ID" > /tmp/mo-admin-clerk-id.txt && cat /tmp/mo-admin-clerk-id.txt
```

- [ ] **Step 4: Verify the six landed with the right tiers and are not defaults**

```bash
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const m=JSON.parse(s);
      console.log("total:",m.length,"| defaults:",m.filter(x=>x.isDefault).length);
      for(const slug of ["christmas","dinosaurs","diwali","religion","vehicles","space"]){
        const r=m.find(x=>x.slug===slug&&x.tree==="categories");
        console.log(" ",slug.padEnd(10), r?`tier=${r.defaultTier} isDefault=${!!r.isDefault} symbols=${r.items[0].symbols.length} provenance=${"provenance" in r}`:"MISSING ❌");
      }
    })'
```

Expected exactly:
```
total: 38 | defaults: 30
  christmas  tier=max isDefault=false symbols=17 provenance=false
  dinosaurs  tier=pro isDefault=false symbols=16 provenance=false
  diwali     tier=max isDefault=false symbols=18 provenance=false
  religion   tier=free isDefault=false symbols=25 provenance=false
  vehicles   tier=pro isDefault=false symbols=21 provenance=false
  space      tier=free isDefault=false symbols=16 provenance=false
```

`provenance=false` is the expected, accepted loss — not a bug.

- [ ] **Step 5: Verify `space`'s custom imagery survived the seed**

```bash
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const sp=JSON.parse(s).find(x=>x.slug==="space");
      const t={}; const lic={};
      for(const y of sp.items[0].symbols){
        t[y.imageSourceType||"symbolstix(implicit)"]=(t[y.imageSourceType||"symbolstix(implicit)"]||0)+1;
        if(y.license) lic[y.license]=(lic[y.license]||0)+1;
      }
      console.log("imageSourceType:",JSON.stringify(t));
      console.log("licences:",JSON.stringify(lic));
      console.log("cover:",sp.coverImagePath);
    })'
```

Expected:
```
imageSourceType: {"imageSearch":13,"aiGenerated":2,"symbolstix(implicit)":1}
licences: {"Pixabay License":5,"Unsplash License":6,"Pexels License":1,"GODL-India":1}
cover: library_packs/space/images/ebc0b943-f5bb-4aa3-8a47-e7892e7e637e.jpg
```

- [ ] **Step 6: No commit** — this task changes only live data. The artifact catches up in Task 5.

---

### Task 5: Re-export and commit the synced artifact

The git record of every module the remake produced, plus the six restored legacy ones. This is the "re-export → commit" line of MOS-25 as originally written. MOS-13 does not fully close until Task 8 delivers the three demo-tier modules its checklist still asks for.

**Files:**
- Rewritten by the exporter: all of `convex/data/{categories,lists,sentences,phrases}/*.json` + the four `_index.ts` barrels.

**Interfaces:**
- Consumes: the 38-row table from Task 4; Task 3's verifier.
- Produces: a committed artifact for which `node scripts/verify-module-roundtrip.mjs` exits 0.

- [ ] **Step 1: Export**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
node scripts/export-library-modules.mjs
```

Expected: 38 `<tree>/<slug>.json` lines, `pruned 0 stale` (nothing should be pruned — Task 1 already removed the only stale files), four `regenerated …` lines, and `✅ Exported 38 modules.`

If it reports any prune, **stop and inspect** — something on disk is not in the table and is about to be deleted.

- [ ] **Step 2: Verify the artifact matches the table**

Run: `node scripts/verify-module-roundtrip.mjs`
Expected: `✅ 38 compared, 0 live-only, 0 disk-only, 0 module(s) with drift.` and exit 0.

- [ ] **Step 3: Review the diff before committing**

```bash
git status --short convex/data
git diff --stat convex/data
```

Expected: the five previously-missing modules appear as new files (`general.json`, `joining-words.json`, `letters.json`, `position-words.json`, `pronouns.json`); the six legacy files show as modified (losing `provenance`); the remaining 27 show real content changes from the remake. Spot-check one remade module's diff to confirm the content is the *new* authored version, not a revert.

- [ ] **Step 4: Type-check**

Run: `npx tsc -p convex/tsconfig.json --noEmit`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add convex/data
git commit -m "export: library modules — post-remake sync + legacy restore

Re-syncs the committed artifact with the live table after the MOS-13 default
module remake (last export was 2026-08-01, pre-remake). Adds the five renamed
core modules that had no JSON at all (general, joining-words, letters,
position-words, pronouns) and restores six legacy modules that had been
orphaned on disk (christmas, dinosaurs, diwali, religion, vehicles, space).

space is the only module in the catalogue with imageSearch (13) and
aiGenerated (2) symbols; its R2 assets under library_packs/space/ were verified
present (16/16) and its per-symbol licences (Pixabay, Unsplash, Pexels,
GODL-India) round-trip intact. Module-level \`provenance\` is dropped — it has no
schema column and held identical boilerplate on all six.

Verified with scripts/verify-module-roundtrip.mjs: 0 drift across 38 modules.

Refs MOS-13, MOS-25"
```

---

### Task 6: Admin QA pass on the six restored modules

The restored modules were authored before phases 16–20 (audio-follows-label, auto-match, the en-GB-News-M reseed). They are structurally valid but have never been through the current authoring surface. Install, inspect, correct, republish — which also exercises the publish path for `imageSearch`/`aiGenerated` symbols for the first time.

**Files:** none directly; republishing writes `libraryModules` rows and the export in Step 6 rewrites their JSON.

**Interfaces:**
- Consumes: the 38-row table and synced artifact from Task 5.
- Produces: six modules re-authored through the current pipeline, re-exported and committed.

- [ ] **Step 1: Confirm they appear in the library UI**

Open `http://localhost:3000/en/library/modules` (dev server is already running on 3000). Verify all six appear with correct badges: `religion` and `space` as Free, `dinosaurs` and `vehicles` as Pro, `christmas` and `diwali` as Max. Confirm `space`'s cover renders (it is an R2 photo, not a SymbolStix glyph) and that its tile does not invert in dark mode.

- [ ] **Step 2: Install all six into the admin profile**

Install each from the library UI. After each, confirm the module lands on the Categories page as its own folder.

- [ ] **Step 3: Verify install materialised the custom images**

`npx convex data` renders a wrapped table, so it cannot be counted with `grep`. Check this in the app instead: open the installed **Space** category at `http://localhost:3000/en/` and confirm all 16 tiles render photographs (not SymbolStix line art) — 15 custom images plus one SymbolStix "NASA" tile.

If tiles render blank or fall back to SymbolStix, the install path is dropping custom `imagePath`s — that is a real bug. Stop and run `superpowers:systematic-debugging` on `convex/lib/materialiseSymbols.ts`, which is where a module symbol without a `symbolId` is meant to keep its `imagePath` verbatim.

- [ ] **Step 4: QA each installed category in the app**

For each of the six, in the admin profile:
- Every symbol renders an image (no broken tiles).
- Every symbol speaks on tap, in `en`, `es`, and `hi` — these modules predate the audio-follows-label work, so expect gaps and fix them via the editor.
- Labels are correct in all three locales (`space`'s "stars" is lower-case where its siblings are capitalised — normalise only if you want to; casing is a personalisation call, not a rule).
- `space`'s two AI images have no `aiPrompt` and cannot be regenerated. If either is unusable, replace it via image search rather than trying to regenerate.

- [ ] **Step 5: Republish each module**

Use the Publish modal on each category, keeping the existing slug so `librarySourceId` links stay intact. Confirm each republish reports success and the library card updates.

- [ ] **Step 6: Re-export, verify, commit**

```bash
node scripts/export-library-modules.mjs
node scripts/verify-module-roundtrip.mjs
```

Expected: `✅ Exported 38 modules.` then `✅ 38 compared, … 0 module(s) with drift.`

```bash
git add convex/data
git commit -m "content(modules): QA pass on the six restored legacy modules

Installed christmas, dinosaurs, diwali, religion, vehicles and space into the
admin profile, corrected labels and audio against the post-phase-20 pipeline,
and republished each on its existing slug. First exercise of the publish path
for imageSearch and aiGenerated symbols.

Refs MOS-13, MOS-25"
```

---

### Task 7: ADR-022 + promote personal assets to a module-scoped prefix at publish

Without this, every module authored with uploaded / searched / AI-generated imagery is one admin uninstall away from breaking for every account that installed it. Task 8's three modules are exactly that kind of module, so this lands first.

The design mirrors the retired `promoteAssetsToPackPrefix`. Publish is a **pure Convex mutation** called straight from `PublishModuleModal.tsx`, and Convex mutations cannot reach R2 — so the copy step has to sit in a Next.js route between the modal and the mutation, the same shape the uninstall flow already uses (collect keys in a query, do R2 work in the route, mutate after).

**Prefix contract:** `library_modules/<tree>/<slug>/<kind>/<filename>`, where `<kind>` is `images` or `audio`. It matches neither `accounts/` nor `profiles/`, so `isPersonalAssetKey` returns false and no uninstall path can ever collect it. Distinct from the retired `library_packs/` prefix so the two eras stay legible in the bucket.

**Files:**
- Create: `docs/4-builds/decisions/ADR-022-module-asset-promotion.md`
- Modify: `convex/lib/personalAssetRefs.ts`
- Modify: `convex/contentModules/publish.ts`
- Create: `app/api/admin/promote-module-assets/route.ts`
- Modify: `app/components/app/shared/modals/PublishModuleModal.tsx`

**Interfaces:**
- Consumes: `isPersonalAssetKey` from `convex/lib/contentModuleDelete`; `r2Client`, `bucketName` from `@/lib/r2-storage`.
- Produces:
  - `collectSourcePersonalKeys(ctx, { tree, sourceId }): Promise<string[]>` — exported from `convex/lib/personalAssetRefs.ts`.
  - Convex query `contentModules/publish:getPublishAssetKeys({ tree, sourceId }) → string[]`.
  - `POST /api/admin/promote-module-assets` with body `{ tree, slug, keys: string[] }` → `{ mapping: Record<string,string>, stats: { copied, skipped, failed } }`.
  - Both publish mutations accept `assetPathMap?: Record<string,string>`.

- [ ] **Step 1: Read the prior art — this is a port, not a new design**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
git show 7083f1a^:app/api/admin/pack-publish/route.ts | sed -n '36,195p'
sed -n '1,60p' docs/4-builds/decisions/ADR-014-content-modules-and-three-tree-organisation.md
```

Read `promoteAsset` and `promoteAssetsToPackPrefix` closely. The idempotency, the copy-not-move choice, the graceful degradation when R2 is unconfigured, and the coverage of *all four* asset fields (`imagePath`, `audioPath`, `recordedAudioPath`, `generatedAudioPath`) across all three trees are deliberate and should carry over. The new version differs only in destination prefix (`library_modules/<tree>/<slug>/…`) and in where it runs (a standalone route the modal calls, rather than inline in a publish route that also wrote JSON to disk).

Confirm for yourself that nothing survives to reuse:

```bash
grep -rn "CopyObjectCommand" --include="*.ts" --include="*.tsx" app convex lib || echo "✅ no promotion code in the tree — port it"
```

- [ ] **Step 2: Write ADR-022**

Create `docs/4-builds/decisions/ADR-022-module-asset-promotion.md`:

```markdown
# ADR-022 — Published modules own their assets

**Status:** accepted
**Date:** <YYYY-MM-DD>
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
```

- [ ] **Step 3: Export the source-key collector**

In `convex/lib/personalAssetRefs.ts`, append:

```ts
/**
 * Every personal (`accounts/` | `profiles/`) R2 key referenced by ONE publish
 * source — the inverse of `collectReferencedPersonalKeys`, which returns the
 * keys that SURVIVE a delete. Publish promotion needs the forward direction:
 * "what does this thing point at, so I can copy it somewhere durable."
 *
 * `tree: "categories"` addresses a single `profileCategories` row plus its
 * symbols; the foldered trees address a `profileFolders` row plus its children.
 * Reuses the same per-table extractors, so field coverage can never drift from
 * the delete path (ADR-022).
 */
export async function collectSourcePersonalKeys(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
): Promise<string[]> {
  const out: string[] = [];

  if (args.tree === "categories") {
    const cat = await ctx.db.get(args.sourceId as Id<"profileCategories">);
    if (!cat) return [];
    for (const k of categoryKeys(cat)) out.push(k);
    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", cat._id)
      )
      .collect();
    for (const s of symbols) for (const k of symbolKeys(s)) out.push(k);
    return [...new Set(out)];
  }

  const folder = await ctx.db.get(args.sourceId as Id<"profileFolders">);
  if (!folder) return [];
  for (const k of folderKeys(folder)) out.push(k);

  if (args.tree === "lists") {
    const rows = await ctx.db
      .query("profileLists")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const r of rows) for (const k of listKeys(r)) out.push(k);
  } else if (args.tree === "sentences") {
    const rows = await ctx.db
      .query("profileSentences")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const r of rows) for (const k of sentenceKeys(r)) out.push(k);
  } else {
    const rows = await ctx.db
      .query("profilePhrases")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const r of rows) for (const k of phraseKeys(r)) out.push(k);
  }

  return [...new Set(out)];
}
```

**Index names verified against `convex/schema.ts` on 2026-08-22** — these are the real ones, not guesses:

| Table | Index | Columns |
|---|---|---|
| `profileSymbols` | `by_profile_category_id` | `["profileCategoryId"]` |
| `profileLists` / `profileSentences` / `profilePhrases` | `by_folder_id_and_order` | `["folderId", "order"]` |
| `profileCategories` | `by_account_id` | `["accountId"]` |
| `profileFolders` | `by_account_id`, `by_library_source_id` | — |

Note the symbol foreign key is `profileCategoryId`, **not** `categoryId`. There is no `by_category_id` or bare `by_folder_id` index — using either will fail at runtime. Convex permits a prefix query on a compound index, so `by_folder_id_and_order` is correct for an equality-on-`folderId` lookup.

Re-confirm before writing, in case the schema moved:

```bash
grep -n "by_profile_category_id\|by_folder_id_and_order" convex/schema.ts
```

- [ ] **Step 4: Expose it as a query**

In `convex/contentModules/publish.ts`, add near the top-level exports:

```ts
export const getPublishAssetKeys = query({
  args: {
    tree: v.union(
      v.literal("categories"), v.literal("lists"),
      v.literal("sentences"), v.literal("phrases"),
    ),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => collectSourcePersonalKeys(ctx, args),
});
```

Add the imports the file does not already have: `query` from `../_generated/server`, and `collectSourcePersonalKeys` from `../lib/personalAssetRefs`.

- [ ] **Step 5: Rewrite emitted paths through the map**

In `convex/contentModules/publish.ts`, add above the mutations:

```ts
/** Rewrite one asset path through the promotion map (ADR-022). Unmapped paths —
 * symbolstix, TTS cache, already-promoted keys — pass through untouched. */
function promoted(
  path: string | undefined,
  map: Record<string, string> | undefined,
): string | undefined {
  if (!path || !map) return path;
  return map[path] ?? path;
}
```

Add `assetPathMap: v.optional(v.record(v.string(), v.string()))` to the `args` of **both** `publishFolderAsModule` and `publishCategoryAsModule`, then wrap every emitted asset path. In `publishCategoryAsModule` that is the symbol `imagePath` (around line 318), `recordedAudioPath`, each `audio[].path`, the category `imagePath` (line 351) and `coverImagePath` (lines 379, 399). In `publishFolderAsModule` it is the word `imagePath` (line 142) and the folder `coverImagePath` (lines 178, 197).

Pattern — every one takes the same shape:

```ts
        imagePath: promoted(
          s.imageSource?.type === "symbolstix" ? undefined : s.imageSource.imagePath,
          args.assetPathMap,
        ),
```

Work through them with `grep -n "imagePath\|recordedAudioPath\|coverImagePath\|audioPath" convex/contentModules/publish.ts` and wrap each emitted value. Do **not** wrap paths that are being read for comparison rather than written into the module.

Finally, replace the stale V1 note in the file's docblock (lines 12–16) with:

```
 * R2 assets: personal keys under `accounts/<admin>/…` are PROMOTED at publish to
 * `library_modules/<tree>/<slug>/<kind>/…` by `/api/admin/promote-module-assets`,
 * which passes the resulting key map in as `assetPathMap` (ADR-022). Published
 * modules therefore own their assets and survive an admin uninstall or account
 * deletion. Non-personal keys (symbolstix, TTS cache, legacy library_packs) are
 * passed through untouched.
```

- [ ] **Step 6: Write the promotion route**

Create `app/api/admin/promote-module-assets/route.ts`:

```ts
/**
 * `/api/admin/promote-module-assets` — ADR-022.
 *
 * Copies the personal R2 assets a publish source references into the shared
 * module-scoped prefix `library_modules/<tree>/<slug>/<kind>/<filename>`, and
 * returns the old→new key mapping for the caller to pass into the publish
 * mutation as `assetPathMap`.
 *
 * Exists because Convex mutations cannot perform R2 I/O. Mirrors the retired
 * `promoteAssetsToPackPrefix` (git: 7083f1a^:app/api/admin/pack-publish/route.ts).
 *
 * Copy, don't move: the authoring account still references the originals.
 * Idempotent: re-publishing overwrites the same destination key.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, bucketName } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

/** `accounts/<id>/images/<file>` → "images"; audio keys → "audio". */
function kindOf(key: string): "images" | "audio" {
  return key.includes("/audio/") ? "audio" : "images";
}

export async function POST(req: Request) {
  const { sessionClaims, userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await req.json()) as {
    tree?: string;
    slug?: string;
    keys?: string[];
  };
  const { tree, slug, keys } = body;
  if (!tree || !slug || !Array.isArray(keys)) {
    return NextResponse.json(
      { error: "Expected { tree, slug, keys[] }" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Bad slug" }, { status: 400 });
  }

  const mapping: Record<string, string> = {};
  const stats = { copied: 0, skipped: 0, failed: 0 };

  if (!r2Client || !bucketName) {
    // R2 unconfigured — publish must still succeed with paths left in place.
    console.warn("[promote-module-assets] R2 not configured; skipping promotion");
    return NextResponse.json({ mapping, stats: { ...stats, skipped: keys.length } });
  }

  for (const key of keys) {
    if (!key.startsWith("accounts/") && !key.startsWith("profiles/")) {
      stats.skipped++;
      continue;
    }
    const filename = key.split("/").pop();
    if (!filename) { stats.failed++; continue; }

    const newKey = `library_modules/${tree}/${slug}/${kindOf(key)}/${filename}`;
    if (key === newKey) { stats.skipped++; continue; }

    try {
      await r2Client.send(
        new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${key}`,
          Key: newKey,
        })
      );
      mapping[key] = newKey;
      stats.copied++;
    } catch (e) {
      console.error(`[promote-module-assets] copy failed: ${key} → ${newKey}`, e);
      stats.failed++;
    }
  }

  return NextResponse.json({ mapping, stats });
}
```

- [ ] **Step 7: Wire the modal**

In `app/components/app/shared/modals/PublishModuleModal.tsx`, add alongside the existing mutation hooks:

```tsx
  const assetKeys = useQuery(
    api.contentModules.publish.getPublishAssetKeys,
    sourceId ? { tree, sourceId } : "skip",
  );
```

Then, in the submit handler, before calling `publishFolder` / `publishCategory`:

```tsx
    let assetPathMap: Record<string, string> | undefined;
    if (assetKeys && assetKeys.length > 0) {
      const res = await fetch("/api/admin/promote-module-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree, slug, keys: assetKeys }),
      });
      if (!res.ok) {
        throw new Error(`Asset promotion failed (${res.status})`);
      }
      const { mapping, stats } = await res.json();
      console.log("[publish] promoted assets", stats);
      assetPathMap = mapping;
    }
```

…and pass `assetPathMap` into whichever mutation is called. Match the file's existing error-surfacing convention (toast / inline error) rather than letting the throw escape — read the surrounding handler and follow it. Use the variable names the component already has for `tree`, `slug`, and the source id; the names above are indicative.

- [ ] **Step 8: Type-check and lint — against the recorded baseline, not against zero**

```bash
npx tsc -p convex/tsconfig.json --noEmit; echo "convex tsc exit=$?"
npx tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -3
```

Expected, per the baseline measured 2026-08-22 (see Global Constraints):
- convex tsc: **`exit=0`, no output.** Any error here is yours.
- root tsc: **4**, and they must be the same four. Anything above 4, or a different file, is yours. Note that `.next/types/validator.ts` is a generated artifact — if the count *drops* because adding `app/api/admin/promote-module-assets/route.ts` triggered a regeneration, that is fine and expected.
- lint: **`✖ 66 problems (36 errors, 30 warnings)`.** All pre-existing. Do not fix them — they are outside this phase's scope. Any increase is yours.

Diff the actual error lines rather than trusting the counts:

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | sort > /tmp/tsc-now.txt
diff <(sort <<'EOF'
.next/types/validator.ts(53,39): error TS2307: Cannot find module '../../app/(admin)/admin/library/page.js' or its corresponding type declarations.
.next/types/validator.ts(233,39): error TS2307: Cannot find module '../../app/api/admin/pack-publish/route.js' or its corresponding type declarations.
.next/types/validator.ts(314,39): error TS2307: Cannot find module '../../app/api/reload-category-defaults/route.js' or its corresponding type declarations.
lib/stripe.ts(8,3): error TS2322: Type '"2026-03-25.dahlia"' is not assignable to type '"2026-05-27.dahlia"'.
EOF
) /tmp/tsc-now.txt && echo "✅ baseline unchanged"
```

- [ ] **Step 9: Prove promotion works, on a throwaway module**

This is the acceptance test for the whole task. In the admin profile:

**Scope note added after implementation review:** the implementation grew four *shape mappers* in `publish.ts` (`promoteListItem`, `promoteWordLike`, `promoteUnit`, `promoteAudioSource`) because this plan's original field list was wrong — `items`, `slots` and `units` pass whole objects through, carrying nested personal keys. Those mappers are the largest and least-specified part of the change, and a categories-only test never executes them. **The checklist below therefore covers three trees, not one.** A mapper bug would silently reintroduce the exact bug this task fixes, in lists and sentences.

1. Create a scratch category `promo-test` with **one** uploaded image (any photo).
2. ~~Read the keys via `npx convex run`.~~ **No longer possible** — `getPublishAssetKeys` is admin-gated and `npx convex run` carries no Clerk identity, so it throws `UNAUTHENTICATED`. That gate is correct (the query returns raw personal R2 keys) and must not be removed. Skip this step; Step 3's `copied` count proves the same thing — `copied ≥ 1` means the key was personal, since only `accounts/`/`profiles/` keys are ever copied.
3. Publish it as a module (free tier). Watch the browser console for `[publish] promoted assets { copied: 1, … }`.
4. Confirm the published row points at the promoted path:
   ```bash
   npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
     | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
         const m=JSON.parse(s).find(x=>x.slug==="promo-test");
         console.log(JSON.stringify(m.items[0].symbols[0].imagePath));
       })'
   ```
   Expected: `"library_modules/categories/promo-test/images/<filename>"` — **not** an `accounts/…` path.
5. **Now trigger the old failure:** uninstall `promo-test` from the admin profile, then confirm the promoted object still exists:
   ```bash
   cp /dev/null ./tmp-head.mjs && cat > ./tmp-head.mjs <<'EOF'
   import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
   const c = new S3Client({ region:"auto", endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
     credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID, secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
   try { await c.send(new HeadObjectCommand({Bucket:process.env.R2_BUCKET_NAME, Key:process.argv[2]}));
         console.log("✅ still present:", process.argv[2]); }
   catch { console.log("❌ DELETED:", process.argv[2]); process.exit(1); }
   EOF
   node --env-file=.env.local ./tmp-head.mjs "library_modules/categories/promo-test/images/<filename>"; rc=$?
   rm -f ./tmp-head.mjs; exit $rc
   ```
   Expected: `✅ still present`. Before this task that object would have been deleted.

   (The script must live inside the repo — `node_modules` resolution fails from a scratch directory.)
6. Open the module's library detail page and confirm its image still renders after the uninstall.
7. **Exercise the shape mappers — the part a categories-only test never touches.** Two more publishes:

   **a. Lists tree.** Make a scratch list folder `promo-test-list` with one list containing an item whose image you **upload** (not SymbolStix). Publish the folder. Confirm `copied ≥ 1`, then check the row:
   ```bash
   npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
     | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
         const m=JSON.parse(s).find(x=>x.slug==="promo-test-list");
         const paths=JSON.stringify(m).match(/"(accounts|profiles)\/[^"]+"/g);
         console.log(paths?("❌ PERSONAL PATHS LEAKED: "+paths.join(", ")):"✅ no personal paths");
       })'
   ```
   Expected: `✅ no personal paths`. This is `promoteListItem`'s only real test.

   **b. Sentences tree, composed.** Make a scratch sentence folder `promo-test-sentence` containing a **block/sequence** sentence — one built from a phrase unit plus at least one word unit — where at least one word carries an uploaded image. Publish, then run the same leak check with `promo-test-sentence`. This is the only test of `promoteUnit` walking `units[].words[]`, the deepest nesting in the change.

   Expected in both: `✅ no personal paths`. **A leak here means a mapper missed a field — stop and report which slug and which path.**

8. Delete all three scratch modules (`promo-test`, `promo-test-list`, `promo-test-sentence`) from the library, uninstall their source content, then re-run `node scripts/verify-module-roundtrip.mjs` and confirm it reports the 38-module set with 0 drift. (The verifier will fail while the scratch modules exist — that is expected, since they are live but have no committed JSON. It must pass again once they are gone.)

- [ ] **Step 10: Commit**

```bash
git add docs/4-builds/decisions/ADR-022-module-asset-promotion.md \
        convex/lib/personalAssetRefs.ts convex/contentModules/publish.ts \
        app/api/admin/promote-module-assets/route.ts \
        app/components/app/shared/modals/PublishModuleModal.tsx
git commit -m "feat(publish): promote personal R2 assets to a module-scoped prefix

Published modules referenced the admin's accounts/<id>/... keys in place, and
orphan collection is account-scoped and blind to libraryModules — so an admin
uninstalling their own copy deleted the images out from under the published
module and every account that had installed it.

Publish now copies personal assets to library_modules/<tree>/<slug>/<kind>/...,
which isPersonalAssetKey does not match, and writes the promoted paths into the
module row. Copy-not-move, idempotent, and a no-op when R2 is unconfigured —
mirroring the retired promoteAssetsToPackPrefix that made library_packs/space
safe in the first place.

ADR-022. Refs MOS-25"
```

---

### Task 8: Author the three custom-imagery modules

Closes MOS-13's open "build 2–3 demo-tier category modules to test the Publish button". One module per image pipeline, one per tier. The point is as much the *verification* as the content: these are the first end-to-end exercises of image search, AI generation, and upload through authoring → publish → export → seed → install.

**Files:** none by hand — authored in the app; `convex/data/categories/{weather,jobs,my-home}.json` appear via the exporter in Step 8.

**Interfaces:**
- Consumes: Task 7's promotion (every asset these modules reference must land under `library_modules/`).
- Produces: live `libraryModules` at 41 rows.

**Before starting:** have the upload source photos ready on disk for `my-home` — rooms and household objects, 12–20 of them. Nothing else in this task blocks on external input.

- [ ] **Step 1: Snapshot**

```bash
npx convex export --path "backups/$(date +%Y-%m-%d)-pre-custom-imagery.zip"
```

- [ ] **Step 2: Build `weather` — image search, free tier**

In the admin profile, create category **Weather** and populate 12–20 symbols via the image-search picker (`app/api/image-search/search`). Suggested labels: sunny, rainy, cloudy, windy, snowy, foggy, stormy, rainbow, hot, cold, thunder, ice.

Check as you go, and note anything that misbehaves rather than working around it silently:
- The picker returns results and the chosen image persists after a page reload.
- `attribution`, `license`, and `imageSourceUrl` are captured on each symbol — open one in the editor and confirm all three are populated. A missing licence is a real bug: image-search attribution is a legal obligation, not decoration.
- Each symbol speaks. These are custom images with no SymbolStix default audio, so audio must come from TTS on the label — verify in `en`, `es`, and `hi`.
- Tiles render at the right aspect and don't invert in dark mode.

- [ ] **Step 3: Build `jobs` — AI generated, pro tier**

Create category **Jobs**, populating 12–20 symbols via `app/api/ai-generate/imagen`. Suggested labels: doctor, nurse, teacher, firefighter, police officer, chef, builder, farmer, driver, cleaner, shopkeeper, vet.

Check:
- Generation completes and the image persists.
- **`aiPrompt` is stored on each symbol.** `space`'s two AI images lack it and are therefore unregenerable — confirm this pipeline does better. If `aiPrompt` is absent from the saved symbol, that is a genuine bug worth fixing here, since it is the difference between a regenerable asset and a dead one.
- Generated images land in R2 and survive a reload.
- Audio, locales, and dark mode as in Step 2.

- [ ] **Step 4: Build `my-home` — uploads, max tier**

Create category **My home**, uploading 12–20 of your own photos via `app/api/upload-asset`. Suggested labels: kitchen, bedroom, bathroom, sofa, television, fridge, bed, table, door, window, stairs, garden.

Check:
- Upload succeeds and enforces the `accounts/{userId}/(images|audio)/…` key pattern (`app/api/upload-asset/route.ts:59`).
- Large photos are handled — try one straight off a phone. Note the behaviour if it is rejected or slow; resizing belongs upstream at the API, not in `sharp` (standing preference).
- Audio, locales, and dark mode as in Step 2.

- [ ] **Step 5: Record what you found**

Before publishing, write down every defect or rough edge from Steps 2–4 — this is the "thorough working-condition check", and it is the most valuable output of the task. Anything that breaks the module goes in a fix now; anything cosmetic or out of scope becomes a Linear issue rather than a silent TODO.

- [ ] **Step 6: Publish all three at their tiers**

Publish via the Publish modal: `weather` → **free**, `jobs` → **pro**, `my-home` → **max**. None are `isDefault` — they must not auto-install into new accounts.

Watch the console for `[publish] promoted assets { copied: N, … }` on each. `copied` should roughly equal that module's symbol count.

- [ ] **Step 7: Verify promotion actually happened for all three**

```bash
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const m=JSON.parse(s);
      console.log("total:",m.length);
      for(const slug of ["weather","jobs","my-home"]){
        const r=m.find(x=>x.slug===slug);
        if(!r){console.log("  "+slug+": MISSING ❌");continue;}
        const paths=[r.coverImagePath,...r.items.flatMap(i=>[i.imagePath,...i.symbols.map(y=>y.imagePath)])].filter(Boolean);
        const bad=paths.filter(p=>p.startsWith("accounts/")||p.startsWith("profiles/"));
        const promotedCount=paths.filter(p=>p.startsWith("library_modules/")).length;
        const types={}; for(const y of r.items[0].symbols){const k=y.imageSourceType||"symbolstix(implicit)";types[k]=(types[k]||0)+1;}
        const missingPrompt=r.items[0].symbols.filter(y=>y.imageSourceType==="aiGenerated"&&!y.aiPrompt).length;
        console.log("  "+slug.padEnd(8),"tier="+r.defaultTier.padEnd(4),"isDefault="+!!r.isDefault,
          "promoted="+promotedCount, "personal-leaks="+bad.length+(bad.length?" ❌":" ✅"),
          JSON.stringify(types), missingPrompt?`aiPrompt missing on ${missingPrompt} ❌`:"");
      }
    })'
```

Expected: `total: 41`; `weather` free / `jobs` pro / `my-home` max; every module `personal-leaks=0 ✅`; `imageSourceType` mixes of `imageSearch`, `aiGenerated`, `upload` respectively; no `aiPrompt missing`.

**Any `personal-leaks` above zero means Task 7 missed a path** — find which field, wrap it in `promoted(...)`, re-publish that module, and re-run.

- [ ] **Step 8: Export, verify, commit**

```bash
node scripts/export-library-modules.mjs
node scripts/verify-module-roundtrip.mjs
```

Expected: `✅ Exported 41 modules.` then `✅ 41 compared, … 0 module(s) with drift.`

```bash
git add convex/data
git commit -m "content(modules): three custom-imagery modules at three tiers

weather (image search, free), jobs (AI generated, pro), my-home (upload, max) —
the first modules built from anything other than SymbolStix, and the first
exercise of all three image pipelines through publish → export → seed → install.
All assets promoted to library_modules/ per ADR-022; zero personal-prefix leaks.

Closes the MOS-13 'build 2-3 demo-tier category modules to test the Publish
button' item. Refs MOS-13, MOS-25"
```

---

### Task 9: The wipe/restore DR test (MOS-25)

Everything above exists so this test is meaningful. Wipe `libraryModules` entirely, rebuild it from the committed JSON, and prove the result is identical.

**Files:** none modified.

**Interfaces:**
- Consumes: the verified 41-module artifact from Task 8; `migrations:wipeLibraryModules`; `migrations:seedLibraryModulesFromJSON`.
- Produces: a documented, evidenced DR result.

- [ ] **Step 1: Snapshot, and save the pre-wipe dump for comparison**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
npx convex export --path "backups/$(date +%Y-%m-%d)-pre-wipe-dr-test.zip"
npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' > /tmp/pre-wipe-dump.json
node -e 'console.log("pre-wipe modules:", JSON.parse(require("fs").readFileSync("/tmp/pre-wipe-dump.json","utf8")).length)'
```

Expected: the zip exists; `pre-wipe modules: 41`.

- [ ] **Step 2: Record the installed-content baseline**

The wipe must not disturb installed profile content — `librarySourceId` holds slugs, not ids (`convex/schema.ts:557`), so this should hold. Prove it rather than assume it.

The `npx convex export` zip from Step 1 is the reliable row source (`npx convex data` renders a wrapped table that cannot be counted):

```bash
mkdir -p /tmp/pre-wipe-snapshot && \
unzip -o "backups/$(date +%Y-%m-%d)-pre-wipe-dr-test.zip" -d /tmp/pre-wipe-snapshot >/dev/null && \
for t in profileCategories profileSymbols profileFolders profileLists profileSentences profilePhrases; do
  f=$(find /tmp/pre-wipe-snapshot -path "*/$t/documents.jsonl" | head -1)
  echo "$t: $([ -n "$f" ] && wc -l < "$f" || echo 0)"
done | tee /tmp/pre-wipe-profile-counts.txt
```

Expected: non-zero counts for each. Keep the file — Step 7 diffs against it.

Also confirm you still have the admin Clerk id captured in Task 4 (`cat /tmp/mo-admin-clerk-id.txt`). Step 5 needs it *after* the table is empty, and there will be no way to read it from `libraryModules` then. If the file is gone, recover it now with `npx convex data libraryModules --limit 1 | grep -o 'user_[A-Za-z0-9]\{20,\}' | head -1`.

- [ ] **Step 3: Wipe**

```bash
npx convex run migrations:wipeLibraryModules --no-push '{"confirm":"WIPE"}'
```

Expected: `{ deleted: 41 }`.

- [ ] **Step 4: Confirm the library is genuinely empty**

Run: `npx convex run contentModules/exportModules:dumpAllModules --no-push '{}'`
Expected: `[]`.

Open `http://localhost:3000/en/library/modules` — expect an empty library, no crash, no error boundary. A render error here is a real bug worth fixing (an account can legitimately hit an empty catalogue).

Also confirm the admin's *installed* content is untouched: the Categories page should still show every installed folder. This is the load-bearing check for the slug-vs-id design.

- [ ] **Step 5: Restore**

Use the id captured in Task 4 Step 3. The table is empty now, so it cannot be re-derived from `libraryModules`, and `dumpAllModules` never emits `createdBy`.

```bash
ADMIN_ID=$(cat /tmp/mo-admin-clerk-id.txt)
[ -n "$ADMIN_ID" ] || { echo "No admin id — recover it from the pre-wipe snapshot:"; \
  echo "  grep -o 'user_[A-Za-z0-9]\\{20,\\}' /tmp/pre-wipe-snapshot/*/libraryModules/documents.jsonl | head -1"; exit 1; }
echo "admin: $ADMIN_ID"
npx convex run migrations:seedLibraryModulesFromJSON --no-push "{\"adminClerkUserId\":\"$ADMIN_ID\"}"
```

Expected: `{ scanned: 41, seeded: 41, alreadyHadRow: 0, skippedStarter: 0 }` — 41 files on disk now that Task 5 wrote the five previously-missing ones and Task 8 added the three custom-imagery modules.

- [ ] **Step 6: Prove the restore was lossless**

```bash
node scripts/verify-module-roundtrip.mjs
node scripts/verify-module-roundtrip.mjs --json /tmp/pre-wipe-dump.json
```

Expected: **both** exit 0 with `0 module(s) with drift`. The first proves live matches the artifact; the second proves live matches its own pre-wipe state.

The second command is the actual MOS-25 acceptance criterion. If it reports drift, the differing fields are exactly the round-trip gaps still open — record them and fix them before closing the ticket.

- [ ] **Step 7: Verify installed content survived**

```bash
npx convex export --path "backups/$(date +%Y-%m-%d)-post-restore-dr-test.zip"
mkdir -p /tmp/post-restore-snapshot && \
unzip -o "backups/$(date +%Y-%m-%d)-post-restore-dr-test.zip" -d /tmp/post-restore-snapshot >/dev/null && \
for t in profileCategories profileSymbols profileFolders profileLists profileSentences profilePhrases; do
  f=$(find /tmp/post-restore-snapshot -path "*/$t/documents.jsonl" | head -1)
  echo "$t: $([ -n "$f" ] && wc -l < "$f" || echo 0)"
done | diff /tmp/pre-wipe-profile-counts.txt - && echo "✅ installed content unchanged"
```

Expected: `✅ installed content unchanged` (diff prints nothing). Any difference means the wipe reached beyond `libraryModules` — restore from the Step 1 snapshot immediately and investigate before continuing.

- [ ] **Step 8: Verify the app end-to-end**

- `http://localhost:3000/en/library/modules` — all 41 modules, correct tier badges, covers render, `space` renders its R2 photo cover.
- Open the `space` module's detail page and confirm all 16 symbols render (the legacy imageSearch/aiGenerated proof).
- Open `weather`, `jobs` and `my-home` and confirm every symbol renders from `library_modules/…` — the post-ADR-022 proof that promoted assets survive a full table wipe.
- Confirm the tier gates still bite after the restore: `weather` free, `jobs` pro, `my-home` max, and none of the three auto-installed.
- Install one restored module into a student profile and confirm symbols render and speak.
- Create a fresh account and confirm `seedDefaultAccount` installs the 30 defaults **in `defaultOrder`** (`actions`, `people`, `activities`, `places`, `animals`, … per `convex/profileCategories.ts:33`), and that the 11 non-default modules (6 legacy + 3 custom-imagery + `self-help` + `expressing-feelings`) are **not** installed. Order is the thing most likely to be lost — check it explicitly, don't just count.

- [ ] **Step 9: No commit** — nothing changed on disk. Record the result in the changelog (Task 10).

---

### Task 10: Write-back and close the loop

**Files:**
- Create: `docs/4-builds/changelog/2026-MM-DD-module-artifact-restore.md`
- Move: this plan → `docs/4-builds/plans/_done/`

- [ ] **Step 1: Write the changelog**

Create `docs/4-builds/changelog/<today>-module-artifact-restore.md` (use the real date):

```markdown
# Module artifact restore + wipe/restore DR test

**Date:** <YYYY-MM-DD> · **Tickets:** MOS-13 (closed), MOS-25 (closed)

## What shipped

- Pruned 7 superseded `core-*.json` modules left behind by the MOS-13 remake rename.
- Added `--barrels-only` to `scripts/export-library-modules.mjs` so barrels can be
  regenerated without a live dump (and without the prune).
- Closed the `featured` export/seed round-trip gap; documented the fields
  deliberately not round-tripped (`provenance`, volatile timestamps, unset
  lifecycle fields) in `convex/contentModules/exportModules.ts`.
- Added `scripts/verify-module-roundtrip.mjs` — structural deep-diff of the live
  table against the committed artifact, exit non-zero on drift.
- Restored 6 orphaned legacy modules into `libraryModules`: `christmas` (max),
  `dinosaurs` (pro), `diwali` (max), `religion` (free), `vehicles` (pro),
  `space` (free). All verified beforehand: schema-clean, R2 assets present,
  every `symbolId` still resolving.
- Re-synced the committed artifact — 41 modules, 0 drift. Previously 5 live
  modules had no JSON at all and 27 were 3 weeks stale.
- QA'd and republished the 6 restored modules through the post-phase-20
  authoring surface.
- **ADR-022 — published modules own their assets.** Publish now copies personal
  R2 keys to `library_modules/<tree>/<slug>/<kind>/…` via a new
  `/api/admin/promote-module-assets` route and writes the promoted paths into
  the module row. Before this, an admin uninstalling their own copy of a module
  they had published deleted the images out from under every account that had
  installed it — orphan collection is account-scoped and blind to
  `libraryModules`. Mirrors the retired `promoteAssetsToPackPrefix`, which is
  why `library_packs/space/` was safe and a newly published module would not
  have been.
- **Bug fix surfaced by the legacy QA pass** — custom-image symbols (upload /
  image search / AI) were completely inert on the categories board: tapping one
  produced no audio and did not add it to the talker, because a single
  `if (!audioPath) return` skipped both. `materialiseSymbols` deliberately stores
  no audio for them and `getProfileSymbolsWithImages` seeds a path only for
  SymbolStix rows, so the runtime label-synthesis fallback they both rely on
  simply did not exist. `PersistentTalker.playItem` had the same gap one layer
  on (its fallback was phrase-only). Both now synthesise via `playTts` +
  `resolveSpokenVoice` (ADR-018). Not `space`-specific — it affected every
  custom-image symbol and went unnoticed only because the catalogue was 100%
  SymbolStix until `space` was restored. **It would have broken all three
  modules below.**
- **Three custom-imagery modules**, the first non-SymbolStix content in the
  catalogue and the first exercise of all three image pipelines end to end:
  `weather` (image search, free), `jobs` (AI generated, pro), `my-home`
  (upload, max). Closes MOS-13's "build 2–3 demo-tier category modules to test
  the Publish button".

## The DR test (MOS-25)

Wiped all 41 `libraryModules` rows and rebuilt from the committed JSON.
`verify-module-roundtrip.mjs` reported 0 drift against both the artifact and the
pre-wipe dump. Installed profile content was unaffected — `librarySourceId`
stores the module **slug**, not the `_id`, so re-inserted rows re-link cleanly.

## Notes for later

- Before this phase the catalogue was 100% SymbolStix — 1,394 image-bearing
  entries, zero custom — with `space` the sole `imageSearch`/`aiGenerated`
  artifact and no `upload`-sourced symbol anywhere. It now has four
  custom-imagery modules across all three pipelines.
- `space`'s 2 AI images carry no `aiPrompt`, so they cannot be regenerated. The
  current generation pipeline was verified to capture it, so this does not recur.
- ADR-022 copies rather than moves, so each promoted asset now exists twice
  (`accounts/<admin>/…` and `library_modules/…`). Reclaiming the originals needs
  a reference-counted sweep that understands `libraryModules` — ticket it.
- Modules published before ADR-022 keep in-place `accounts/…` paths. Only the
  three new modules were affected in practice; re-publish anything else that
  ever carries custom imagery.
- `library_packs/space/` holds 19 R2 objects; 16 are referenced, 3 are orphans.
- Module-level `provenance` is intentionally not round-tripped. All six legacy
  modules held identical boilerplate: `{"author":"Mo Speech","licence":"proprietary","version":"1"}`.
  Per-symbol `attribution`/`license`/`imageSourceUrl` **are** round-tripped.
```

- [ ] **Step 2: Retire the plan**

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home
git mv docs/4-builds/plans/phase-29-module-artifact-restore-and-dr-test.md \
       docs/4-builds/plans/_done/
```

- [ ] **Step 3: Commit**

```bash
git add docs/4-builds
git commit -m "docs: changelog for the module artifact restore + DR test; retire phase-29

Closes MOS-13, MOS-25"
```

- [ ] **Step 4: Close the Linear tickets**

MOS-25's description was rewritten on 2026-08-22 to cover this full scope and moved to *In Progress*. Tick its checklist and move it to Done.

MOS-13: tick the remaining items — "Build 2–3 demo-tier category modules to test the Publish button" is satisfied by Task 8 (`weather`, `jobs`, `my-home`), and "Add cover images to the modules" should be confirmed against the exported artifact before ticking:

```bash
node -e '
const fs=require("fs");
for (const t of ["categories","lists","sentences","phrases"]) {
  for (const f of fs.readdirSync("convex/data/"+t).filter(x=>x.endsWith(".json"))) {
    const m=JSON.parse(fs.readFileSync("convex/data/"+t+"/"+f,"utf8"));
    if (!m.coverImagePath) console.log("no cover:", t+"/"+m.slug);
  }
}
console.log("— cover audit complete —");
'
```

Record the DR-test evidence on both tickets: 41 modules, 0 drift against both the artifact and the pre-wipe dump, installed content unchanged.

Note that MOS-13's third blocker reference, MOS-10 (core-words EN fallback), was **cancelled** on 2026-07-28 and is not outstanding.

---

## Out of scope (deliberately)

- **Migrating `library_packs/` to `library_modules/`.** It is already a shared, delete-proof prefix; churning it would invalidate the committed artifact for no benefit (ADR-022).
- **Collecting the pre-promotion originals under `accounts/<admin>/…`.** ADR-022 copies rather than moves, so each custom-imagery asset now exists twice. Reclaiming the originals needs a reference-counted sweep that understands `libraryModules` — worth a ticket, not worth blocking on.
- **Adding `provenance` to the schema.** Decided against; the data held no information.
- **The 3 unreferenced R2 objects under `library_packs/space/`.** Harmless; deleting them saves nothing meaningful and risks removing something a future edit wants.
- **Regenerating `space`'s 2 AI images.** They carry no `aiPrompt` and cannot be reproduced. Task 8 Step 3 verifies the current pipeline does capture it, so the problem does not recur.
