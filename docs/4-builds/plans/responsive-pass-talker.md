# Talker Responsive Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the persistent talker responsive on small screens — core-words grid steps columns by viewport × grid-size, phrase tiles shrink, and the talker tray scrolls horizontally instead of stacking rows.

**Architecture:** Additive responsive tiers on the app's existing Tailwind breakpoints (`md` 768px, `lg` 1024px). Desktop (`lg`) rendering is unchanged everywhere — only the missing mobile/`md` tiers are added. MOS-6 and MOS-7 are pure CSS (utility-class) changes. MOS-5 needs a reactive column *number* (the grid uses it for slot math, not just a CSS class), so it adds a small SSR-safe `useGridColumns` hook mirroring the existing `useIsSmallScreen`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind CSS 4. Spec: `../features/FEAT-006-talker-dropdown-responsive.md`. Linear: Responsive pass milestone (MOS-5/6/7).

## Global Constraints

- **Breakpoints:** Tailwind `md` = 768px, `lg` = 1024px. Match `CategoryBoardGrid` and `useIsSmallScreen(767)` exactly. Never introduce a new breakpoint value.
- **Desktop unchanged:** the `lg`-tier appearance of every touched surface must be byte-for-byte the current behaviour. Only base/`md` tiers are added.
- **Theme tokens only:** never hard-code colours/spacing/radii/font-size — use `--theme-*` / `bg-theme-*` / `rounded-theme*` etc. (CLAUDE.md rule 5). These tasks change only sizing/layout utilities, not colours.
- **No hard-coded copy:** N/A here (no new user-facing strings), but do not add literals if a label is needed — route through `useTranslations`.
- **Verify (no unit-test runner in repo):** `npx tsc --noEmit -p tsconfig.json` (typecheck) and `npx eslint <changed files>` must pass, plus live browser verification at mobile (375px) / tablet (768px) / desktop (1280px) via the preview server. Do NOT run `npx convex dev` in the worktree (per project memory) — typecheck only.
- **grid_size type:** `'large' | 'medium' | 'small'`, read from `useProfile().stateFlags.grid_size` (may be undefined → default `'large'`).

---

## File Structure

- **Create** `app/hooks/useGridColumns.ts` — reactive active-column-count hook for the 3-tier grid-size × viewport map. One responsibility: given a grid-size, return the column *number* for the current viewport tier.
- **Modify** `app/components/app/shared/ui/TalkerDropdown.tsx` — replace the static `CORE_GRID_COLS` lookup with `useGridColumns` (MOS-5). Also add the mobile tier to `PhraseDropdownCard` word tiles (MOS-6, normal-mode phrases).
- **Modify** `app/components/app/shared/ui/TalkerBar.tsx` — horizontal-scroll + smaller chips on small screens (MOS-7); shrink `PhraseBox` word tiles on small screens (MOS-6, tray phrases).

The column map is duplicated between `CategoryBoardGrid` (CSS classes) and the new hook (numbers) by necessity — the hook exports the map as the single source for the *numeric* form and documents the tie to `CategoryBoardGrid`. Do not try to unify them; the CSS-class form and the number form serve different consumers.

---

### Task 1: `useGridColumns` hook (MOS-5 foundation)

**Files:**
- Create: `app/hooks/useGridColumns.ts`
- Reference (do not modify): `app/hooks/useIsSmallScreen.ts` (pattern), `app/components/app/shared/ui/CategoryBoardGrid.tsx` (column map source of truth)

**Interfaces:**
- Produces: `GRID_COLUMN_MAP: Record<'large'|'medium'|'small', { base: number; md: number; lg: number }>` and `useGridColumns(gridSize: 'large' | 'medium' | 'small' | undefined): number` — returns the active column count for the current viewport tier (SSR-safe: assumes `lg` on the server, matching Next.js hydration default for unknown viewports).

- [ ] **Step 1: Write the hook**

```tsx
"use client";

import { useEffect, useState } from "react";

// Numeric mirror of CategoryBoardGrid's GRID_SIZE_CLASSES. Kept in lockstep with
// that component: same tiers, same counts. The talker core grid needs the column
// count as a NUMBER (it drives slot math — rows/totalCells — not just a CSS
// class), so it can't reuse the Tailwind-class form directly.
//   base = mobile (<768) · md = 768–1023 · lg = 1024+
export const GRID_COLUMN_MAP = {
  large:  { base: 2, md: 2, lg: 4 },
  medium: { base: 3, md: 4, lg: 8 },
  small:  { base: 4, md: 8, lg: 12 },
} as const;

type GridSize = "large" | "medium" | "small";

/**
 * Active column count for the current viewport tier, given the profile
 * grid-size setting. Mirrors CategoryBoardGrid's responsive column map but
 * returns a number (the talker grid uses the count in slot math, not only in a
 * CSS class). SSR-safe: returns the `lg` count on the server, then updates on
 * mount / resize — matches the desktop hydration assumption used by
 * useIsSmallScreen.
 */
export function useGridColumns(gridSize: GridSize | undefined): number {
  const tiers = GRID_COLUMN_MAP[gridSize ?? "large"];
  const [cols, setCols] = useState<number>(tiers.lg);

  useEffect(() => {
    const mdQuery = window.matchMedia("(min-width: 768px)");
    const lgQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setCols(lgQuery.matches ? tiers.lg : mdQuery.matches ? tiers.md : tiers.base);
    };
    update();
    mdQuery.addEventListener("change", update);
    lgQuery.addEventListener("change", update);
    return () => {
      mdQuery.removeEventListener("change", update);
      lgQuery.removeEventListener("change", update);
    };
  }, [tiers.base, tiers.md, tiers.lg]);

  return cols;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no errors referencing `useGridColumns.ts`).

- [ ] **Step 3: Lint**

Run: `npx eslint app/hooks/useGridColumns.ts`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add app/hooks/useGridColumns.ts
git commit -m "feat(talker): add useGridColumns reactive column-count hook (MOS-5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire the core grid to the viewport (MOS-5)

**Files:**
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx` (imports; `CORE_GRID_COLS` removal; `cols` derivation ~line 76 + ~line 98)

**Interfaces:**
- Consumes: `useGridColumns` from Task 1.
- Produces: nothing new (internal wiring). `cols` remains a `number` used by the existing slot math and `gridTemplateColumns` — no downstream signature change.

- [ ] **Step 1: Replace the static column map with the hook**

Delete the `CORE_GRID_COLS` constant (the block at ~line 76):

```tsx
// Column count follows the profile's grid-size setting (matches the main
// symbol board's lg tier). ...
const CORE_GRID_COLS = { large: 4, medium: 8, small: 12 } as const;
```

Add the import near the other hook imports at the top of the file:

```tsx
import { useGridColumns } from '@/app/hooks/useGridColumns';
```

Replace the `cols` derivation (currently `const cols = CORE_GRID_COLS[stateFlags.grid_size ?? 'large'];` at ~line 98) with:

```tsx
// Column count = profile grid-size × viewport tier (mirrors CategoryBoardGrid).
// Reactive number so the slot math (rows/totalCells) and the CSS grid stay in
// sync as the viewport crosses md/lg. Narrowing a `large` board steps 4 → 2
// columns, enlarging each symbol (FEAT-006 "too small" fix).
const cols = useGridColumns(stateFlags.grid_size);
```

Leave `MIN_ROWS`, the slot math (`filledCells`/`contentRows`/`rows`/`totalCells`), and the `gridTemplateColumns: repeat(${cols}, ...)` render untouched — they already consume `cols` as a number and now simply react to viewport changes.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS. In particular no "CORE_GRID_COLS is not defined" — confirm no other reference remains: `grep -n CORE_GRID_COLS app/components/app/shared/ui/TalkerDropdown.tsx` returns nothing.

- [ ] **Step 3: Lint**

Run: `npx eslint app/components/app/shared/ui/TalkerDropdown.tsx`
Expected: PASS.

- [ ] **Step 4: Browser verification**

Start the preview (see "Preview setup" at the end), open a talker page (`/en/categories` or `/en/search`), open the talker dropdown, Core words tab. At each width confirm the column count and that trailing empty cells still form a clean rectangle (no orphaned/overflowing cells):

| Width | grid-size large | medium | small |
|---|---|---|---|
| 375px (mobile) | 2 | 3 | 4 |
| 768px (md) | 2 | 4 | 8 |
| 1280px (lg) | 4 | 8 | 12 |

Change grid-size via Quick Settings / profile settings between checks. Confirm symbols are visibly larger at 375px than before (compare to `git stash` baseline if unsure). Check the console has no new errors (`read_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add app/components/app/shared/ui/TalkerDropdown.tsx
git commit -m "feat(talker): core-words grid columns respond to viewport (MOS-5)

Grid column count now = grid-size setting x viewport tier, mirroring
CategoryBoardGrid, via useGridColumns. lg unchanged; narrow screens use
fewer columns so symbols are bigger.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Talker tray — horizontal scroll + smaller chips (MOS-7)

**Files:**
- Modify: `app/components/app/shared/ui/TalkerBar.tsx` (the two chip-area container `div`s ~line 102 and ~line 114; the `SortableUnit` wrapper `w-40` ~line 166)

**Interfaces:**
- Consumes: nothing from prior tasks (independent, CSS-only).
- Produces: nothing.

- [ ] **Step 1: Switch the chip area to scroll-not-wrap on small screens**

Both the empty-state container (~line 102) and the populated container (~line 114) share the same flex classes. Update **both** occurrences. Current populated container:

```tsx
<div className="flex flex-1 min-w-0 self-stretch items-start flex-wrap content-start gap-theme-elements py-theme-elements overflow-y-auto">
```

becomes:

```tsx
<div className="flex flex-1 min-w-0 self-stretch items-start flex-nowrap overflow-x-auto md:flex-wrap md:overflow-x-visible md:content-start gap-theme-elements py-theme-elements overflow-y-auto">
```

For the empty-state container (~line 102), which uses `items-center`, apply the same wrap/scroll swap (keep `items-center`):

```tsx
<div className="flex flex-1 min-w-0 self-stretch items-center flex-nowrap overflow-x-auto md:flex-wrap md:overflow-x-visible gap-theme-elements py-theme-elements overflow-y-auto">
```

Rationale: below `md`, `flex-nowrap` + `overflow-x-auto` gives a single horizontally-scrolling row (chips no longer stack and push the controls off-screen). At `md`+, `flex-wrap` + `overflow-x-visible` restores today's wrapping exactly.

- [ ] **Step 2: Shrink the word chip on small screens**

In `SortableUnit`, the wrapper (~line 166):

```tsx
className={`relative group shrink-0 touch-none ${isPhrase ? "" : "w-40"}`}
```

becomes:

```tsx
className={`relative group shrink-0 touch-none ${isPhrase ? "" : "w-28 md:w-40"}`}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json` — Expected: PASS.
Run: `npx eslint app/components/app/shared/ui/TalkerBar.tsx` — Expected: PASS.

- [ ] **Step 4: Browser verification**

At 375px: add several symbols to the talker (tap symbols on the board). Confirm they stay on ONE row and the row scrolls horizontally; the Play/Save/Clear controls stay visible (not pushed off). Word chips are noticeably narrower (`w-28`). At 1280px: confirm chips are `w-40` and wrap to new rows exactly as before. Drag-to-reorder still works at both widths (8px activation preserved — untouched).

- [ ] **Step 5: Commit**

```bash
git add app/components/app/shared/ui/TalkerBar.tsx
git commit -m "feat(talker): tray scrolls horizontally + smaller chips on mobile (MOS-7)

Below md the chip row is flex-nowrap + overflow-x-auto so symbols scroll
instead of stacking and hiding the controls; word chips w-28. md+ keeps
today's wrap + w-40.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Phrase tiles shrink on small screens (MOS-6)

**Files:**
- Modify: `app/components/app/shared/ui/TalkerBar.tsx` — `PhraseBox` word tiles (~line 228 and ~line 233)
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx` — `PhraseDropdownCard` word tiles (~line 1233 and ~line 1238)

**Interfaces:**
- Consumes: nothing from prior tasks (independent, CSS-only). Touches the same two files as Tasks 2/3 but different components — sequence after them to avoid overlapping edits.
- Produces: nothing.

- [ ] **Step 1: Shrink the tray phrase-box word tiles (`PhraseBox`, TalkerBar.tsx)**

Empty placeholder (~line 228):

```tsx
<div className="w-24 h-24 rounded-theme-sm" style={{ background: ZINC.c100 }} />
```
becomes:
```tsx
<div className="w-16 h-16 md:w-24 md:h-24 rounded-theme-sm" style={{ background: ZINC.c100 }} />
```

Word tile (~line 233):

```tsx
className="w-24 h-24 rounded-theme-sm overflow-hidden flex items-center justify-center"
```
becomes:
```tsx
className="w-16 h-16 md:w-24 md:h-24 rounded-theme-sm overflow-hidden flex items-center justify-center"
```

- [ ] **Step 2: Shrink the dropdown normal-mode phrase-card word tiles (`PhraseDropdownCard`, TalkerDropdown.tsx)**

Empty placeholder (~line 1233):

```tsx
<div className="w-20 h-20 rounded-theme-sm" style={{ background: ZINC.c100 }} />
```
becomes:
```tsx
<div className="w-14 h-14 md:w-20 md:h-20 rounded-theme-sm" style={{ background: ZINC.c100 }} />
```

Word tile (~line 1238):

```tsx
className="w-20 h-20 rounded-theme-sm overflow-hidden flex items-center justify-center"
```
becomes:
```tsx
className="w-14 h-14 md:w-20 md:h-20 rounded-theme-sm overflow-hidden flex items-center justify-center"
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json` — Expected: PASS.
Run: `npx eslint app/components/app/shared/ui/TalkerBar.tsx app/components/app/shared/ui/TalkerDropdown.tsx` — Expected: PASS.

- [ ] **Step 4: Browser verification + visual tuning**

This is the "trial and error" issue (FEAT-006). At 375px, open the Phrases tab (needs at least one phrase in the bank) and add a phrase to the tray. Confirm the phrase tiles are visibly smaller and a multi-word phrase fits without dominating the row/panel. If `w-16`/`w-14` still looks too big or now too small, tune the base size (try `w-12`…`w-20`) — keep the `md:` value at the original (`w-24` / `w-20`). Re-run typecheck/lint after tuning. At 1280px confirm phrases are unchanged from baseline.

- [ ] **Step 5: Commit**

```bash
git add app/components/app/shared/ui/TalkerBar.tsx app/components/app/shared/ui/TalkerDropdown.tsx
git commit -m "feat(talker): phrase tiles shrink below md (MOS-6)

Tray PhraseBox and dropdown PhraseDropdownCard word tiles get a mobile
tier; md+ restores desktop size.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Preview setup (for browser verification steps)

There is no committed `.claude/launch.json`. Create one for this worktree (dev server on 3001 is pinned to a different worktree per project memory — use a distinct port):

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "mo-speech", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--", "-p", "3010"], "port": 3010 }
  ]
}
```

Then `preview_start` with `{name: "mo-speech"}`, navigate to `/en/categories`, and use `resize_window` (mobile 375 / tablet 768 / desktop 1280) between checks. Requires a signed-in profile with a talker-visible board; if auth blocks the preview, fall back to verifying via the user's running app and report what to check.

---

## Self-review

- **Spec coverage:** MOS-5 → Tasks 1–2 (viewport × grid-size, CategoryBoardGrid map). MOS-6 → Task 4 (both phrase surfaces). MOS-7 → Task 3 (nowrap scroll + smaller chips). Breakpoint basis (`md`/`lg`) in Global Constraints. All three FEAT-006 items covered.
- **Placeholders:** none — every code step shows the exact before/after.
- **Type consistency:** `useGridColumns(gridSize: 'large'|'medium'|'small'|undefined): number` defined in Task 1, consumed with `stateFlags.grid_size` (same union, undefined-safe) in Task 2. `GRID_COLUMN_MAP` exported but only the hook is consumed downstream.
- **Ordering:** Tasks 3 and 4 both edit `TalkerBar.tsx`, and Tasks 2 and 4 both edit `TalkerDropdown.tsx`, but disjoint regions; run in order 1→2→3→4 to keep diffs clean.
