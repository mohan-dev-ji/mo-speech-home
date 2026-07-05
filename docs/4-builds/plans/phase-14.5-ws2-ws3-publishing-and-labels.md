# Module Publishing & Label Consistency — Implementation Plan

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

Single cohesive subsystem (the admin publishing surface). One plan. Tasks are ordered so
each ends at a `tsc`-clean, committable state. Do them in order — later tasks assume the
shared badge from Task 1 exists and that publish triggers have moved (Tasks 2–3) before
the legacy removal (Task 4).

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

## Task 1: Shared `ModuleClassBadge` + adopt on group tiles

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

## Task 2: Move category publish → category detail page

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

## Task 3: Move list/sentence publish → folder page banner

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

## Task 4: Remove legacy resource-pack item UI + stray labels

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

## Task 5: Delete the reload-defaults feature

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

## Task 6: Final sweep + plan bookkeeping

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
  refs; note the follow-up in Task 7 below.

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

## Task 7: Follow-ups to record (not implemented here)

- [ ] Note in the tracker: **old-pack backend teardown** now also owns the dead
  `PackStatusLabel` / `LibrarySourceBadge` / `RepublishButton` component files and the
  `packSlug` schema fields — fold into the deferred pack-teardown follow-up.
- [ ] Note: the pack **filter dropdown** on the categories page still reads `adminPacks`
  (old system). Out of scope here; revisit with the taxonomy/reseed work (WS-C).

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
