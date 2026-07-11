# WS6 — Stacked, Wrapping Sentence & List Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sentence and list rows stack their symbols on top of the content text
(wrapping on all screen sizes), and remove the 4-thumbnail cap on list rows.

**Architecture:** Both `SortableSentenceRow` (SentencesModeContent) and `SortableListRow`
(ListsModeContent) currently lay out `[symbols | text | edit-panel]` as one horizontal
wrapping flex row. Change each to a vertical stack: a top row holding the symbol area
(fills width, wraps) + the edit panel (top-right), and the content text/name below (full
width, wrapping). For lists, also return all item thumbnails from `getProfileLists` and let
the strip wrap instead of showing a "…" overflow.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4 / Convex / dnd-kit.

## Global Constraints

- **Theme tokens:** no hard-coded colours/spacing/radii/font-size — reuse the existing
  `--theme-*` utilities already on these rows.
- **i18n:** all copy via `useTranslations`; no new keys needed here.
- **No test harness:** "Verify" = `npx tsc --noEmit` clean (ignore the pre-existing
  `lib/stripe.ts` error and any stale `.next/types` reload-route reference) + `npx eslint`
  on touched files + manual check on the running dev server (port 3001 — do NOT start
  `npm run dev`). Convex types: `npx tsc -p convex/tsconfig.json --noEmit`. Prefix Node CLI
  with `source ~/.nvm/nvm.sh && nvm use 20.17.0`. Never run `npx convex dev`.
- **Scope:** on `main`. Applies at ALL breakpoints (not small-screen-only). Both fluent and
  sequence sentences stack the same way. Text wraps fully (no truncation).

---

## File structure

**Modify**
- `app/components/app/sentences/sections/SentencesModeContent.tsx` — `SortableSentenceRow`
  render (Task 1): stack layout.
- `app/components/app/lists/sections/ListsModeContent.tsx` — `ThumbnailStrip` + the
  `SortableListRow` render (Task 2): wrap + stack, drop the "…" overflow.
- `convex/profileLists.ts` — `getProfileLists` returns all thumbnails (Task 2).

No new files, no schema changes (the `thumbnails` array is already variable-length).

---

## Task 1: Sentence rows → symbols-over-text stack

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (the
  `SortableSentenceRow` return, currently lines ~552–693)

**Interfaces:** none change — pure JSX restructure inside one component.

- [ ] **Step 1: Restructure the row.** The inner container currently holds three siblings
  in order: the symbol area, the text block, and the edit-panel cluster, inside
  `<div className="flex flex-wrap items-center gap-3 md:gap-4">`. Change it to a column with
  a top row (symbols + edit panel) and the text below. Concretely:

  (a) Change the inner container class (line ~552):
  `flex flex-wrap items-center gap-3 md:gap-4` → `flex flex-col gap-3`.

  (b) Wrap the **symbol area** `<div>` (the `isSequenceRow ? 'flex-1 min-w-0' : 'shrink-0'`
  one, ~559–605) **and** the **edit-panel cluster** `<div>` (~658–692) together in a new
  top row, and pull the **text block** (~607–656) OUT to sit *after* that top row. Target
  skeleton (inner blocks unchanged except the class tweaks in (c)/(d)/(e)):

```tsx
<div className="flex flex-col gap-3">
  {/* Top row: symbols (fill + wrap) + edit panel (top-right) */}
  <div className="flex items-start gap-3">
    <div
      className="flex-1 min-w-0"
      onClick={isEditing || isSequenceRow(sentence) ? undefined : (e) => e.stopPropagation()}
    >
      {/* …the existing UnitStrip / SlotStrip / blocks / ThumbnailStrip switch, unchanged… */}
    </div>

    {/* Edit panel — top-right, aligned with the first symbol row */}
    <div className="shrink-0">
      {isEditing && (
        <EditPanel className="flex-wrap">
          {/* …the existing Trash2 / FolderInput / Move IconButtons, unchanged… */}
        </EditPanel>
      )}
    </div>
  </div>

  {/* Below: full sentence text / edit button — full width, wrapping */}
  {/* …the existing isSequenceRow ? <p> : isEditing ? <button> : <p> switch,
       with the class tweaks in step (e)… */}
</div>
```

  (c) Symbol-area class: `isSequenceRow(sentence) ? 'flex-1 min-w-0' : 'shrink-0'` →
  just `'flex-1 min-w-0'` (both variants fill the top row so their content wraps).

  (d) Edit-panel wrapper class: `flex flex-wrap items-center gap-3 shrink-0 ml-auto` →
  `shrink-0` (it's the trailing item in the top row, already right of the flex-1 symbols;
  drop the now-redundant `ml-auto`/`flex-wrap`). Keep the `<EditPanel className="flex-wrap">`
  and its buttons exactly as-is.

  (e) Text block — full width + wrapping. In all three text variants, remove
  `flex-1 min-w-[10rem]` and replace `truncate` with `break-words` (wrap):
  - Sequence `<p>` (~615): `flex-1 min-w-[10rem] text-theme-p font-semibold truncate` →
    `text-theme-p font-semibold break-words`.
  - Fluent edit `<button>` (~619): `flex-1 min-w-[10rem] px-3 py-2 …` → `w-full px-3 py-2 …`
    (drop `flex-1 min-w-[10rem]`, add `w-full`); its inner `<p>` (~629) `truncate` →
    `break-words`.
  - Fluent view `<p>` (~653): `flex-1 min-w-[10rem] text-theme-p font-semibold truncate` →
    `text-theme-p font-semibold break-words`.

- [ ] **Step 2: Verify types + lint**

```bash
npx tsc --noEmit 2>&1 | grep -i "SentencesModeContent" || echo "no type errors"
npx eslint app/components/app/sentences/sections/SentencesModeContent.tsx 2>&1 | grep "  error " || echo "no eslint errors"
```
Expected: no type errors, no eslint errors.

- [ ] **Step 3: Manual verification** (dev server, Sentences → a folder):
  - Each sentence row shows its symbols/blocks on top and the full sentence text below.
  - A long block sentence's blocks wrap onto new rows; the full text below wraps to as many
    lines as needed (no ellipsis). Resize narrow → still stacked and wrapping.
  - In edit mode the delete/move panel sits top-right; tapping a fluent row's text still
    opens the sentence editor; the audio nudge still shows.

- [ ] **Step 4: Commit**

```bash
git add app/components/app/sentences/sections/SentencesModeContent.tsx
git commit -m "Sentences: stack symbols over full wrapping text on all screens (WS6)"
```

---

## Task 2: List rows → stack + wrap, drop the 4-thumbnail cap

**Files:**
- Modify: `convex/profileLists.ts:31-45` (return all thumbnails)
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx` (`ThumbnailStrip`
  ~72-112, `SortableListRow` ~158-248)

**Interfaces:**
- `getProfileLists` still returns `thumbnails: { imagePath?: string }[]` — now full length,
  not capped at 4. `ListRow.thumbnails` type (line 60) is already variable-length, so no
  type change.

- [ ] **Step 1: Return all thumbnails from the query.** In `convex/profileLists.ts`,
  replace the `firstFour` slice (lines 31-45):

```ts
    return lists.map((list) => {
      const orderedItems = [...list.items].sort((a, b) => a.order - b.order);

      return {
        _id: list._id,
        name: list.name,
        order: list.order,
        displayFormat: list.displayFormat ?? ("rows" as const),
        showNumbers: list.showNumbers ?? false,
        showChecklist: list.showChecklist ?? false,
        showFirstThen: list.showFirstThen ?? false,
        itemCount: list.items.length,
        thumbnails: orderedItems.map((item) => ({ imagePath: item.imagePath })),
        publishedToPackId: list.publishedToPackId,
        packSlug: list.packSlug,
        librarySourceId: list.librarySourceId,
        folderId: list.folderId, // ADR-014 — group membership (Lists tree)
      };
    });
```

  And update the doc comment (lines 12-15) to drop the "first 4 / overflow" wording:

```ts
/**
 * Returns all lists for the caller's account in display order, each with all of
 * its item image paths as thumbnails (the row UI wraps them).
 */
```

- [ ] **Step 2: Wrap the thumbnail strip + drop the overflow.** In `ListsModeContent.tsx`
  `ThumbnailStrip` (~79-111): remove the `hasOverflow` line and the whole `{hasOverflow && …}`
  span, and let the strip wrap. New body:

```tsx
  const filled = thumbnails.filter((t) => t.imagePath);
  return (
    <div className="flex flex-wrap items-end gap-2">
      {filled.map((t, i) => (
        <div
          key={i}
          className="w-[70px] h-[70px] rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/assets?key=${t.imagePath}`}
            alt=""
            className="max-w-[78%] max-h-[78%] object-contain"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
```

  `itemCount` is now unused by `ThumbnailStrip` — remove it from the component's props/type
  (~73-78) and from the call site (~167: `<ThumbnailStrip thumbnails={list.thumbnails} />`).
  (Leave `itemCount` on the `ListRow` type + query — harmless, may be used elsewhere; grep
  `itemCount` to confirm before removing more.)

- [ ] **Step 3: Stack the list row.** Restructure `SortableListRow` (~158-248) the same way
  as the sentence row — a column with a top row (thumbnails + edit panel) and the name below:

  (a) Row container class (line ~160):
  `relative flex flex-wrap items-center gap-3 md:gap-4 rounded-theme-card px-theme-general py-theme-item transition-colors`
  → `relative flex flex-col gap-3 rounded-theme-card px-theme-general py-theme-item transition-colors`.

  (b) Wrap `<ThumbnailStrip … />` (~167) and the edit-panel cluster together in a top row,
  and move the **title** block out below. Target skeleton (inner blocks unchanged):

```tsx
<div className="relative flex flex-col gap-3 rounded-theme-card px-theme-general py-theme-item transition-colors border-2 border-dashed …" …>
  {/* Top row: thumbnails (fill + wrap) + edit panel (top-right) */}
  <div className="flex items-start gap-3">
    <div className="flex-1 min-w-0">
      <ThumbnailStrip thumbnails={list.thumbnails} />
    </div>
    <div className="shrink-0">
      {isEditing && (
        <EditPanel className="flex-wrap">
          {/* …the existing Trash2 / Pencil / FolderInput / Move IconButtons, unchanged… */}
        </EditPanel>
      )}
    </div>
  </div>

  {/* Below: list name (or inline rename input), full width */}
  <div className="min-w-0">
    {/* …the existing isEditingThisName ? <input row> : <p name> switch… */}
  </div>
</div>
```

  (c) In the name `<p>` (~201), `truncate` → `break-words` so long names wrap.
  Drop the now-unneeded `flex flex-wrap items-center gap-3 flex-1` meta wrapper (~172) and
  `flex-1 min-w-[8rem]` (~173) — the name sits directly in the `min-w-0` block.

- [ ] **Step 4: Verify**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx tsc -p convex/tsconfig.json --noEmit 2>&1 | grep "error TS" || echo "convex types clean"
npx tsc --noEmit 2>&1 | grep -i "ListsModeContent" || echo "no app type errors"
npx eslint app/components/app/lists/sections/ListsModeContent.tsx 2>&1 | grep "  error " || echo "no eslint errors"
```
Expected: all clean.

- [ ] **Step 5: Manual verification** (Lists → a folder):
  - A list with >4 items shows ALL its thumbnails (no "…"), wrapping onto new rows; the list
    name sits below. Long names wrap. Edit panel top-right; drag/delete/rename still work.

- [ ] **Step 6: Commit**

```bash
git add convex/profileLists.ts app/components/app/lists/sections/ListsModeContent.tsx
git commit -m "Lists: stack thumbnails over name, wrap all thumbnails (drop 4-cap) (WS6)"
```

---

## Task 3: Tracker + final sweep

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -vE "lib/stripe.ts|\.next/types|reload-category-defaults" || echo "typecheck clean"
```

- [ ] **Step 2: Mark WS6.1 done** in `docs/4-builds/plans/phase-14.5-refinement-pass.md`
  (the `## Workstream 6` block + the status table), noting the stacked layout applies to
  both trees and the list 4-thumbnail cap was removed.

- [ ] **Step 3: Commit the tracker**

```bash
git add docs/4-builds/plans/phase-14.5-refinement-pass.md
git commit -m "docs: mark Phase 14.5 WS6.1 shipped"
```

---

## Self-review

**Spec coverage:**
- Sentences: symbols over full wrapping text, all screens → Task 1. ✓
- Lists: thumbnails over name, stacked → Task 2 Step 3. ✓
- Lists: drop the 4-thumbnail cap, wrap all → Task 2 Steps 1–2. ✓
- Text wraps fully (no truncate) → Task 1 (e) + Task 2 (c). ✓
- Edit panel top-right in the stacked layout → Tasks 1 & 2 skeletons. ✓

**Placeholder scan:** the query change + `ThumbnailStrip` body are shown in full. The two
row restructures show the exact container/class changes + a skeleton locating each existing
inner block; the inner blocks (strips, text variants, IconButtons) are moved verbatim, not
rewritten. Commands have expected output.

**Type consistency:** `thumbnails: { imagePath?: string }[]` stays the same shape (just
longer); `ThumbnailStrip` loses its `itemCount` prop (removed at the one call site);
`ListRow.thumbnails` already variable-length.

**Known soft spot:** removing the query's 4-cap means each list row loads all item images.
Accepted per the brainstorm (it's what makes wrapping meaningful). If a very large list ever
causes a visible load cost, a lazy/`loading="lazy"` pass on the strip is a cheap follow-up.
