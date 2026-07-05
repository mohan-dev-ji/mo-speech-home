# Phase 13 — Content Modules + Three-Tree Organisation (implements ADR-014)

## Context

Mo Speech Home stores library content as **bundled packs**: one
`convex/data/library_packs/<slug>.json` file carries `categories[] + lists[] +
sentences[]`, installed as a unit. ADR-010 made packs JSON-source-of-truth with a
thin `packLifecycle` overlay; ADR-011 generalised that into a plugin pattern
(JSON modules + `<type>Lifecycle` + three admin functions). The GLP research
(`docs/2-research/gestalt-language-processing/` docs 6–8) showed the bundle forces
three different organising axes — symbols are **semantic** (by topic), lists
**procedural** (by skill), sentences **pragmatic** (by situation) — into one
browse unit, and keeps sentences as nested snapshot arrays instead of first-class
objects.

ADR-014 resolves this: promote categories, lists, sentences to **first-class
module plugin types**, organise the app as **three trees**, and present the
library as **four tabs** (Categories · Lists · Sentences · Themes), module→tree
install 1:1. Collections/bundles are explicitly deferred (V1 = none).

**This phase is the foundation for the GLP roadmap (Phases 14–18).** It is the
riskiest change to the content model, so it must be staged, migration-safe, and
non-destructive to existing accounts (the MVP has 100+ live users on the sibling
deployment; this build is pre-launch but the migration patterns must be sound).

### Owner decisions captured this session (these refine ADR-014)

1. **A "module" = one curated, named, single-type *folder*** (e.g. list-module
   "Life skills", sentence-module "Talking about food"). It is the atomic
   installable unit; installing it adds **one default folder** to the matching
   tree (module ↔ default folder is 1:1). Folders are **semantic groupings that
   cut across the old packs** — the starter pack's content re-curates into proper
   folders (Food / Going places / Feelings…), it does not slice mechanically per
   source pack.
2. **No sentence-slot symbol-reference enrichment.** In reality list/sentence
   slots don't use symbols for *labels* — symbols are only used to *generate* a
   sentence's text + TTS audio. So there is nothing per-slot to resolve live.
   ADR-014 §4's "text live" requirement is, in practice, **carried entirely by
   category symbol labels, which already resolve live** today
   (`profileCategories.getProfileSymbolsWithImages` returns the full
   `label: Record<lang,string>`, rendered via `displayString`). List/sentence
   **copy** (name/text/item descriptions) is an acceptably frozen per-account
   snapshot. → **Record this as an ADR-014 addendum**; do **not** build new
   live-copy resolution machinery in Phase 13.
3. **Default folders ship in Phase 13; user-custom folders (create/rename/move)
   are the immediate fast-follow slice.**
4. **Curation pipeline = in-app curate → publish**, generalising today's admin
   flow (`LibraryPackPickerModal` → `/api/admin/pack-publish`). A default-load
   manifest lists which modules new accounts auto-receive. SLP "better content"
   suggestions later ride the ADR-013 contributor/staging pattern (out of scope
   here).

---

## Architecture

### The folder primitive (new)

One shared folder mechanism, three trees on top. A new table groups the existing
per-account item tables; a `folderId` foreign key is added to each item table.

```
profileFolders                         // the shared primitive
  accountId: Id<"users">
  profileId?: Id<"studentProfiles">    // keep optional, mirror existing tables
  tree: "categories" | "lists" | "sentences"   // which tree it files into
  name: localisedString
  icon?: string
  colour?: string
  imagePath?: string                   // R2 folder cover
  order: number
  source: "module" | "user"            // default (installed) vs user-custom
  librarySourceId?: string             // module slug when source==="module"
  updatedAt: number
  // indexes: by_account_id, by_account_and_tree_and_order,
  //          by_profile_id, by_library_source_id
```

Add `folderId: v.optional(v.id("profileFolders"))` to **`profileCategories`,
`profileLists`, `profileSentences`** (`convex/schema.ts:345/477/527`), with a
`by_folder_id_and_order` index on each. Optional so existing rows survive until
the migration assigns them; queries treat `folderId == null` as "ungrouped / root".

> A *list* and a *sentence* are the same shape (an ordered composition that keeps
> its parts) — ADR-014 §2. They differ only by `tree` + which item table they live
> in. The folder primitive is genuinely shared across all three trees.

### Module storage (per-type, ADR-011 pattern)

New JSON directories mirroring `library_packs/` + per-type lifecycle tables:

```
convex/data/categories/<slug>.json   + categoryLifecycle  overlay
convex/data/lists/<slug>.json        + listLifecycle      overlay
convex/data/sentences/<slug>.json    + sentenceLifecycle  overlay
```

- **Module JSON shape**: one folder's worth of one type. Reuse/factor the field
  shapes already in `convex/data/library_packs/types.ts` (LibraryPackCategory /
  …List / …Sentence) into a shared `convex/data/_shared/types.ts`; a module file =
  `{ slug, name, icon?, colour?, coverImagePath?, defaultTier, isStarter?,
  provenance?: {author, version, licence}, items: [...] }`. `provenance` is
  metadata only (ADR-014 §6) — never a browse axis.
- **Lifecycle tables** clone `packLifecycle` (`convex/schema.ts:755`) per type:
  `categoryLifecycle / listLifecycle / sentenceLifecycle`, same fields
  (`slug, name?, description?, coverImagePath?, publishedAt?, expiresAt?,
  lastPublishedAt?, featured, tierOverride?, tags?, notes?, createdBy, updatedAt`)
  and same `by_slug` / `by_createdBy` indexes + same visibility rule
  (`publishedAt <= now && (expiresAt unset || expiresAt > now)`, starter bypass).
- **Three universal admin functions per type** (mirror `resourcePacks.ts`):
  `listAll{Categories,Lists,Sentences}ForAdmin`, `update{…}Lifecycle`,
  `delete{…}Lifecycle`.
- **Catalogue access helpers** per type, modelled on `convex/lib/libraryPacks.ts`
  (`getLibraryPackBySlug`, `getStarterLibraryPack`): `getCategoryModuleBySlug`,
  `listCategoryModules`, etc., reading the bundled JSON.

### Three trees + 4-tab library

- **Trees**: Categories / Lists / Sentences pages render `folders → items`.
  Today they render flat (`CategoriesContent.tsx`, `ListsModeContent.tsx`,
  `SentencesModeContent.tsx`). Add a folder grouping layer; items with
  `folderId == null` render in a root/"Ungrouped" group for back-compat.
- **Library**: extend the catalogue UI to **four tabs**. `getPublicLibrary
  CatalogueV2` (`resourcePacks.ts:3239`) becomes three per-type catalogue queries
  (`getPublic{Category,List,Sentence}Catalogue`) joining module JSON + lifecycle,
  plus the existing Themes tab. Tab content reuses the `LibraryGrid` card pattern.
  Install button calls the per-type `install{…}Module` mutation.

### Navigation, routing & breadcrumbs (the new folder level)

Folders add a level **above** every tree's items, so each tree gets one segment
deeper and the topbar breadcrumb must render the extra node.

**Today** (from `TopBar.tsx:69–122` + `BreadcrumbContext.tsx`): the breadcrumb is
`Section › <one optional detail>`. The section is `segments[0]`; the single detail
node comes from `setBreadcrumbExtra({label, colour?})` set by a detail page. Route
depth today: Categories `2` (`/categories` → `/categories/[categoryId]`), Lists `2`
(`/lists` → `/lists/[listId]`), Sentences **`1`** (`/sentences` only, all editing
inline — **no detail route**).

**After Phase 13** — folders are the new top of each tree:

| Tree | Route depth | Breadcrumb trail |
|---|---|---|
| Categories | `/categories` (folders) → `/categories/[folderId]` (grids) → `/categories/[folderId]/[categoryId]` (board) | Categories › ‹folder› › ‹category› |
| Lists | `/lists` (folders) → `/lists/[folderId]` (lists) → `/lists/[folderId]/[listId]` (detail) | Lists › ‹folder› › ‹list› |
| Sentences | `/sentences` (folders) → `/sentences/[folderId]` (sentences, editing stays inline) | Sentences › ‹folder› › ‹sentence?› |

- **Lists and Sentences go one level deeper** (gain the folder level); Sentences
  in particular gains a `[folderId]` route where it had none.
- **Breadcrumb supports a trail, not one extra node.** Change
  `BreadcrumbExtra` (`app/contexts/BreadcrumbContext.tsx`) from a single
  `{label, colour?} | null` to an **ordered array** of crumbs, and update
  `TopBar.tsx:112–122` to render N detail nodes joined by chevrons. Folder pages
  push `[{folder}]`; item pages push `[{folder}, {item}]`. Keep the existing
  colour-dot affordance per crumb.
- **Categories is the base model for the new folder + edit-mode UX.** The folder
  list view and its edit affordances on Lists and Sentences should mirror
  `CategoriesContent.tsx` (grid of tiles, create/delete/reorder via dnd-kit @8px,
  pack filter, free-tier gating, admin badges) rather than inventing new patterns.
  Lists keeps its inline-rename nicety; Sentences (which was flattest) gains the
  full folder-level create/rename/delete/reorder by copying the Categories model.
- Existing `setBreadcrumbExtra` callers (`CategoryDetailContent:445`,
  `ListDetailContent:135`) migrate to the array form.

### Install / materialise (per type, 1:1 → one folder)

Generalise `materialisePackFromJson` (`resourcePacks.ts:453`) and
`materialiseSymbolsFromJson` (`resourcePacks.ts:339`) into per-type installers:

- `installCategoryModule(slug)` → creates one `profileFolders` row
  (`source:"module"`, `tree:"categories"`, `librarySourceId: slug`), then inserts
  its `profileCategories` (+ `profileSymbols`) with `folderId` set and
  `librarySourceId = slug`, `librarySourceCategoryKey = item.key` for reload.
- `installListModule` / `installSentenceModule` analogous (folder + `profileLists`
  / `profileSentences`).
- **Dedup gate** (reuse the pattern in `loadResourcePackV2`): reject if the
  account already has a `profileFolders` row with this `librarySourceId`.
- **Tier gate + visibility**: reuse lifecycle `tierOverride ?? defaultTier` and
  the publish-window check from `loadResourcePackV2:854`.
- Returns `{ slug, foldersAdded, itemsAdded, symbolsAdded?, symbolsSkipped? }`.

### Self-contained sentences (narrowed per owner decision 2)

- **Structure frozen**: a sentence's `slots[]` already embed `imagePath` +
  `displayProps` — that *is* the structural snapshot; deleting any category never
  breaks it. No change needed.
- **Text live**: carried by **category symbol labels** (already resolve live from
  the global `symbols` table). Sentence/list *copy* stays a per-account snapshot —
  acceptable because that copy is generated/custom, not symbol-label-derived.
- **Action**: write an **ADR-014 addendum** documenting that §4's live-text scope
  is category symbol labels only; build no new resolution code. Re-pointing
  `librarySourceId` to module slugs (migration below) keeps the door open if
  live-copy resolution is ever wanted.

### Delete + reinstall (hard installed-vs-user line, ADR-014 §5)

- `delete{…}Module(folderId)`: deletes the folder + its module-sourced items +
  their R2 orphans. **Never** touches `source:"user"` folders or items the user
  authored. Reuse the orphan-key collection pattern in
  `getCategoryReloadOrphanKeys` (`profileCategories.ts:467`) — R2 deletes happen
  in the Next.js API route, outside the mutation.
- **Warn on delete** that customisations to that module are lost (UI copy only).
- **Reinstall = fresh copy**: re-run `install{…}Module`; the dedup gate is cleared
  once deleted. Reload-in-place (`reloadCategoryFromLibrary`,
  `profileCategories.ts:386`) generalises to module slugs for per-folder refresh.

### Soft suggest-on-save (ADR-014 §7)

Behavioural only. When a sentence is saved while the user is working inside a
category/folder, **default** the save-target folder to the matching sentences
folder (match on a soft name/`librarySourceId` rhyme); user can override. No
structural link, no forced mirror. Small client-side default in the save flow
that surfaces the sentences tree (`SentencesModeContent` save path).

### Curation pipeline (owner decision 4 — in-app curate → publish)

Generalise the existing admin publish flow:

- `LibraryPackPickerModal` (`app/components/app/shared/modals/LibraryPackPicker
  Modal.tsx`) → a per-type "Publish folder as module" modal: admin arranges a
  folder in a curator account, publishes → writes
  `convex/data/{type}/{slug}.json` via a generalised `/api/admin/pack-publish`
  route, and upserts the lifecycle row (reuse `resolveTargetLifecycleV2` /
  `updatePackLifecycle` patterns, `resourcePacks.ts:1892/2621`).
- **Default-load manifest**: a small committed file (e.g.
  `convex/data/_defaults.json`) listing the module slugs new accounts auto-install.
  `seedDefaultAccount` (currently calls `materialisePackFromJson`) iterates the
  manifest and calls the per-type installers. **Re-curating the starter = editing
  folders in-app + republishing + updating the manifest — no code edits.**
- SLP "better content" suggestions are out of scope (ADR-013 contributor/staging
  pattern, later phase) — flag, don't build.

---

## Migration (the riskiest part — staged, non-destructive)

**Before any migration step: full Convex backup** (CLAUDE.md "Backups"):
`source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex export --path
backups/<date>-phase13-pre.zip` (local-only, gitignored). Also snapshot symbols
(`scripts/backup-symbols.mjs`) if touching them.

The migration has two distinct halves — keep them separate:

### A. Code migration (mechanical, safe, automated)

A new `migrations.ts` mutation, run once per deployment (mirror
`backfillLibrarySourceIdFromPackSlug`, `migrations.ts:1046`):

1. For every existing account, group each item table's rows by their current
   `librarySourceId` (old pack slug) and create one `profileFolders` row per
   (pack-slug, tree) named after the source pack — a **non-destructive fallback
   grouping** so nothing looks broken. Set items' `folderId`.
2. **Re-point `librarySourceId`** from pack slug → module slug. Since modules are
   re-curated (not 1:1 with packs), the launch reality is: existing pre-launch
   accounts can be re-seeded from the new default manifest rather than mapped
   item-by-item. Decide per the open question below.
3. Leave `packLifecycle` + `library_packs/` **inert** (ADR-010 deferred-cleanup
   pattern); drop only after the split has soaked. Do not delete in this phase.

### B. Content re-curation (manual, tooling-enabled — not code)

Using the curation pipeline above, the owner re-authors the starter + launch
library content into properly-named folder-modules and updates the default
manifest. This is a **content task**, gated by the curation tooling shipping
first, not by code migration.

---

## Staged, independently-shippable slices

| Slice | Ships | Verify |
|---|---|---|
| **13.0 Schema + module storage** | `profileFolders` table, `folderId` on 3 item tables, per-type JSON dirs + `categoryLifecycle/listLifecycle/sentenceLifecycle`, shared types, per-type catalogue/admin functions. No UI yet. | `npx convex dev` deploys cleanly; admin functions return empty lists. |
| **13.1 Install + trees (default folders)** | Per-type `install{…}Module` + dedup/tier gates; trees render `folders → items`; ungrouped fallback. Lists/Sentences gain a `[folderId]` route level (Sentences had none); folder-list views mirror the `CategoriesContent` base model. | Install a hand-seeded module → folder appears in the right tree with items; navigate folder → item in all three trees; dedup blocks re-install. |
| **13.1b Breadcrumb trail** | `BreadcrumbExtra` → ordered array; `TopBar` renders N crumbs (Section › Folder › Item); existing detail-page callers migrated. | Breadcrumb shows the full path at each depth in all three trees; colour dot preserved. |
| **13.2 Four-tab library** | Per-type catalogue queries + 4-tab library UI + install buttons. | Each tab lists its modules; install from each tab materialises into its tree. |
| **13.3 Delete + reinstall** | `delete{…}Module` + R2 orphan route + warn-on-delete; reload-per-folder. | Customise a module, delete (warned), reinstall → fresh copy; user folders untouched. |
| **13.4 Curation pipeline + manifest** | "Publish folder as module" flow, generalised `/api/admin/pack-publish`, default-load manifest, `seedDefaultAccount` rewrite. | Admin curates a folder → publishes → JSON written + lifecycle upserted; new account seeds from manifest. |
| **13.5 Migration** | Backup → code migration (A) → owner re-curation (B). `library_packs` left inert. | Existing account opens with all content intact in fallback folders; new accounts get re-curated defaults. |
| **13.6 Soft suggest-on-save** | Save-target default to rhyming sentences folder, overridable. | Save sentence from inside a category → suggests matching sentences folder. |
| **Fast-follow (post-13)** | User-custom folders: create/rename/move/delete. | — |

Each slice is a separate PR on a `phase-13-content-modules` branch.

### Test plan (end-to-end, per ADR-014 constraints)

- **Dual-profile** (instructor edit view + student locked view): folders/trees
  render correctly in both; student view hides admin curation affordances.
- **Multi-language (Hindi + English)**: category symbol labels resolve live in
  both (the §4 "text live" guarantee); module names/list+sentence copy show the
  account's snapshot; switching locale never blanks a board (`displayString`
  3-tier fallback, `lib/languages/displayValue.ts`).
- **Delete → reinstall**: module folder + items removed, user folders/items
  survive; reinstall brings a clean copy; R2 orphans cleaned.
- **Migration dry-run** on a copy of an existing account: every pre-existing
  category/list/sentence still present and openable post-migration.
- **Convex billing watch**: migration walks all accounts — run off-peak, batch
  with `.take(n)` + scheduler continuations per the guidelines (no unbounded
  `.collect()` writes); confirm against the $10/$20 spend limits.

---

## Open questions / decisions for the owner

1. **Existing pre-launch accounts (migration step A.2)** — re-seed from the new
   default manifest (clean, simple, throws away any pre-launch tinkering) **vs**
   map old pack items into re-curated folders item-by-item (preserves tinkering,
   much more work)? Recommend **re-seed** since this is pre-launch and the data is
   disposable. Confirm.
2. **ADR-014 §4 addendum** — confirm documenting that "text live" = category
   symbol labels only (list/sentence copy is an accepted frozen snapshot), so we
   build no live-copy resolution. (This is the owner's Q2 reasoning, written down.)
3. **Module = folder grain** — confirm a module is always exactly one folder
   (no multi-folder modules, no nested folders in V1; "Lesson 01" curriculum
   nesting and inter-list ordering are deferred per dossier doc 7).
4. **Provenance fields** — minimum viable `{author, version, licence}` on module
   JSON + lifecycle now, or defer to the SLP-contributor phase? Recommend a
   minimal stub now (cheap, future-proofs crediting).

---

## Critical files

- **Schema**: `convex/schema.ts` (add `profileFolders`, `folderId` ×3, three
  `*Lifecycle` tables) — patterns at `:345/477/527/755`.
- **Module backend**: new `convex/contentModules/{categories,lists,sentences}.ts`
  (install/admin/catalogue), modelled on `convex/resourcePacks.ts`
  (`materialisePackFromJson:453`, `materialiseSymbolsFromJson:339`,
  `getPublicLibraryCatalogueV2:3239`, lifecycle helpers `:1860–2766`).
- **Catalogue helpers**: new `convex/lib/contentModules.ts`, modelled on
  `convex/lib/libraryPacks.ts`.
- **JSON + types**: `convex/data/{categories,lists,sentences}/`,
  `convex/data/_shared/types.ts` (from `library_packs/types.ts`),
  `convex/data/_defaults.json`.
- **Migration**: `convex/migrations.ts` (new mutation beside
  `backfillLibrarySourceIdFromPackSlug:1046`).
- **Trees UI**: `app/components/app/{categories,lists,sentences}/sections/
  *Content.tsx` (folder grouping layer; Lists/Sentences mirror the
  `CategoriesContent.tsx` folder + edit-mode base model).
- **Routing**: add `app/[locale]/(app)/categories/[folderId]/...`,
  `lists/[folderId]/...`, and `sentences/[folderId]/page.tsx` (new folder level;
  Sentences gains its first sub-route).
- **Breadcrumbs**: `app/contexts/BreadcrumbContext.tsx` (single → array trail),
  `app/components/app/shared/sections/TopBar.tsx:112–122` (render N crumbs);
  migrate `CategoryDetailContent.tsx:445`, `ListDetailContent.tsx:135` callers.
- **Library UI**: `app/[locale]/(public)/library/page.tsx`,
  `app/components/marketing/sections/LibraryGrid.tsx` (→ 4 tabs).
- **Curation**: `app/components/app/shared/modals/LibraryPackPickerModal.tsx`,
  `app/api/admin/pack-publish/route.ts`.
- **i18n**: all new copy → `messages/en.json` only (pipeline merges fallbacks).

## Guardrails (project rules)

- Never hard-code `"eng"` / locale; all UI copy via `useTranslations` → `en.json`
  only.
- AAC UI uses `--theme-*` tokens only.
- Components under `app/components/{domain}/{type}/`; thin `page.tsx`.
- Convex: validators on every function, indexes not `.filter()`, no unbounded
  `.collect()` writes, batch large migrations (`convex/_generated/ai/guidelines.md`).
- Read `docs/4-builds/decisions/` before any further architecture change; write
  the ADR-014 addendum (decision 2 above) before/with slice 13.0.