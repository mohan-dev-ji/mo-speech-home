# Category Details Edit-Mode Polish (WS4.1 + 4.1b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the category-details page's edit mode consistent with the rest of the app —
symbols edit like the talker dropdown's core words (dashed border, whole-card drag,
tap-to-edit, corner ✕), and the edit banner matches the view banner (static title, same
image size, loose button row).

**Architecture:** Two independent, self-contained UI changes on `main`. (1) Rewrite
`SymbolCardEditable` to the dropdown `SlotCell` pattern — the existing `useSortable`
wiring in `CategoryDetailContent` already passes drag listeners down, so only the card's
internals change. (2) Align `BannerEdit` with the shared view `Banner` (static `<h1>`,
`Banner`-style image card, loose `mt-3` button row); `CategoryDetailContent` stops passing
the rename callback so the title is read-only (rename stays on the grid tile).

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 / next-intl v4 / dnd-kit.

## Global Constraints

- **i18n:** all UI copy via `useTranslations`; new keys go to **`messages/en.json` only**
  (never hand-add to other locales). Real English.
- **Theme tokens:** no hard-coded colours/spacing/radii/font-size — use `--theme-*`
  utilities (`bg-theme-*`, `text-theme-*`, `rounded-theme-*`, `border-theme-*`, etc.) or
  `var(--theme-*)` inline where a raw value is unavoidable (matching existing code).
- **No test harness:** "Verify" = `npx tsc --noEmit` clean (ignore the pre-existing
  `lib/stripe.ts` error and any stale `.next/types` reload-route reference) + targeted
  `grep` + manual check on the running dev server (port 3001, already running — do NOT
  start `npm run dev` or `npx convex dev`). Prefix any Node CLI with
  `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **Scope:** these files are on `main` (the WS2/WS3 worktree already merged), so no
  worktree-conflict concern. Do not touch the pack teardown (Stage 2).

---

## File structure

**Modify**
- `app/components/app/categories/ui/SymbolCardEditable.tsx` — rewrite the editable card
  (Task 1). Sole responsibility: render one symbol in edit mode with dashed border,
  whole-card drag + tap-to-edit, corner ✕ delete.
- `app/components/app/categories/ui/BannerEdit.tsx` — align with the view `Banner`
  (Task 2): static title, `Banner`-style image, loose button row.
- `app/components/app/categories/sections/CategoryDetailContent.tsx` — stop passing
  `onCategoryNameChange`; relax the edit-banner wrapper min-height (Task 2).

**Reference (read-only, do not edit)**
- `app/components/app/shared/ui/TalkerDropdown.tsx` `SlotCell` (lines ~848–890) — the
  pattern for Task 1.
- `app/components/app/shared/ui/Banner.tsx` — the view banner Task 2 aligns to.

No new files, no schema, no backend changes.

---

## Task 1: Symbol edit state → dropdown `SlotCell` pattern

**Files:**
- Modify: `app/components/app/categories/ui/SymbolCardEditable.tsx` (rewrite the body)

**Interfaces:**
- Consumes: `SortableSymbolCard` in `CategoryDetailContent.tsx:100-128` passes
  `imagePath, label, display, categoryColour, onEdit, onDelete, dragHandleListeners,
  dragHandleAttributes` — **the prop shape does not change**, so `CategoryDetailContent`
  needs no edit. The listeners now go on the whole card instead of a Move button.
- Produces: same `SymbolCardEditable` component signature.

- [ ] **Step 1: Rewrite the component.** Replace the entire body of
  `app/components/app/categories/ui/SymbolCardEditable.tsx` with:

```tsx
"use client";

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { SymbolCard, type SymbolDisplay } from '@/app/components/app/shared/ui/SymbolCard';

type Props = {
  imagePath?: string;
  label: string;
  display?: SymbolDisplay;
  categoryColour?: string;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleListeners?: SyntheticListenerMap;
  dragHandleAttributes?: DraggableAttributes;
};

// Editable symbol card — mirrors the talker dropdown's core-word SlotCell
// (TalkerDropdown.tsx). The symbol keeps its full square footprint: a dashed
// edit-mode border, the WHOLE card is the drag handle (grab cursor), TAP opens
// the symbol editor (8px drag-activation on the parent sensor lets a clean tap
// through), and a corner ✕ badge deletes. No below-symbol edit panel.
export function SymbolCardEditable({
  imagePath,
  label,
  display,
  categoryColour,
  onEdit,
  onDelete,
  dragHandleListeners,
  dragHandleAttributes,
}: Props) {
  const t = useTranslations('categoryDetail');

  return (
    <div
      className="relative w-full aspect-square @container rounded-theme-card"
      style={{ border: '2px dashed var(--theme-enter-mode)' }}
    >
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        {...dragHandleListeners}
        {...dragHandleAttributes}
      >
        <SymbolCard
          symbolId="edit-mode"
          imagePath={imagePath}
          label={label}
          language="en"
          display={display}
          categoryColour={categoryColour}
          onTap={onEdit}
        />
      </div>

      {/* Corner ✕ delete — stops propagation so it never starts a drag. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={t('symbolDelete')}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow z-10"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
```

  Notes: `symbolDelete` already exists in `en.json` (used by the old card). `symbolEdit`
  and `symbolMove` are now unused i18n keys — leave them (harmless). `EditPanel`,
  `IconButton`, `Trash2`, `Pencil`, `Move` imports are gone.

- [ ] **Step 2: Verify types + lint**

```bash
npx tsc --noEmit 2>&1 | grep -iE "SymbolCardEditable|CategoryDetailContent" || echo "no type errors in touched files"
npx eslint app/components/app/categories/ui/SymbolCardEditable.tsx 2>&1 | grep "  error " || echo "no eslint errors"
```
Expected: no type errors, no eslint errors.

- [ ] **Step 3: Manual verification** (running dev server, admin/instructor view):
  - Open a category, enter edit mode. Each symbol shows a dashed border and keeps its full
    square (no buttons below it).
  - Hover a symbol → grab cursor.
  - **Tap** a symbol → the symbol editor modal opens.
  - **Drag** a symbol → it reorders (drop persists).
  - **✕** in the top-right corner → the delete-confirm dialog opens.

- [ ] **Step 4: Commit**

```bash
git add app/components/app/categories/ui/SymbolCardEditable.tsx
git commit -m "Category symbols: dropdown-style edit card (dashed border, tap-edit, drag, ✕) (WS4.1)"
```

---

## Task 2: Banner edit mode → match the view banner

**Files:**
- Modify: `app/components/app/categories/ui/BannerEdit.tsx`
- Modify: `app/components/app/categories/sections/CategoryDetailContent.tsx:398-408`

**Interfaces:**
- `BannerEdit` drops the `onCategoryNameChange` prop (title becomes always-static). Keeps
  `categoryName, imagePath, draftColour, onExit, onAddSymbol, onPublishModule,
  publishModuleLabel`.

- [ ] **Step 1: Static title + `Banner`-style image + loose button row.** In
  `app/components/app/categories/ui/BannerEdit.tsx`:

  (a) Remove the `useEffect`/`useState` name-draft logic (lines ~88–103), the
  `onCategoryNameChange` prop (from the type and the destructure), and the `useEffect`,
  `useState` imports if now unused (`useState`/`useEffect` are only used by the draft).

  (b) Replace the title block (the `onCategoryNameChange ? <input> : <h1>` conditional,
  lines ~110–144) with a plain static title matching `Banner`:

```tsx
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className="text-theme-h3 font-bold leading-tight truncate"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {categoryName}
          </h1>
        </div>
```

  (c) Replace the bordered controls container (the `<div className="flex flex-wrap ...">`
  with the `background`/`border` inline style, lines ~146–187) with a loose row matching
  `Banner`/`PageBanner` (keep the same three buttons inside):

```tsx
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <EditButton
            isEditing={true}
            onClick={onExit}
            editLabel={t('bannerExitEdit')}
            exitLabel={t('bannerExitEdit')}
          />
          <CreateButton onClick={onAddSymbol} label={t('bannerAddSymbol')} />
          {onPublishModule && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onPublishModule}
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              {publishModuleLabel ?? t('bannerPublishModule')}
            </Button>
          )}
        </div>
```

  (d) Replace `FolderImageCard` so its image sizing matches the view `Banner` (single
  card, `object-contain p-3`, no double-padding wrapper). Change the returned markup to:

```tsx
  return (
    <div
      className="w-[136px] h-[136px] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
      style={{ backgroundColor: colourPair.c100 }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={categoryName}
          className="w-full h-full object-contain p-3"
          draggable={false}
        />
      ) : (
        <ImageIcon className="w-12 h-12" style={{ color: colourPair.c500 }} />
      )}
    </div>
  );
```

- [ ] **Step 2: Stop passing the rename callback + relax the wrapper min-height.** In
  `app/components/app/categories/sections/CategoryDetailContent.tsx`:

  (a) Remove the `onCategoryNameChange={handleCategoryNameChange}` line from the
  `<BannerEdit ... />` call (line ~400).

  (b) In the edit-banner wrapper (line ~394-397), drop the forced `min-h-[200px]` so the
  edit banner height matches the view banner (`min-h-[136px]` comes from `BannerEdit`
  itself):

```tsx
            <div
              className="relative rounded-theme p-3 flex flex-col justify-center"
              style={{ background: `color-mix(in srgb, ${getCategoryColour(draftColour).c500} 30%, transparent)` }}
            >
```

  (c) If `handleCategoryNameChange` is now unused, remove its definition (grep first —
  see Step 3). Leave it if anything else references it.

- [ ] **Step 3: Verify no dangling references**

```bash
grep -n "onCategoryNameChange\|handleCategoryNameChange" app/components/app/categories/sections/CategoryDetailContent.tsx app/components/app/categories/ui/BannerEdit.tsx
```
Expected: no matches (both removed). If `handleCategoryNameChange` still appears in
`CategoryDetailContent`, it is unused — delete its definition and re-run.

- [ ] **Step 4: Types + lint**

```bash
npx tsc --noEmit 2>&1 | grep -iE "BannerEdit|CategoryDetailContent" || echo "no type errors in touched files"
npx eslint app/components/app/categories/ui/BannerEdit.tsx app/components/app/categories/sections/CategoryDetailContent.tsx 2>&1 | grep "  error " || echo "no eslint errors"
```
Expected: clean (ignore any pre-existing warnings unrelated to these edits).

- [ ] **Step 5: Manual verification** (running dev server):
  - Open a category (view mode): note the title, the button row, and the folder image size.
  - Toggle **edit** → the title stays static (no input/dashed box), the folder image stays
    the **same size** (no shrink), and the buttons (Exit Edit / Add Symbol / Publish) sit
    in a loose row — the banner reads like the view banner, only the buttons differ.
  - Rename still works on the **category tile** in the grid (unchanged).

- [ ] **Step 6: Commit**

```bash
git add app/components/app/categories/ui/BannerEdit.tsx app/components/app/categories/sections/CategoryDetailContent.tsx
git commit -m "Category banner: edit mode matches view banner — static title, steady image, loose buttons (WS4.1b)"
```

---

## Task 3: Tracker + final sweep

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -vE "lib/stripe.ts|\.next/types|reload-category-defaults" || echo "typecheck clean"
```

- [ ] **Step 2: Mark WS4.1/4.1b done** in
  `docs/4-builds/plans/phase-14.5-refinement-pass.md` (the `## Workstream 4` block and the
  status table), with commit refs.

- [ ] **Step 3: Commit the tracker**

```bash
git add docs/4-builds/plans/phase-14.5-refinement-pass.md
git commit -m "docs: mark Phase 14.5 WS4.1 + 4.1b shipped"
```

---

## Self-review

**Spec coverage:**
- 4.1 symbol edit (dashed border, whole-card drag, tap-to-edit, corner ✕, full square,
  grab cursor) → Task 1. ✓
- 4.1b static title → Task 2 Step 1b + 2a. ✓
- 4.1b image no longer changes size → Task 2 Step 1d (match `Banner`) + 2b (wrapper
  height). ✓
- 4.1b loose button row (no container) → Task 2 Step 1c. ✓
- Rename moves to the grid tile → Task 2 Step 2a (stop passing the callback); tile rename
  already exists (no code needed). ✓

**Placeholder scan:** every code step shows the full replacement code; verification uses
exact commands with expected output. No TBDs.

**Type consistency:** `SymbolCardEditable`'s prop shape is unchanged (Task 1), so
`CategoryDetailContent`'s call site (`dragHandleListeners`/`dragHandleAttributes`,
`onEdit`, `onDelete`) still matches. `BannerEdit` drops only `onCategoryNameChange`; Task 2
Step 2a removes the one call-site that passed it.

**Decisions carried from brainstorming:** tap-to-edit (not an edit badge); rename on the
grid tile (banner title read-only). The tinted edit-banner wrapper (30% colour background)
is intentionally **kept** as an edit-mode signal — only its forced `min-h` is relaxed.

**Known soft spot:** the `cursor-grab`/`cursor-grabbing` matches the dropdown's `SlotCell`;
the WS4.1 note also mentioned a "move cursor" — if the 4-arrow `cursor-move` is preferred,
it's a one-class swap in Task 1 Step 1. Confirm at review.
