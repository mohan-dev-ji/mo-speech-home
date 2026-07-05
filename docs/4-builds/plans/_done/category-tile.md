# Plan — Rebind Category-tile to the new Figma design

## Context
The category grid still uses the legacy **folder-silhouette** tile (a coloured tab with the
title inside, a card body, and a "From Starter Pack" source tag). The Figma "Mo Speech — Finals"
design system replaces it with a flatter **Category-tile** (`3017:2352`): a soft category-tinted
card with a plain centred title and a light thumbnail box — no folder shape, no source tag. Its
**Edit-mode** variant grows taller and injects the **Edit-panel** component (`3017:2263`) of
icon-buttons, and swaps the heavy inset SVG dashed outline for a subtle **stroke-2 dashed CSS
border on the tile itself**. This is the next Stage-2 component rebind (see
`docs/4-builds/stage-2-component-inventory.md`); it also makes the new `IconButton` atom and a new
`EditPanel` atom real (first consumers).

Owner decisions (confirmed this session):
- **Edit-panel on the tile = Delete + Move only** (matches the Figma tile instance; the library
  Edit-panel has 4 buttons — Delete/Edit/Save/Move — but the tile uses 2). Image/name editing
  stays in the category **detail banner** as today.
- **Tile WIDTH must never change** (so the grid-size settings stay true). The tile **expands
  vertically** to fit the edit icons; the edit-panel **wraps within the existing width** when a
  tile is narrow (dense grid) instead of forcing the tile wider.

## The new design (authoritative — from the Figma component)
**Default tile** (`flex flex-col gap items-center justify-center`, grid-driven width):
- bg = category colour **@ 20%** — `color-mix(in srgb, <c500> 20%, transparent)` (was c500 @ 50%).
- `rounded-theme-card` (16), padding `p-theme-folder` (20), gap `gap-theme-gap` (16).
- **Title** — plain centred text on top, `text-theme-alt-text`, **`font-normal`** (Figma = Noto
  Sans Regular ~20px), responsive. (Was inside the folder tab, semibold.)
- **Thumb box** — `bg = c100` (light tint), `rounded-theme-sm` (8), square, holds the category
  image (`/api/assets?key=<imagePath>`) or the `ImageIcon` fallback.
- **Removed:** the folder TAB shape and the `LibrarySourceBadge` ("From …") — both gone from the tile.

**Edit-mode tile** = Default plus:
- **stroke-2 dashed border** in `--theme-enter-mode` (orange), as a real CSS `border-2 border-dashed`
  on the tile (replaces the inset stroke-4 SVG rect). Default state carries `border-2 border-transparent`
  so toggling edit causes **no layout shift**.
- An injected **Edit-panel** below the thumb: a `gap-theme-elements` cluster of two **32² neutral**
  `IconButton`s — **Delete** (neutral white fill + RED `text-theme-warning` trash glyph,
  `onDeleteRequest`) and **Move** (neutral fill, dark glyph, carries the dnd-kit drag listeners).

## Implementation steps

### 1. `IconButton` — add a `size` variant
`app/components/app/shared/ui/IconButton.tsx` (atom is currently unused — zero call-site risk).
- Add `size?: 'sm' | 'md'` (default `'md'`). `const SIZE = { sm: 'size-8', md: 'size-12' }`.
- Swap the hardcoded `size-12` for `SIZE[size]`; keep the shared `[&_svg]:size-6` (24² glyph) for
  both — verified: `size-8` (32²) + 24² glyph = the Figma 4px inset; `size-12` (48²) = 12px inset.
- Update the JSDoc to mention the `sm` (32²) option. No token changes.

### 2. `EditPanel` — new atom (`shared/ui/EditPanel.tsx`, Figma `3017:2263`)
- `"use client"`; props `{ orientation?: 'horizontal'|'vertical'; children: ReactNode; className?: string }`.
- Composition-only — renders whatever IconButtons the consumer passes (tile passes 2; library has 4).
- Tokens map 1:1 to the Figma 16/8 figures (no new token needed):
  - horizontal → `flex items-center justify-center gap-theme-elements px-theme-gap py-theme-elements`
  - vertical   → `flex flex-col items-center justify-center gap-theme-elements px-theme-elements py-theme-gap`
- Uses `cn(...)` from `@/lib/utils`.

### 3. `CategoryTile` rebind (the major change)
`app/components/app/categories/ui/CategoryTile.tsx`. Keep: the `Tag = isEditing ? 'div' : 'button'`
switch, `w-full`, the `@container` wrapper, `getCategoryColour` (`app/lib/categoryColours.ts`),
`onClick`/`onDeleteRequest`/`dragHandleProps`/`adminPacks` props, the `NAME_FONT_SIZE` clamp map.
- **Outer container** becomes one element: `relative w-full flex flex-col gap-theme-gap items-center
  justify-center p-theme-folder rounded-theme-card border-2 border-dashed`, border colour
  `isEditing ? 'border-theme-enter-mode' : 'border-transparent'`, `!isEditing && 'cursor-pointer group'`;
  `style={{ backgroundColor: color-mix(... c500 20% ...) }}`.
- **Title**: `<p class="w-full text-center text-theme-alt-text font-normal truncate leading-tight"
  style={{fontSize: nameFontSize}}>` — keep the responsive `NAME_FONT_SIZE` map but **retune the
  clamp maxima up toward ~1.25rem/20px** (Figma `text-theme-large`) for the `large` grid, scaling
  down for medium/small.
- **Thumb**: `w-full aspect-square rounded-theme-sm` box, `bg = c100`, image `object-contain`
  (`2cqi` inner padding) or `ImageIcon` fallback (`c500`). Stays fluid (no fixed 164px).
- **Edit-panel** (only when `isEditing`, below thumb):
  `<EditPanel orientation="horizontal" className="flex-wrap">` containing:
  - `<IconButton size="sm" variant="neutral" icon={<Trash2/>} className="text-theme-warning"
     label={t('deleteCategory',{name})} onClick={() => onDeleteRequest(category._id, name)} />`
  - `<IconButton size="sm" variant="neutral" icon={<Move/>} className="cursor-grab
     active:cursor-grabbing touch-none" label={t('moveCategory',{name})}
     {...dragHandleProps?.listeners} {...dragHandleProps?.attributes} />`
  - `flex-wrap` is how the **width stays fixed and height grows**: when a dense-grid tile is too
    narrow for both 32² buttons in a row, the second wraps beneath the first (still centred, fixed
    32² tap targets). `gap-theme-elements` applies to both row and column gaps. No grid-size coupling.
- **Remove**: the folder-tab div, the duplicated card-body wrapper, the inset SVG dashed `<rect>`,
  the bespoke Trash/Move `<button>`s, and the `LibrarySourceBadge` render + `resolvePackName` import.

### 4. Admin pack badge (`PackStatusLabel`, admin-only `adminPacks` prop)
Keep it working (the public source tag is the only thing removed). Render it in the flex-col between
the thumb and the edit-panel, gated on `adminPacks`. Drop the old `adminPacks ? '7cqi…'` symbol
top-padding hack — the new `gap-theme-gap` column spaces it cleanly.

### 5. i18n
`CategoryTile` switches to `useTranslations('categories')`. Add to `messages/en.json` (real English)
and `messages/hi.json` (`"… (hi)"` placeholder) under `categories`:
`"deleteCategory": "Delete {name}"`, `"moveCategory": "Move {name}"`. Replace the hardcoded
`aria-label={`Delete ${name}`}` / `Move ${name}` with these (now the IconButton `label`s).

## Files
- `app/components/app/shared/ui/IconButton.tsx` — add `size` variant.
- `app/components/app/shared/ui/EditPanel.tsx` — **new**.
- `app/components/app/categories/ui/CategoryTile.tsx` — rebind.
- `messages/en.json`, `messages/hi.json` — 2 keys.
- (Reference only — all tokens already exist: `app/globals.css`, `app/lib/categoryColours.ts`.)

## Verification (drive the signed-in app at localhost:3000, dev server already running on :3000)
1. `npx tsc --noEmit` — catch removed-import / new-prop type errors.
2. Categories page, **Default**: category-@20% fill, plain centred title on top, c100 square thumb
   (image or ImageIcon), `rounded-theme-card`, no folder tab, **no "From … " tag**.
3. **Toggle Edit**: stroke-2 dashed orange border on the tile with **no layout shift**; tile grows
   taller showing Delete (red) + Move (dark) 32² neutral icon-buttons.
4. **Grids** (QuickSettings → Grid: large/medium/small): tile **width unchanged** at each density;
   in the dense `small` grid the two edit icons **wrap to a vertical stack** (tile taller, never
   wider). Drag-Move reorders; Delete opens the confirm dialog; a non-edit tile click navigates.
5. **Themes** (cycle dark + a couple of accent/light themes): orange border, red trash, alt-text
   title, c100/c500 mixes all resolve via tokens — nothing hardcoded breaks theme switching.
6. Admin view: `PackStatusLabel` still renders below the thumb.