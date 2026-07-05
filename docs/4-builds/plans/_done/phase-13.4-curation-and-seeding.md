# Phase 13.4 — Module detail pages, Convex-backed content, curation publish & seed

Standalone execution plan for a fresh session. Self-contained — no prior chat
context needed. Branch: `phase-13-content-modules` (worktree
`.claude/worktrees/determined-feynman-937655`).

**This plan reflects the ADR-014 addendum (2026-06-27): module content lives in
Convex, not committed JSON.** Read that addendum first
(`docs/4-builds/decisions/ADR-014-content-modules-and-three-tree-organisation.md`,
final section) — it explains the *why*. The master plan is
`.claude/plans/plan-phase-13-expressive-yeti.md`.

## Worktree conventions (read first)
- **Never run `npx convex dev`** here (goes anonymous + rewrites `.env.local`).
  Cloud dev = `wandering-marmot-955` (EU). Verify Convex with `npx convex codegen`
  then `npx tsc --noEmit -p convex/tsconfig.json`. **You cannot run Convex
  mutations from the worktree** — hand migrations/seeds to the owner to run via
  the Convex dashboard (Functions runner).
- Frontend check: `npx tsc --noEmit` (ignore the one pre-existing `lib/stripe.ts`
  version-string error).
- Don't start `next dev` — owner keeps it on `localhost:3000`. Verify authed UI
  via Claude-in-Chrome against the owner's logged-in browser (`/en/...`); the
  signed-out preview tool can't see authed pages.
- Node 20 for Convex CLI: `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- UI copy → `messages/en.json` only. AAC UI uses `--theme-*` tokens. Components
  under `app/components/{domain}/{type}/`. Owner commits manually.

## What's already DONE (do not redo)
- **13.0–13.3**: schema (`profileFolders`, `folderId`, three `*Lifecycle`
  tables), per-type install/admin/catalogue queries, 4-tab library
  (`app/[locale]/(public)/library/modules/`), group folders, breadcrumb trail,
  delete+reinstall (`/api/uninstall-content-module`, `delete{…}Module` + orphan
  queries), `InstallModuleButton` (Add / Already-installed + Remove).
- **Themed-pack conversion (now used as SEED DATA, not the live source)**:
  `scripts/convert-packs-to-modules.mjs` produced 17 per-type module JSONs at
  `convex/data/{categories,lists,sentences}/*.json` (christmas/dinosaurs/diwali/
  fun/religion = cat+list+sentence; space/vehicles = cat only). These + the
  `test-*.json` fixtures + their `_index.ts` barrels currently feed the live
  catalogue. **Task 0 moves them into Convex; after that the JSON files become
  seed input / export artifacts, not the source of truth.**

> **Important framing:** the module backend today reads bundled JSON via
> `convex/lib/contentModules.ts` (`getModuleBySlug`, `getAllModules`). The shift
> to Convex is concentrated there + the queries that call it. Install/materialise,
> the per-account `profile*` tables, the 4-tab UI, and delete/reinstall are
> **template-agnostic** and do not change.

---

## TASK 0 — Make Convex the source of truth (the foundational shift; do FIRST)

1. **`libraryModules` table** (`convex/schema.ts`). One row per module, the
   `ContentModule` shape (`convex/data/_shared/types.ts`) with lifecycle merged:
   `tree` ("categories"|"lists"|"sentences"), `slug`, `name` (localised),
   `description?`, `icon?`, `colour?`, `coverImagePath?`, `defaultTier`,
   `provenance?`, `items` (the tree's items array — same shapes as the JSON),
   plus `publishedAt?`, `expiresAt?`, `tierOverride?`, `featured`, `isStarter?`,
   `createdBy`, `updatedAt`. Indexes: `by_tree_and_slug` (unique lookup),
   `by_tree` (catalogue), `by_tree_and_published`. Slug is unique *per tree*.
   - Doc-size note: a category module row embeds all its categories+symbols. The
     `core` module (16 categories) is the largest; verify it's well under
     Convex's ~1 MB document limit (it is at current symbol counts). If a future
     category module gets huge, normalise symbols into a child table — not needed
     now.
2. **Migrate the readers** `convex/lib/contentModules.ts` from bundled-map lookups
   to Convex reads: `getModuleBySlug(ctx, tree, slug)`, `getAllModules(ctx, tree)`,
   etc. become async + take `ctx`. Update every caller (all inside Convex
   functions, so they have `ctx`): the per-type install mutations
   (`convex/contentModules/{categories,lists,sentences}.ts`), the public catalogue
   queries, `getModuleDetail` (`convex/contentModules/detail.ts`), and
   `seedDefaultAccount`.
3. **Rewrite the catalogue + detail queries** to read `libraryModules` directly
   (query by `tree` + visibility filter `publishedAt <= now && not expired`, or
   `isStarter`) and merge tier (`tierOverride ?? defaultTier`). The lifecycle is
   now on the row, so drop the separate `*Lifecycle` join for modules. (The
   `categoryLifecycle`/`listLifecycle`/`sentenceLifecycle` tables can be dropped
   in a later cleanup once nothing reads them.)
4. **One-time seed mutation** `migrations.ts:seedLibraryModulesFromJSON` — imports
   the existing bundled module maps (the JSON we already generated) and inserts a
   `libraryModules` row per module, publishing the non-starter ones
   (`publishedAt = now`, tier from `defaultTier`) and flagging starters. Owner runs
   it via the dashboard. This replaces `publishConvertedPackModules`.
5. **Retire the JSON-as-source plumbing**: once seeded + verified, the
   `convex/data/{categories,lists,sentences}/*.json` files + `_index.ts` barrels
   are no longer read at runtime. Keep them as the **export artifact** target
   (Task F) or delete the test fixtures now; either way the live catalogue is the
   table.
6. Verify: `npx convex codegen` + both `tsc`; owner runs the seed; browser → the
   4-tab library still shows all 17 themed modules at correct tiers, install +
   delete still work (now reading from Convex).

---

## TASK A — Finish module detail pages (UI; backend query already exists)
Owner wants clicking a library card → a per-slug detail page with the full
symbol/list/sentence breakdown, like the old pack detail.

`convex/contentModules/detail.ts:getModuleDetail(tree, slug)` is **already built**
(returns a pack-detail-compatible shape; resolves symbolstix `symbolId`→image+label
live). After Task 0 it reads `libraryModules`. Still to build:
1. **`ModuleDetailContent.tsx`** (`app/components/marketing/sections/`) — copy
   `PackDetailContent.tsx` (269 lines). Changes: type gains `tree`;
   `coverImagePath`/`description` nullable → guard the hero cover; back link →
   `/${locale}/library/modules` (i18n key `library.moduleDetailBack`); bottom CTA
   = `InstallModuleButton` (props `slug`, `tree`, `tier`) not `LoadPackButton`.
   Reuse its `SymbolTile` + the three sections as-is.
2. **Route** `app/[locale]/(public)/library/modules/[tree]/[slug]/page.tsx` — copy
   `app/[locale]/(public)/library/[slug]/page.tsx`. Slug is NOT globally unique
   (same slug in 3 trees) → carry both `tree`+`slug`. Validate `tree`; preload
   `getModuleDetail`; `notFound()` on null; render `<ModuleDetailContent>`.
3. **Wire `ModuleCard`** (`app/components/marketing/ui/ModuleCard.tsx`) — wrap
   cover+name+counts in a `Link` to `/${locale}/library/modules/${tree}/${slug}`;
   keep `InstallModuleButton` OUTSIDE the link (mirror `LibraryPackCard`).
4. Verify: `tsc`; browser → click a card → breakdown shows; install works; back
   link returns to the 4-tab library.

> Task A is independent of Task 0's storage change except that `getModuleDetail`
> reads from wherever Task 0 leaves the source. Do Task 0 first.

---

## TASK B — Curation publish (now a Convex mutation, not a file write)
The owner hand-grouped the default **lists/sentences** into folders; that
arrangement lives only in their account. Publishing captures a folder into a
`libraryModules` row. (Categories need no publish tool — see Task C.)

1. **`publishFolderAsModule` mutation** (`convex/contentModules/publish.ts`).
   Args `{ folderId, slug, tier, name? }`. Auth: `requireCallerIsAdmin` + owns the
   folder. Reads the `profileFolders` row + its `profileLists`/`profileSentences`
   (`by_folder_id_and_order`), serialises into the `ListModule`/`SentenceModule`
   item shape (reuse the per-item logic from
   `resourcePacks.ts:getPackContentForPublish` — list items + sentence slots are
   the same shapes), and **upserts a `libraryModules` row** (`by_tree_and_slug`):
   folder name/colour/imagePath → module name/colour/coverImagePath; items →
   `items[]`; set `publishedAt`, tier. No FS, no barrel, no commit — works in
   production.
   - R2 assets: account-scoped custom images/recordings stay under
     `accounts/<id>/…`. Decide per ADR whether to copy them to a module-scoped
     prefix (the old `promoteAssetsToPackPrefix` pattern) or reference in place;
     simplest first pass references in place (revisit if account deletion would
     orphan a published module's assets).
2. **"Publish as module" button** — admin-only, **per-folder in the groups edit
   mode**. In `app/components/app/shared/sections/GroupsView.tsx` /
   `GroupTile.tsx`, add an admin-gated action (gate like
   `app/components/app/categories/sections/CategoriesContent.tsx:68`
   `showAdminBadges`/`viewMode==='admin'`). Opens a small modal: folder name →
   slug (editable) + tier select + confirm → calls the mutation → toast. Model
   the modal on `LibraryPackPickerModal.tsx` (but it calls a mutation, not a route).
3. Verify: admin edits a list folder → Publish → a `libraryModules` row appears →
   the module shows in the Lists tab → install into a second profile materialises
   it. All live, no deploy.

---

## TASK C — Default categories → one `core` module (seed a row)
The owner left categories flat. Seed the starter's 16 flat categories as ONE
`libraryModules` category row. One-time mutation (or extend the Task 0 seed):
read `convex/data/library_packs/_starter.json` `categories[]` → one row
`{ tree:"categories", slug:"core", name, defaultTier:"free", items: <16 cats>,
publishedAt: now }` (NOT `isStarter` — it's published). Pick a clearer slug than
`core` if desired (owner's call). Do NOT seed the starter's lists/sentences — the
owner's hand-grouped folders (Task B) supersede those stale ungrouped ones.

---

## TASK D — `_defaults` manifest + `seedDefaultAccount` rewrite
1. **Default-load manifest** — the list of `{ tree, slug }` a new account
   auto-installs. Either a tiny committed file (`convex/data/_defaults.json` +
   reader) or a flag on `libraryModules` rows (`isDefault: boolean`) queried at
   seed time. A flag is more consistent with "Convex is the source of truth";
   pick per owner preference. Initially: `core` (categories) + each list/sentence
   folder slug published in Task B.
2. **Rewrite `seedDefaultAccount`** (`convex/profileCategories.ts:36`, currently
   `loadStarterTemplateInlineV2` → `materialisePackFromJson(_starter)`). New body:
   resolve the default module refs, `getModuleBySlug(ctx, tree, slug)` +
   `installContentModule(ctx, accountId, module)` (the shared helper in
   `convex/lib/contentModuleInstall.ts` — bypasses tier/dedup gates, correct for
   seeding) per ref. Keep the idempotency guard (skip if the account already has
   categories). Trigger path unchanged (scheduled from `studentProfiles.ts` on
   first-profile creation).
3. **Existing pre-launch accounts** (master-plan migration A.2): recommended
   **re-seed from the manifest** (pre-launch data is disposable). A `migrations.ts`
   mutation that wipes + re-seeds, run by the owner. Full `npx convex export`
   backup FIRST (owner — CLAUDE.md Backups).
4. Verify: fresh account (or `reseedAccount`) gets exactly the default modules;
   idempotent on re-run.

---

## TASK E — Surgical translation discipline (principle to honour; light build)
Per the ADR addendum, any content-translation path must be **idempotent and
additive**: key each translatable string by a hash of its English source;
(re)translate a locale value only when it is missing or its source hash changed;
never overwrite a good existing translation. The 17 themed modules + starter are
already translated (carried over from the packs), so 13.4 has nothing to
re-translate — but when a new folder is published (Task B) its non-English copy
needs filling. Implement the surgical rule when wiring that translation step
(mirror the UI-string pipeline `app/api/admin/translate-ui-strings/route.ts`,
which only translates absent keys). Can ship after B if content is English-first
initially.

---

## TASK F — Periodic export to git (the audit-trail safety net) + cleanup
- **Exporter** (`scripts/export-library-modules.mjs` or a Convex query +
  thin script): dump `libraryModules` to `convex/data/<tree>/<slug>.json` in
  stable key order, for git-committed review/rollback (the `backup-symbols.mjs`
  pattern). These files are a **backup/review artifact, not the live source**.
- **Cleanup**: delete the `test-*.json` fixtures + retire the JSON-as-source
  barrels/readers once Task 0 is verified. Confirm the library shows only real
  curated + themed modules.

---

## Out of scope here (later phases)
- **13.5 migration**: re-point `librarySourceId` pack→module on existing
  installed content; leave `library_packs` inert.
- **13.6 soft suggest-on-save**.
- **Themes stay bundled** (ADR addendum): theme *tokens* remain in
  `lib/themes/registry`; `themeLifecycle` already in Convex; do not move them.
