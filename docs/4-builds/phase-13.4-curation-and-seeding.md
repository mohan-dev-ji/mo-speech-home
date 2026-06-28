# Phase 13.4 — Module detail pages, curation publish, default-load manifest & seed

Standalone execution plan for a fresh session. Self-contained — no prior chat
context needed. Branch: `phase-13-content-modules` (worktree
`.claude/worktrees/determined-feynman-937655`). Implements the back half of
ADR-014 (see `docs/4-builds/decisions/` and `.claude/plans/plan-phase-13-expressive-yeti.md`).

## Worktree conventions (read first)
- **Never run `npx convex dev`** in this worktree (goes anonymous + rewrites
  `.env.local`). Cloud dev deployment is `wandering-marmot-955` (EU). To verify
  Convex: `npx convex codegen` (safe, re-bundles + uploads) then
  `npx tsc --noEmit -p convex/tsconfig.json`. **Cannot run Convex mutations from
  the worktree** — the owner runs migrations via the Convex dashboard.
- Frontend check: `npx tsc --noEmit` (ignore the one pre-existing
  `lib/stripe.ts` version-string error).
- Don't start `next dev` — owner keeps it on `localhost:3000`. Verify authed UI
  via Claude-in-Chrome against the owner's logged-in browser (`/en/...`); the
  signed-out preview tool can't see authed pages.
- Node 20 for Convex CLI: `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- UI copy → `messages/en.json` only. AAC UI uses `--theme-*` tokens. Components
  under `app/components/{domain}/{type}/`.
- `npx convex run` / mutations: hand off to the owner (dashboard → Functions).

## What's already DONE (do not redo)
- **13.0–13.3**: schema (`profileFolders`, `folderId`, three `*Lifecycle`
  tables), per-type install/admin/catalogue, 4-tab library
  (`app/[locale]/(public)/library/modules/`), group folders, breadcrumb trail,
  delete+reinstall (`/api/uninstall-content-module`, `delete{…}Module` +
  orphan queries), `InstallModuleButton` with Remove.
- **Themed-pack conversion**: `scripts/convert-packs-to-modules.mjs` (idempotent)
  split the 7 themed packs into 17 per-type module JSONs at their tiers
  (christmas/dinosaurs/diwali/fun/religion = cat+list+sentence; space/vehicles =
  cat only). Barrels auto-regenerated. `migrations.ts:publishConvertedPackModules`
  published them — **already run** on `wandering-marmot-955`. `library_packs/`
  left inert. Cover fallback: placeholder `static/pack-cover-default.webp` →
  first content image.
- **Test fixtures**: `convex/data/{categories,lists,sentences}/test-*.json`
  (`isStarter:true`). Delete these once real default modules exist (task 4).

---

## TASK A — Finish module detail pages (started; backend done, UI not)

Owner wants clicking a library module card to open a per-slug detail page with a
full symbol/list/sentence breakdown, like the old pack detail (`/library/[slug]`).

**Already built**: `convex/contentModules/detail.ts` → `getModuleDetail(tree, slug)`
query. Returns a **pack-detail-compatible shape** (only the module's own tree
populated; resolves symbolstix `symbolId`→image+label live from the `symbols`
table): `{ tree, slug, name, description, coverImagePath, tier, isStarter,
counts, categories[], lists[], sentences[] }`. Typechecks clean; currently
unwired (harmless orphan).

**Still to build** (copy the pack equivalents):
1. **`ModuleDetailContent.tsx`** under `app/components/marketing/sections/` —
   copy `PackDetailContent.tsx` (269 lines) almost verbatim. Changes:
   - type gains `tree`; `coverImagePath`/`description` are nullable → guard the
     hero cover (`<img>` only when non-null, else the muted empty box).
   - back link → `/${locale}/library/modules` (add i18n key
     `library.moduleDetailBack` = "Back to library").
   - bottom CTA: `InstallModuleButton` (props `slug`, `tree`, `tier`) instead of
     `LoadPackButton`. Reuse its `SymbolTile` + the categories/lists/sentences
     sections as-is.
2. **Route** `app/[locale]/(public)/library/modules/[tree]/[slug]/page.tsx`
   (server) — copy `app/[locale]/(public)/library/[slug]/page.tsx`. Slug is NOT
   globally unique (same slug exists in 3 trees) → route MUST carry both `tree`
   and `slug`. Preload `api.contentModules.detail.getModuleDetail`,
   `notFound()` on null, render `<ModuleDetailContent>`. Validate `tree` ∈
   {categories,lists,sentences}.
3. **Wire `ModuleCard`** (`app/components/marketing/ui/ModuleCard.tsx`) — wrap
   the cover+name+counts in a `Link` to `/${locale}/library/modules/${tree}/${slug}`,
   keep `InstallModuleButton` OUTSIDE the link (mirror `LibraryPackCard`).
4. Verify: `npx tsc --noEmit`; browser → click a module card → detail page shows
   the breakdown; install button works; back link returns to the 4-tab library.

---

## TASK B — Curation publish (the new "publish folder as module" tool)

### Concept (the non-obvious part)
Module content lives as **committed JSON files** in `convex/data/{type}/<slug>.json`
(version-controlled, bundled at deploy). "Publish" reads account content from
Convex and **writes one of those files** via Node `fs` — works ONLY in local dev
(the dev server runs on the owner's machine, same FS as the repo). The owner then
reviews the git diff and commits. A deployed server can't do this. This is a
builder authoring tool, not an end-user feature. It's exactly how packs are
authored today.

### Why only lists/sentences need it
The owner left **categories** flat (unchanged from starter) → auto-convert them
(Task C), no publish tool needed. The owner **hand-grouped lists/sentences** into
folders — that arrangement lives only in their account, in no file — so those
folders are what the publish tool captures.

### Model to generalise (existing pack publish)
- `app/api/admin/pack-publish/route.ts` — dev-only (`isDevEnvironment()`, 403
  elsewhere). Steps: Clerk+admin auth → query content from Convex → promote
  account-scoped R2 assets to a pack prefix (`promoteAssetsToPackPrefix`) → build
  JSON → `fs.writeFile(convex/data/.../<slug>.json)` → `rebuildBarrel()`
  (rescans dir, rewrites `_index.ts`) → mark published. Body `{ slug }`.
- `convex/resourcePacks.ts:getPackContentForPublish` (~:2881) — the reverse of
  materialise: reads the admin's `profile{Categories,Lists,Sentences}` filtered
  by `librarySourceId === slug` and emits `LibraryPack`-shaped JSON (symbolstix
  → `{symbolId, labelOverride}`, custom → `{imageSourceType, imagePath, label,…}`).

### Build
1. **`getFolderContentForPublish(folderId)` query** (new, e.g.
   `convex/contentModules/publish.ts`). Auth: admin (`requireCallerIsAdmin`) +
   owns the folder. Reads the `profileFolders` row + its `profileLists` OR
   `profileSentences` (by `by_folder_id_and_order`), serialises into
   `ListModule`/`SentenceModule` shape (`convex/data/_shared/types.ts`): folder
   name/colour/imagePath → module name/colour/coverImagePath; items → module
   `items[]`. Reuse the per-item serialisation logic from
   `getPackContentForPublish` (lists items + sentence slots are the same shapes).
   Return `{ tree, module }`.
2. **`/api/admin/folder-publish/route.ts`** — generalise pack-publish. Body
   `{ folderId, slug, tier, name? }`. Dev-only guard + Clerk+admin. Steps: call
   `getFolderContentForPublish` → `promoteAssetsToPackPrefix` (reuse; target
   prefix `<tree>/<slug>/…`) → write `convex/data/<tree>/<slug>.json` →
   rebuild that tree's barrel (reuse the `regenBarrel` logic from
   `scripts/convert-packs-to-modules.mjs`, or factor it into a shared module) →
   upsert the `{list,sentence}Lifecycle` row (`publishedAt=now`, tier) via the
   existing `update{List,Sentence}Lifecycle` mutation. Return a summary.
3. **"Publish as module" button** (DECISION: per-folder, in edit mode). In
   `app/components/app/shared/sections/GroupsView.tsx` / `GroupTile.tsx`, add an
   admin-only action on each folder (gate on the same admin signal the trees use
   — see `showAdminBadges`/`viewMode==='admin'` in
   `app/components/app/categories/sections/CategoriesContent.tsx:68`). Opens a
   small modal: folder name → slug (editable) + tier select + confirm → POST the
   route → toast. Model the modal on `LibraryPackPickerModal.tsx`.
4. Verify (owner-driven, local dev only): admin edits a list folder → Publish →
   `convex/data/lists/<slug>.json` appears + barrel updated + lifecycle row; the
   module shows in the Lists tab of the library; install it into a second
   account → folder + lists materialise.

---

## TASK C — Default categories → one "core" module (DECISION: auto-convert)
Extend `scripts/convert-packs-to-modules.mjs` (or a sibling one-off) to read
`convex/data/library_packs/_starter.json`, take its 16 flat `categories[]`, and
emit ONE `convex/data/categories/core.json` (`CategoryModule`, `defaultTier:"free"`,
NOT `isStarter` — it's published, not bypass-visible). Do NOT convert the starter's
lists/sentences (they're the stale ungrouped ones; the owner's hand-grouped
folders supersede them via Task B). Regenerate the categories barrel. Then publish
its lifecycle: extend `migrations.ts:publishConvertedPackModules` already covers
all non-starter modules, so a fresh run (owner, dashboard) publishes `core` too —
OR add it to a dedicated publish step. Pick a clearer slug than `core` if desired
(owner's call).

---

## TASK D — `_defaults.json` manifest + `seedDefaultAccount` rewrite
1. **`convex/data/_defaults.json`** — committed manifest of the modules a NEW
   account auto-installs: an array of `{ tree, slug }`. Initially: `core`
   (categories) + each list/sentence folder slug published in Task B. Add a tiny
   reader in `convex/lib/contentModules.ts` (e.g. `getDefaultModuleRefs()`).
2. **Rewrite `seedDefaultAccount`** (`convex/profileCategories.ts:36`, currently
   `loadStarterTemplateInlineV2` → `materialisePackFromJson(_starter)`). New body:
   iterate the manifest, `getModuleBySlug(tree, slug)` + `installContentModule`
   (the shared helper in `convex/lib/contentModuleInstall.ts` — bypasses the
   public install mutation's tier/dedup gates, correct for seeding). Keep the
   idempotency guard (skip if the account already has categories). Trigger path
   unchanged (scheduled from `studentProfiles.ts` on first-profile creation).
3. **Migration for existing pre-launch accounts** (plan step A.2): recommended
   **re-seed from the manifest** (pre-launch data is disposable). A
   `migrations.ts` mutation that wipes + re-seeds, OR document a manual reseed.
   Full `npx convex export` backup FIRST (owner runs it — see CLAUDE.md Backups).
4. Verify: create a fresh account (or `reseedAccount`) → it gets exactly the
   manifest modules; idempotent on re-run.

---

## Cleanup (end of 13.4)
- Delete `convex/data/{categories,lists,sentences}/test-*.json` fixtures + their
  barrel entries (re-run the conversion script which rescans, or remove by hand).
- Confirm the 4-tab library shows only real curated + themed modules.

## Then: 13.5 migration (re-point `librarySourceId` pack→module, leave
`library_packs` inert) and 13.6 soft suggest-on-save. See the master plan.
