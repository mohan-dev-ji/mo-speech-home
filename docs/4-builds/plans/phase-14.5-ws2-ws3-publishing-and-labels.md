# Module Publishing & Label Consistency — Implementation Plan

> ## 📌 STATUS — Stage 1 ✅ shipped & merged · Stage 2 ✅ shipped on `main`
> **Worktree:** `claude/wizardly-noyce-054294` — Stage 1 origin; Stage 2 ran on `main`.
> **Stage 1 (Tasks 1–6):** ✅ COMPLETE — built on the worktree, **merged to `main`** as
> `ba355a0`. Publishing relocated to each module's own page; single publish-class tile
> badge; legacy per-item pack UI + reload-defaults removed. App + Convex `tsc` clean.
> **Stage 2 (Tasks 7–9 — full pack teardown):** ✅ COMPLETE (2026-07-07) on `main`. Backup
> `backups/2026-07-07-pre-pack-teardown.zip` taken first; deletion manifest below (Task 7).
> Removed all pack UI/admin/routes/API, the pack-origin filter dropdown (per user decision),
> `resourcePacks.ts` + `lib/libraryPacks.ts` + the `library_packs/` JSON catalogue, 10 pack
> migrations, dead pack i18n, and the `resourcePacks` table + `packSlug`/`publishedToPackId`
> fields/indexes. Relocated `materialiseSymbolsFromJson` → `lib/materialiseSymbols.ts` and the
> `LibraryPack*` JSON types → `data/_shared/types.ts` (both still used by content modules).
> No null-out migration needed (backup showed 0/108 profile docs carried the fields, table
> empty). App + Convex `tsc` clean. **Deferred:** the vestigial `propagateToPack` mutation arg
> (inert, kept to avoid churning ~25 UI callers) and `packLifecycle` table (now likely orphaned)
> — separate cleanups. Commits: `b2c94f9` (manifest) → schema-drop commit.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move module publishing to each module's own page, replace the scattered
"Default / From pack" labels with a single admin-only publish-class badge on group
tiles, and strip the old resource-pack per-item controls from the UI.

**Architecture:** Publishing already flows through one shared `PublishModuleModal`
(default/free/pro/max picker) fired today from the *grid tile* on every tree. This plan
relocates that trigger to the module's own page (category detail; list/sentence folder
page), leaves the tile showing only a status badge, and deletes the legacy resource-pack
item UI (`RepublishButton`, "Save to pack", `LibrarySourceBadge`, `PackStatusLabel`,
`ReloadDefaultsDialog`). No schema or publish-backend changes — `publishedModuleClass` /
`publishedModuleSlug` already exist on `profileCategories` and `profileFolders`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 / Convex / next-intl v4.

## Global Constraints

- **i18n:** never hard-code UI copy — all text via `useTranslations`. Add every new key
  to **`messages/en.json` only** (never hand-add to `hi.json`/`es.json`; the pipeline
  fills those). Real English values.
- **Theme tokens:** no hard-coded colours/spacing/radii/font-size in AAC UI — use
  `--theme-*` utilities (`bg-theme-*`, `text-theme-*`, `rounded-theme-sm`, etc.).
- **Component location:** `app/components/{app|marketing|admin}/{sections|ui|modals}/`.
- **No test harness:** this project has no unit-test runner. "Verify" = `npx tsc --noEmit`
  clean (ignore the pre-existing unrelated `lib/stripe.ts` version error) + targeted
  `grep` assertions + manual check on the running dev server (port 3001, already running —
  do NOT start `npm run dev`). Convex types: `npx tsc -p convex/tsconfig.json --noEmit`
  (prefix backup/convex CLI with `source ~/.nvm/nvm.sh && nvm use 20.17.0`). Never run
  `npx convex dev`.
- **Admin gate:** `viewMode === 'admin' && useIsAdmin()` (from `ProfileContext` +
  `useIsAdmin`). Existing call sites expose this as `showAdminButtons` / `showAdminBadges`
  / `showPublish` — reuse whatever the target component already has.
- **Scope out:** old-pack *backend* (`setListInLibraryV2`, `/api/admin/pack-publish`,
  `packSlug` fields) stays dormant — do not touch. Core/Phrases publish is unchanged.

## Scope note

> **Status (updated 2026-07-06): Stage 1 (Tasks 1–6) COMPLETE & MERGED TO `main`**
> (`ba355a0`). Built on worktree `claude/wizardly-noyce-054294`. Commits _f516ac0_ ·
> _17699d5_ · _dcd6bb9_ · _9b077d6_ · _97ffd99_, plus refinements _66f335d_ (zinc-900
> badge) · _bfcd814_ (inline publish button). App + Convex `tsc` clean; merge conflict-free.
> **Stage 2 (Tasks 7–9, pack teardown) NOT started** — now runs on `main`, begins with a
> full `npx convex export` backup. The worktree stays live until Phase 14.5 completes.

Executed in two stages (Stage 1 built on a **dedicated worktree**, then merged to `main`;
Stage 2 runs on `main`):

- **Stage 1 — WS2 + WS3 (Tasks 1–6):** relocate publishing + consolidate labels. Leaves
  the old resource-pack *backend* dormant. Each task ends `tsc`-clean and committable.
- **Stage 2 — dead-component cleanup + full library-pack teardown (Tasks 7–9):** with
  Stage 1 done, the pack UI is fully orphaned, so this rips out the entire resource-pack
  system (UI, backend, data, schema). Data/schema-touching → **backup first**.

Do them in order — later Stage 1 tasks assume the shared badge from Task 1 exists and that
publish triggers moved (Tasks 2–3) before the legacy removal (Task 4). Stage 2 assumes all
of Stage 1 has landed. WS4/WS5/WS6 (the rest of Phase 14.5) proceed independently on `main`
and are NOT part of this worktree.

---

## File structure

**Create**
- `app/components/app/shared/ui/ModuleClassBadge.tsx` — the single publish-class pill
  (Default/Free/Pro/Max/Draft), admin-only, rendered on group tiles.

**Modify — publishing relocation**
- `app/components/app/categories/sections/CategoriesContent.tsx` — drop tile publish
  trigger + modal; swap badge.
- `app/components/app/categories/sections/CategoryDetailContent.tsx` — add module publish
  trigger + modal on the detail page.
- `app/components/app/shared/sections/GroupsView.tsx` — drop tile publish trigger + modal;
  add badge.
- `app/components/app/lists/sections/ListsModeContent.tsx` — add publish trigger + modal
  on the folder page banner; remove legacy labels.
- `app/components/app/sentences/sections/SentencesModeContent.tsx` — same as lists.

**Modify — legacy removal**
- `app/components/app/categories/ui/BannerEdit.tsx` — remove republish gate toggle,
  `republishSlot`, `onReloadDefaults`, `LibrarySourceBadge`, and now-dead props.
- `app/components/app/categories/ui/Banner.tsx` — remove `LibrarySourceBadge`.
- `app/components/app/lists/sections/ListDetailContent.tsx` — remove "Save to pack" +
  `RepublishButton` + `PackStatusLabel`.
- `messages/en.json` — add `moduleClass.*`; (old keys left in place, now unused).

**Delete**
- `app/components/app/categories/modals/ReloadDefaultsDialog.tsx`
- `app/api/reload-category-defaults/route.ts`
- `reloadCategoryFromLibrary` mutation in `convex/profileCategories.ts`

---

## Task 1 ✅ — Shared `ModuleClassBadge` + adopt on group tiles

**Files:**
- Create: `app/components/app/shared/ui/ModuleClassBadge.tsx`
- Modify: `messages/en.json`
- Modify: `app/components/app/categories/sections/CategoriesContent.tsx:371-378` (badgeSlot)
- Modify: `app/components/app/shared/sections/GroupsView.tsx` (add badgeSlot to its GroupTile)

**Interfaces:**
- Produces: `ModuleClassBadge({ publishedClass?: "default"|"free"|"pro"|"max" })` — renders
  the class label, or "Draft" when `publishedClass` is undefined.

- [ ] **Step 1: Add i18n keys** to `messages/en.json` (new namespace, en only):

```json
"moduleClass": {
  "default": "Default",
  "free": "Free",
  "pro": "Pro",
  "max": "Max",
  "draft": "Draft"
}
```

- [ ] **Step 2: Create the badge component**

```tsx
// app/components/app/shared/ui/ModuleClassBadge.tsx
"use client";

import { useTranslations } from "next-intl";

type ModuleClass = "default" | "free" | "pro" | "max";

/**
 * The single admin-only publish-status pill on a module's group tile. Shows the
 * published class (Default/Free/Pro/Max) or "Draft" when the module has never
 * been published. Derives purely from the row's `publishedModuleClass` — no pack
 * lookup. Callers gate rendering on admin view.
 */
export function ModuleClassBadge({
  publishedClass,
}: {
  publishedClass?: ModuleClass;
}) {
  const t = useTranslations("moduleClass");
  const isDraft = !publishedClass;
  return (
    <span
      role="note"
      className={[
        "inline-flex items-center max-w-full rounded-full font-semibold",
        "px-2 py-0.5 text-[10px] uppercase tracking-wide text-white",
        isDraft ? "bg-theme-secondary-alt-text/60" : "bg-theme-secondary-text",
      ].join(" ")}
    >
      {t(publishedClass ?? "draft")}
    </span>
  );
}
```

- [ ] **Step 3: Swap the category tile badge.** In `CategoriesContent.tsx`, replace the
  `PackStatusLabel` badgeSlot (lines 371-378) with:

```tsx
badgeSlot={
  showAdminBadges ? (
    <ModuleClassBadge publishedClass={cat.publishedModuleClass} />
  ) : undefined
}
```

  Add `import { ModuleClassBadge } from '@/app/components/app/shared/ui/ModuleClassBadge';`.
  Remove the `PackStatusLabel` import **only if** it has no other use in this file
  (grep first — the pack *filter* dropdown may still reference `adminPacks`, which is fine;
  leave `adminPacks` alone).

- [ ] **Step 4: Add the badge to list/sentence folder tiles.** In `GroupsView.tsx`, on the
  `GroupTile` render (~line 250-268), add a `badgeSlot`:

```tsx
badgeSlot={
  showPublish ? (
    <ModuleClassBadge publishedClass={folder.publishedModuleClass} />
  ) : undefined
}
```

  Add the `ModuleClassBadge` import. (`showPublish` is the existing admin gate used by
  `onPublishRequest`.)

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
```

  Manual: in admin view, category tiles + list/sentence folder tiles show a
  Default/Free/Pro/Max/Draft pill; unpublished ones read "Draft".

- [ ] **Step 6: Commit**

```bash
git add app/components/app/shared/ui/ModuleClassBadge.tsx messages/en.json \
  app/components/app/categories/sections/CategoriesContent.tsx \
  app/components/app/shared/sections/GroupsView.tsx
git commit -m "Module badge: single publish-class pill on group tiles (WS3)"
```

---

## Task 2 ✅ — Move category publish → category detail page

**Files:**
- Modify: `app/components/app/categories/sections/CategoriesContent.tsx` (remove trigger + modal)
- Modify: `app/components/app/categories/sections/CategoryDetailContent.tsx` (add trigger + modal)
- Modify: `app/components/app/categories/ui/BannerEdit.tsx` (add `onPublishModule` prop + button)

**Interfaces:**
- Consumes: `PublishModuleModal` (`kind="category"`, `targetId: profileCategories id`,
  `defaultName`, `publishedSlug?`, `publishedClass?`, `onClose`).
- Produces: `BannerEdit` gains prop `onPublishModule?: () => void` rendering a Publish
  button in the admin edit chrome.

- [ ] **Step 1: Remove the tile publish trigger from `CategoriesContent.tsx`.** Delete the
  `onPublishRequest={showAdminBadges ? ... setPublishTarget ...}` line on the `GroupTile`
  (line 386), the `published={!!cat.publishedModuleSlug}` line (385) may stay or go — keep
  `published` only if `GroupTile` still uses it for anything; otherwise remove. Delete the
  `publishTarget` state (line 107-…) and the `PublishModuleModal` mount (lines 446-456).
  Remove the `PublishModuleModal` import if now unused.

- [ ] **Step 2: Add a Publish button to `BannerEdit.tsx`.** Add `onPublishModule?: () => void`
  to `BannerEditProps`, and in the admin button row render (near the other admin buttons):

```tsx
{showAdminButtons && onPublishModule && (
  <Button
    variant="secondary"
    size="sm"
    onClick={onPublishModule}
    icon={<Upload className="w-3.5 h-3.5" />}
  >
    {t('bannerPublishModule')}
  </Button>
)}
```

  Import `Upload` from `lucide-react`. Add i18n key `categoryDetail.bannerPublishModule`:
  `"Publish as module"` to `messages/en.json`.

- [ ] **Step 3: Wire the trigger + modal in `CategoryDetailContent.tsx`.** Add state and
  mount the modal; pass `onPublishModule` to `BannerEdit` (the component already renders
  `BannerEdit` around line 497-513 and has the category doc in scope):

```tsx
const [publishOpen, setPublishOpen] = useState(false);
// ...pass to BannerEdit:
onPublishModule={showAdminButtons ? () => setPublishOpen(true) : undefined}
// ...mount near the other dialogs:
{publishOpen && (
  <PublishModuleModal
    kind="category"
    targetId={category._id}
    defaultName={displayString(category.name, language, DEFAULT_LOCALE)}
    publishedSlug={category.publishedModuleSlug}
    publishedClass={category.publishedModuleClass}
    onClose={() => setPublishOpen(false)}
  />
)}
```

  Add the `PublishModuleModal` import. (`category`, `language`, `displayString`,
  `DEFAULT_LOCALE`, `showAdminButtons` are already in scope in this file — confirm and
  reuse; do not re-declare.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
grep -n "PublishModuleModal" app/components/app/categories/sections/CategoriesContent.tsx  # expect: no output
```

  Manual (admin view): category grid tiles no longer show a publish icon; open a category,
  enter edit mode → "Publish as module" opens the tier picker; publishing sets the tile's
  badge to the chosen class.

- [ ] **Step 5: Commit**

```bash
git add app/components/app/categories/sections/CategoriesContent.tsx \
  app/components/app/categories/sections/CategoryDetailContent.tsx \
  app/components/app/categories/ui/BannerEdit.tsx messages/en.json
git commit -m "Categories: publish from the category detail page, not the grid (WS2)"
```

---

## Task 3 ✅ — Move list/sentence publish → folder page banner

**Files:**
- Modify: `app/components/app/shared/sections/GroupsView.tsx` (remove trigger + modal)
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx` (add trigger + modal in folder banner)
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (same)

**Interfaces:**
- Consumes: `PublishModuleModal` (`kind="lists"|"sentences"`, `targetId: profileFolders id`).
- Consumes: `folderDoc.publishedModuleSlug`, `folderDoc.publishedModuleClass` (from
  `api.profileFolders.getProfileFolder`, already queried in these files).

- [ ] **Step 1: Remove the folder-tile publish trigger from `GroupsView.tsx`.** Delete
  `onPublishRequest={showPublish ? ... setPublishTarget ...}` (line 267) and the
  `PublishModuleModal` mount (lines 346-355) and the `publishTarget` state. Keep
  `published={!!folder.publishedModuleSlug}` only if `GroupTile` still needs it; else drop.
  Remove the now-unused `PublishModuleModal` import. (The `badgeSlot` from Task 1 stays.)

- [ ] **Step 2: Add publish to the `ListsModeContent` folder banner.** Inside the
  `PageBanner` (lines 554-586), where it renders admin actions, add — gated to admin +
  inside a real folder:

```tsx
{showAdminButtons && realFolderId && (
  <Button
    variant="secondary"
    size="sm"
    onClick={() => setPublishOpen(true)}
    icon={<Upload className="w-3.5 h-3.5" />}
  >
    {folderDoc?.publishedModuleSlug ? t('updateModule') : t('publishModule')}
  </Button>
)}
```

  Add state `const [publishOpen, setPublishOpen] = useState(false);` and mount the modal
  near the other dialogs:

```tsx
{publishOpen && realFolderId && (
  <PublishModuleModal
    kind="lists"
    targetId={realFolderId}
    defaultName={folderName}
    publishedSlug={folderDoc?.publishedModuleSlug}
    publishedClass={folderDoc?.publishedModuleClass}
    onClose={() => setPublishOpen(false)}
  />
)}
```

  Add imports for `PublishModuleModal`, `Upload`, and `Button` if not present.
  `showAdminButtons`, `realFolderId`, `folderDoc`, `folderName` are already in scope
  (recon confirmed lines 347-363). Add i18n keys `lists.publishModule` = `"Publish as
  module"` and reuse `lists.updateModule` if present else add `"Update module"`.

- [ ] **Step 3: Repeat for `SentencesModeContent.tsx`** with `kind="sentences"` and the
  `sentences.*` namespace keys.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
grep -n "onPublishRequest" app/components/app/shared/sections/GroupsView.tsx   # expect: no output
```

  Manual (admin view): folder tiles show only the badge (no publish icon); open a
  list/sentence folder → "Publish as module" in the banner opens the picker and updates the
  tile badge.

- [ ] **Step 5: Commit**

```bash
git add app/components/app/shared/sections/GroupsView.tsx \
  app/components/app/lists/sections/ListsModeContent.tsx \
  app/components/app/sentences/sections/SentencesModeContent.tsx messages/en.json
git commit -m "Lists/Sentences: publish from the folder page, not the tile (WS2)"
```

---

## Task 4 ✅ — Remove legacy resource-pack item UI + stray labels

**Files:**
- Modify: `app/components/app/categories/ui/BannerEdit.tsx`
- Modify: `app/components/app/categories/ui/Banner.tsx`
- Modify: `app/components/app/categories/sections/CategoryDetailContent.tsx`
- Modify: `app/components/app/lists/sections/ListDetailContent.tsx`
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx`
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx`

- [ ] **Step 1: `RepublishButton` — remove every render + import.** Sites:
  `ListDetailContent.tsx` (import line 28, render ~line 532), `SentencesModeContent.tsx`
  (import line 50 + its render), `CategoryDetailContent.tsx` (import + the `republishSlot`
  at line 481). Delete the JSX and the imports.

- [ ] **Step 2: Strip the republish gate + reload + label from `BannerEdit.tsx`.** Remove:
  the `ToggleButton` republish gate (lines 228-235), the `LibrarySourceBadge` render
  (line 168), the reload-defaults `Button` (lines 201-211), and the now-dead props from
  `BannerEditProps` and the destructure: `isDefault`, `isInLibrary`, `libraryTier`,
  `onToggleDefault`, `onToggleLibrary`, `onSetTier`, `librarySourceId`, `onReloadDefaults`,
  `republishSlot`. Remove the `LibrarySourceBadge`, `Bookmark`, `RotateCcw` imports. Keep
  `onPublishModule` (added in Task 2).

- [ ] **Step 3: `Banner.tsx`** — remove the `LibrarySourceBadge` render (line 78) and its
  import + the gating variables that become unused.

- [ ] **Step 4: `CategoryDetailContent.tsx`** — remove the `republishGateOpen` state +
  `handleToggleRepublishGate`, the `republishSlot` construction (line 481), and the props
  no longer passed to `BannerEdit` (`onToggleDefault`, `onReloadDefaults`, etc.). (Reload
  dialog removal is Task 5.)

- [ ] **Step 5: "Save to pack" — remove.** In `ListDetailContent.tsx` (~line 172-184) and
  `SentencesModeContent.tsx` (~line 713-722): delete the `ToggleButton` with the `Library`
  icon / `packPicker.saveToPackButton`, its `onToggleLibrary` handler wiring, and any now-
  unused `LibraryPackPickerModal` mount if it exists only for this.

- [ ] **Step 6: `PackStatusLabel` + `LibrarySourceBadge` on list/sentence rows/banners —
  remove.** Sites: `ListsModeContent.tsx` (`PackStatusLabel` line 228, `LibrarySourceBadge`
  line 222 + imports lines 40-41), `ListDetailContent.tsx` (`PackStatusLabel` import line
  27 + render), `SentencesModeContent.tsx` (`PackStatusLabel` import line 51 +
  `LibrarySourceBadge` line 52 + renders). Delete renders + imports.

- [ ] **Step 7: Verify no stray references remain**

```bash
grep -rn "RepublishButton\|saveToPackButton\|LibrarySourceBadge" app/components/app 2>/dev/null   # expect: no output
grep -rn "PackStatusLabel" app/components/app 2>/dev/null   # expect: no output (badge fully replaced)
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
```

  Manual (admin view): no "From pack" pills on any banner; no "Default/{Pack}·Tier" pills
  on list/sentence rows; no "Save to pack" or "Republish to JSON" buttons anywhere; the
  only module label is the tile badge from Task 1.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Strip legacy pack item UI: Save-to-pack, Republish, From-pack labels (WS2/WS3)"
```

---

## Task 5 ✅ — Delete the reload-defaults feature

**Files:**
- Delete: `app/components/app/categories/modals/ReloadDefaultsDialog.tsx`
- Delete: `app/api/reload-category-defaults/route.ts`
- Modify: `convex/profileCategories.ts` (remove `reloadCategoryFromLibrary`)
- Modify: `app/components/app/categories/sections/CategoryDetailContent.tsx` (remove refs)

- [ ] **Step 1: Remove references in `CategoryDetailContent.tsx`.** Delete the
  `ReloadDefaultsDialog` import (line 46), the `reloadDialogOpen` state, the
  `setReloadDialogOpen(true)` handler wiring, and the `<ReloadDefaultsDialog … />` mount
  (line 689).

- [ ] **Step 2: Delete the dialog component file**

```bash
git rm app/components/app/categories/modals/ReloadDefaultsDialog.tsx
```

- [ ] **Step 3: Delete the API route**

```bash
git rm app/api/reload-category-defaults/route.ts
```

- [ ] **Step 4: Remove the Convex mutation.** In `convex/profileCategories.ts`, delete the
  entire `export const reloadCategoryFromLibrary = mutation({ … })` block and any imports
  it alone used.

- [ ] **Step 5: Remove the reload i18n keys** from `messages/en.json` (the
  `categoryDetail.reloadDefaults*` and `bannerReloadDefaults*` keys listed in the spec).

- [ ] **Step 6: Verify**

```bash
grep -rn "reloadCategoryFromLibrary\|ReloadDefaultsDialog\|reload-category-defaults" app convex 2>/dev/null   # expect: no output
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
source ~/.nvm/nvm.sh && nvm use 20.17.0 >/dev/null 2>&1 && npx tsc -p convex/tsconfig.json --noEmit   # expect: no output
```

  Manual: category detail edit chrome has no "Reload Defaults" button; reset workflow is
  now delete-the-module + reinstall from `/library/modules`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Remove reload-defaults: reset = delete + reinstall from library (WS2)"
```

---

## Task 6 ✅ — Final sweep + plan bookkeeping

- [ ] **Step 1: Full typecheck (app + convex)**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
source ~/.nvm/nvm.sh && nvm use 20.17.0 >/dev/null 2>&1 && npx tsc -p convex/tsconfig.json --noEmit   # expect: no output
```

- [ ] **Step 2: Lint the touched files**

```bash
npx eslint app/components/app/shared/ui/ModuleClassBadge.tsx \
  app/components/app/categories app/components/app/shared/sections/GroupsView.tsx \
  app/components/app/lists app/components/app/sentences
```

- [ ] **Step 3: Update the Phase 14.5 tracker.** In
  `docs/4-builds/plans/phase-14.5-refinement-pass.md`, mark WS2 and WS3 done with commit
  refs. (Stage 1 ends here; Stage 2 — the pack teardown, Tasks 7–9 — continues on this
  same worktree.)

- [ ] **Step 4: Manual acceptance pass** (admin view, running server):
  - Group tiles (categories, list folders, sentence folders): single publish-class badge,
    admin-only, "Draft" when unpublished.
  - Publish fires only from the module's own page (category detail; list/sentence folder
    banner), never from a tile.
  - No "From pack" on banners; no pack labels on items; no Save-to-pack / Republish / Reload
    buttons anywhere.
  - Non-admin (instructor) view: no badges, no publish controls.

- [ ] **Step 5: Commit bookkeeping**

```bash
git add docs/4-builds/plans/phase-14.5-refinement-pass.md
git commit -m "docs: mark Phase 14.5 WS2+WS3 shipped"
```

---

# Stage 2 — dead-component cleanup + full library-pack teardown

> Begins only after **all of Stage 1 has landed** on this branch. This removes the entire
> legacy resource-pack system that WS1.1 deferred and Stage 1 orphaned. It touches
> **backend, data files, and schema**, so it is gated on a backup and a fresh recon that
> produces the exact deletion manifest — the code below is the *known* surface, not the
> full list.

## Task 7 ✅ — Backup + full pack-surface recon → deletion manifest

**Files:** none changed — this task produces a written manifest appended to this plan.

- [ ] **Step 1: Full deployment backup** (disaster recovery before any data/schema change)

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx convex export --path backups/2026-07-06-pre-pack-teardown.zip
```

  `backups/` is gitignored (local-only). Restore path if needed:
  `npx convex import --replace backups/2026-07-06-pre-pack-teardown.zip`.

- [ ] **Step 2: Recon the complete pack surface.** Grep for every reference and record
  file + line in a manifest. Known starting surface (verify + extend):

  - **Orphaned-by-Stage-1 UI components** (now unused): `app/components/app/shared/ui/packStatusBadge.tsx`, `app/components/app/categories/ui/LibrarySourceBadge.tsx`, `app/components/app/shared/ui/RepublishButton.tsx`.
  - **Marketing pack UI**: `LibraryGrid.tsx`, `PackDetailContent.tsx`, `LibraryPackCard.tsx`, `LoadPackButton.tsx`.
  - **In-app home**: `app/components/app/home/sections/LibraryPacksSection.tsx` (+ its `/library` link + its mount in the home page).
  - **Deprecated public routes**: `app/[locale]/(public)/library/page.tsx`, `app/[locale]/(public)/library/[slug]/page.tsx` (currently redirect stubs from WS1.1 — decide: keep 308 redirects for SEO, or delete).
  - **Admin pack UI**: `/admin/library` page, `EditPackLifecycleModal`, `ConfirmDeletePackLifecycleModal`, admin `PackStatusBadge`, `SavePackChangesConfirmModal`, `LibraryPackPickerModal`.
  - **API routes**: `app/api/admin/pack-publish/route.ts`.
  - **Convex backend**: `convex/resourcePacks.ts` (all `*V2` queries/mutations incl. `setListInLibraryV2`, `getPublicLibraryCatalogueV2`, `getPackDetailV2`, lifecycle mutations), `convex/lib/libraryPacks.ts`, `convex/data/library_packs/` directory.
  - **Schema**: the `resourcePacks` table + any pack-lifecycle table in `convex/schema.ts`; the `packSlug` field on `profileCategories`, `profileLists` items, `profileSentences`.
  - **i18n**: `packPicker.*`, `packStatus.*`, and `categoryDetail` pack-only keys in `messages/en.json`.

```bash
grep -rn "resourcePacks\|libraryPacks\|library_packs\|packSlug\|LibraryPack\|pack-publish\|LibraryGrid\|PackDetail\|LoadPackButton\|LibraryPacksSection" app convex 2>/dev/null | grep -v "_generated" > /tmp/pack-teardown-manifest.txt
```

- [ ] **Step 3: Write the manifest** into this plan (append under Task 7) as an exact
  checklist of files to delete, functions to remove, and schema fields to drop — grouped
  UI → routes → backend → data → schema. Every subsequent task deletes from this manifest.

- [ ] **Step 4: Commit the manifest**

```bash
git add docs/4-builds/plans/phase-14.5-ws2-ws3-publishing-and-labels.md
git commit -m "docs: pack-teardown deletion manifest (Stage 2 recon)"
```

## Task 8 ✅ — Delete pack UI, routes, and backend (code + data)

**Files:** everything in the manifest EXCEPT schema fields (Task 9). Order matters — delete
consumers before the code they import, so `tsc` stays green between deletions.

- [ ] **Step 1: Remove in-app + marketing pack UI.** Delete `LibraryPacksSection` and its
  mount in the home page; delete `LibraryGrid`, `PackDetailContent`, `LibraryPackCard`,
  `LoadPackButton`. Decide `/library` routes: keep the 308 redirect stubs (recommended —
  preserves inbound links) OR delete. Update any remaining imports.

- [ ] **Step 2: Remove admin pack UI + route.** Delete the `/admin/library` page, the pack
  lifecycle modals, admin `PackStatusBadge`, `SavePackChangesConfirmModal`,
  `LibraryPackPickerModal`, and `app/api/admin/pack-publish/route.ts`. Remove the
  `/admin/library` entry from `app/(admin)/layout.tsx`.

- [ ] **Step 3: Remove orphaned Stage-1 components.** Delete `packStatusBadge.tsx`,
  `LibrarySourceBadge.tsx`, `RepublishButton.tsx`.

- [ ] **Step 4: Remove Convex backend + data.** Delete `convex/resourcePacks.ts`,
  `convex/lib/libraryPacks.ts`, and the `convex/data/library_packs/` directory. Remove
  their imports/re-exports.

- [ ] **Step 5: Remove dead i18n keys** (`packPicker.*`, `packStatus.*`, pack-only
  `categoryDetail` keys) from `messages/en.json`.

- [ ] **Step 6: Verify**

```bash
grep -rn "resourcePacks\|libraryPacks\|library_packs\|pack-publish\|LibraryGrid\|LibraryPacksSection" app convex 2>/dev/null | grep -v "_generated"   # expect: only packSlug schema refs (handled in Task 9), if any
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "lib/stripe.ts"   # expect: no output
source ~/.nvm/nvm.sh && nvm use 20.17.0 >/dev/null 2>&1 && npx tsc -p convex/tsconfig.json --noEmit   # expect: no output
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Pack teardown: remove pack UI, admin, routes, backend, data (Stage 2)"
```

## Task 9 ✅ — Schema teardown — drop `resourcePacks` table + `packSlug` fields

**Files:** `convex/schema.ts` + a one-off cleanup migration. **Riskiest — backup from Task 7
must exist.** Convex requires a field to be absent from all docs before the validator can
drop it, so null-out first, then remove from schema.

- [ ] **Step 1: Write a migration** that patches every `profileCategories`,
  `profileLists`, `profileSentences` doc to remove the `packSlug` field (set to
  `undefined`) — a standard Convex data migration over each table.

- [ ] **Step 2: Run the migration** and confirm zero docs still carry `packSlug`.

- [ ] **Step 3: Remove the fields from `convex/schema.ts`** — the `packSlug` optionals and
  the `resourcePacks` table definition (+ any pack-lifecycle table). Keep
  `publishedModuleSlug` / `publishedModuleClass` / `librarySourceId` (module system).

- [ ] **Step 4: Verify**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 >/dev/null 2>&1 && npx tsc -p convex/tsconfig.json --noEmit   # expect: no output
grep -rn "packSlug\|resourcePacks" convex app 2>/dev/null | grep -v "_generated"   # expect: no output
```

- [ ] **Step 5: Commit + update the Phase 14.5 tracker** (mark the pack-teardown follow-up
  done).

```bash
git add -A
git commit -m "Pack teardown: drop resourcePacks table + packSlug fields (Stage 2)"
```

> **Deferred past this worktree:** the categories-page pack **filter dropdown** still reads
> `adminPacks`. Rework it (or drop it) with the taxonomy/reseed work (WS-C), not here.

---

## Self-review

**Spec coverage** — every design section maps to a task:
- Publish on the module's own page (all trees) → Tasks 2 (categories) + 3 (lists/sentences).
- Tile shows only a publish-class badge, admin-only → Task 1.
- Remove old per-item pack UI (Save-to-pack, Republish-to-JSON) → Task 4.
- Label consolidation ("From pack" off banners, pack labels off items) → Task 4.
- Drop reload-defaults; reset = delete + reinstall → Task 5.
- No schema/publish-backend change → confirmed (fields pre-exist).

**Placeholder scan** — no TBD/TODO; each code step shows real code; verification uses exact
commands with expected output.

**Type consistency** — `ModuleClassBadge({ publishedClass })` defined in Task 1 and used
identically in Tasks 1/2/3; `PublishModuleModal` props (`kind`, `targetId`, `defaultName`,
`publishedSlug`, `publishedClass`, `onClose`) match its real signature; `publishedModuleClass`
/ `publishedModuleSlug` field names match `convex/schema.ts`.

**Known soft spots** (resolve at implementation time by reading the file first): exact line
numbers drift as edits land — always re-grep before deleting; the `RepublishButton` /
`Save to pack` render blocks in `SentencesModeContent.tsx` were not line-pinned in recon, so
locate them by the i18n keys `packPicker.republishLabel` / `packPicker.saveToPackButton`.

---

# Task 7 — DELETION MANIFEST (recon complete, 2026-07-07)

> Produced by a full read-only audit (backend / schema+migrations / UI). **The plan's
> original Task 8/9 "known surface" was incomplete AND partly wrong** — this manifest
> supersedes it. Backup taken: `backups/2026-07-07-pre-pack-teardown.zip` (9.3M, gitignored).
>
> **Headline corrections to the original plan:**
> 1. `resourcePacks.ts` **cannot** be deleted wholesale — 7 functions are imported by KEEP
>    code (the content-module system + core profile mutations). Sever first.
> 2. `convex/data/library_packs/` **cannot** be deleted wholesale — `types.ts` is the
>    canonical JSON-shape type source re-exported by `_shared/types.ts` for content modules.
>    Relocate the type bodies, then delete the dir.
> 3. `packLifecycle` table is **KEEP** (V2 JSON-library overlay), not a pack table.
> 4. Schema teardown drops **more** than `packSlug`: also `publishedToPackId` +
>    `by_published_to_pack_id` and `by_pack_slug` indexes, on all 3 profile tables.
> 5. **9 migrations** in `migrations.ts` reference the `resourcePacks` table / `LIBRARY_PACKS`
>    and must be deleted (else `tsc` breaks after the table drops).
> 6. The admin **pack filter dropdown** (`getPacksForAdminStatusV2`) — which the original
>    plan deferred to WS-C — is **forced into scope** by deleting `resourcePacks.ts`. See
>    DECISION below.

## DECISION REQUIRED (pack filter dropdown)

CategoriesContent / ListsModeContent / SentencesModeContent render an admin-only dropdown
that filters rows **by pack origin**, backed by `api.resourcePacks.getPacksForAdminStatusV2`
+ `getLoadedPacksForCurrentAccount`. Deleting `resourcePacks.ts` removes those queries.
Options: **(A) remove the dropdown now** (recommended — it filters on data that no longer
exists) · (B) keep the dropdown shell wired to a stub returning empty (pointless) · (C) keep
a minimal `resourcePacks.ts` alive just for these queries (contradicts "full teardown").

## A. UI / routes / API

**Delete wholesale (pure-pack)** + remove their mounts:
- `app/components/app/home/sections/LibraryPacksSection.tsx` + `app/components/app/home/ui/PackCard.tsx` — mount: `HomeContent.tsx:98` `<LibraryPacksSection />`.
- `app/components/marketing/sections/LibraryGrid.tsx`, `app/components/marketing/sections/PackDetailContent.tsx`, `app/components/marketing/ui/LibraryPackCard.tsx`, `app/components/marketing/ui/LoadPackButton.tsx`.
- `app/components/admin/sections/LibraryAdminTable.tsx`, `app/components/admin/modals/EditPackLifecycleModal.tsx`, `app/components/admin/modals/ConfirmDeletePackLifecycleModal.tsx`.
- `app/(admin)/admin/library/page.tsx` (+ remove the `/admin/library` nav entry) · `app/[locale]/(public)/library/page.tsx` + `app/[locale]/(public)/library/[slug]/page.tsx` (redirect stubs → delete) · `app/api/admin/pack-publish/route.ts`.

**Delete dead code (never imported):**
- `app/components/app/shared/ui/RepublishButton.tsx`, `app/components/app/shared/modals/LibraryPackPickerModal.tsx`, `app/components/app/shared/modals/SavePackChangesConfirmModal.tsx`.
- In `app/components/app/shared/ui/packStatusBadge.tsx`: unused `AdminPackBadge` + `PackStatusLabel`. `PackStatusBadge` is only used by `LibraryAdminTable` → whole file goes once that's deleted.

**Surgical edits (KEEP files):**
- `app/post-signup/page.tsx` — remove pack-resume branch (`library:resume` / `loadResourcePackV2`, ~lines 15,40,56–112); leave the redirect-to-home dispatch.
- `CategoriesContent.tsx` / `ListsModeContent.tsx` / `SentencesModeContent.tsx` — per DECISION: remove the two pack queries + the pack filter dropdown build/apply logic + the `packSlug?` row-type field.
- `CategoryDetailContent.tsx` / `ListDetailContent.tsx` — remove `getPacksForAdminStatusV2` query + `linkedLibraryPack` name lookup; simplify the admin editing banner to no pack-name suffix (keep the banner — modules use it).

## B. Convex backend (sever, then delete)

**Relocate (genuinely reused by KEEP code)** → new `convex/lib/materialiseSymbols.ts`:
- `materialiseSymbolsFromJson` (resourcePacks.ts:338) — imported by `lib/contentModuleInstall.ts:18` (the module installer). Rename off "pack", update that import.

**Delete functions + their call sites** (they sync into the doomed `resourcePacks` table, so
they die with it — remove the imports + calls from the profile mutations, don't relocate):
- `syncCategoryToPackIfPublished` — called in `profileSymbols.ts` (5×) + `profileCategories.ts`.
- `syncListToPackIfPublished` / `removeListFromPack` — `profileLists.ts`.
- `syncSentenceToPackIfPublished` / `removeSentenceFromPack` — `profileSentences.ts`.
- `removeCategoryFromPack` — `profileCategories.ts`.

**Delete whole files** (orphaned once the above are severed):
- `convex/resourcePacks.ts` (everything except the relocated `materialiseSymbolsFromJson`).
- `convex/lib/libraryPacks.ts` (only `resourcePacks.ts` consumed it).
- `convex/data/library_packs/` dir — **after** relocating its `types.ts` bodies (see C).

## C. Type relocation (do BEFORE deleting library_packs/)

- Move the `LibraryPack*` type bodies from `convex/data/library_packs/types.ts` into
  `convex/data/_shared/types.ts` (which currently re-exports them at line 27). Keep the same
  exported names (`LibraryPackCategory` / `LibraryPackList` / `LibraryPackSentence` etc.) so
  content-module consumers are untouched. Then `_shared/types.ts` self-contains and the
  `library_packs/` import chain is cut.
- `convex/data/library_packs/_index.ts` (`LIBRARY_PACKS` catalogue) + the 8 pack `*.json`
  files: orphaned once `libraryPacks.ts` + the migration import go → delete with the dir.
- Note: `convex/data/categories/*.json` and `library_packs/*.json` contain R2 key **strings**
  like `library_packs/space/images/...` — those are R2 object keys, not code imports; leaving
  or deleting the JSON has no effect on R2. Category seed JSON stays.

## D. migrations.ts — delete these 9 exports + the `LIBRARY_PACKS` import (line 8)

`materialiseStarterPack` · `restoreStarterPackFromBackup` · `stripDefaultMatchingSymbolDisplay`
(patches `resourcePacks.categories[]`) · `backfillResourcePackSlugs` ·
`seedLifecycleFromResourcePacks` · `backfillLifecycleMetadata` · `backfillProfilePackSlugs` ·
`backfillLibrarySourceIdFromPackSlug` · `migrateResourcePacks`. Also delete
`seedLifecycleFromJSON` (imports `LIBRARY_PACKS`). All are one-shot migrations already run;
none are wired to crons. Keep `packLifecycle`-only migrations (`migratePackLifecycle`,
`seedLanguageLifecycle`, etc.).

## E. Schema (Task 9) — `convex/schema.ts`

- Delete the `resourcePacks: defineTable({...})` block (~lines 904–1049, incl. its 4 indexes).
- On **profileCategories, profileLists, profileSentences** each: delete `publishedToPackId`,
  `packSlug`, and the `.index("by_published_to_pack_id", …)` + `.index("by_pack_slug", …)`.
- **KEEP** `packLifecycle` table, and `publishedModuleSlug` / `publishedModuleClass` /
  `librarySourceId` on all tables (content-module provenance).
- Convex requires a field absent from all docs before the validator drops it → the Task 9
  migration nulls `packSlug` + `publishedToPackId` on every profile doc first, then remove
  from schema.

## F. i18n

Remove now-unused `packPicker.*`, `packStatus.*`, and pack-only `categoryDetail` keys from
`messages/en.json` (leave keys that the module system still uses).

## Execution order (keeps `tsc` green between commits)

1. **Type relocation** (C) — `_shared/types.ts` self-contains. Verify app + convex `tsc`.
2. **Backend sever** (B) — relocate `materialiseSymbolsFromJson`; strip sync/remove calls
   from profile mutations; delete `resourcePacks.ts` + `lib/libraryPacks.ts`. Verify.
3. **UI/routes/API** (A) — delete pure-pack + dead files, remove mounts, surgical KEEP edits
   (incl. the DECISION on the filter dropdown). Verify.
4. **Data + migrations** (C `_index`/json + D) — delete `library_packs/` dir, strip the 10
   migrations. Verify convex `tsc`.
5. **i18n** (F).
6. **Schema** (E, = Task 9) — migration to null fields, run it, then drop from schema. Verify.
