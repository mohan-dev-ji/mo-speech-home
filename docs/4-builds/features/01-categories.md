# Feature Spec: Categories (Phase 3)

**Status:** Not started  
**Phase:** 3  
**Depends on:** Phase 1 (studentProfiles, profileCategories schema), Phase 2 (SymbolCard, CategoryBoardGrid, TalkerSection)  
**Reference docs:** `02-categories.md`, `12-convex-schema.md`, `06-resource-library.md`

---

## Goal

Instructor can create, edit, and reorder categories. Student can navigate a grid of categories and interact with symbols on the board. Multiple profiles per account are supported, each with their own independent category set.

---

## Edit Mode Architecture — Read This First

There are two distinct levels of editing. Do not conflate them.

### Level 1 — In-page edit mode (toggle on the current page)

Edit mode is a local boolean state on the page (`isEditing`). Toggling it switches every item on the page from its **view component** to its **edit component** — same page, same URL, no navigation.

| Page | View component | Edit component |
|---|---|---|
| Categories list | `CategoryTile` | `CategoryTileEditable` — move (drag), delete |
| Category board | `SymbolCard` | `SymbolCardEditable` — move (drag), edit, delete |
| Category lists | `ListItem` | `ListItemEditable` — move, edit, delete |
| Category sentences | `SentenceItem` | `SentenceItemEditable` — move, edit, delete |
| Category first-thens | `FirstThenCard` | `FirstThenCardEditable` — move, edit, delete |

The edit component handles position/order changes and deletion directly. It also exposes an "Edit" button that escalates to Level 2.

### Level 2 — Symbol editor modal (shared across the entire app)

Pressing "Edit" on a symbol from **any context** (board, list, sentence, first-then, or anywhere else in the future) opens `SymbolEditorModal`. This is a single shared component in `app/components/shared/` that handles the full creative editing experience: image source, label, audio, and display overrides.

`SymbolEditorModal` is never duplicated or specialised per-context. It receives a `profileSymbolId` (edit mode) or `profileCategoryId` (create mode) and handles everything internally.

```
In-page edit mode       ← drag/delete/reorder — stays on page
      │
      └─ tap Edit on a symbol
            │
            ▼
      SymbolEditorModal  ← full creative editing — shared modal, called from anywhere
```

This distinction must hold throughout the build. If you find yourself building editing UI inside a page that belongs in `SymbolEditorModal`, stop and put it in the modal instead.

---

## Schema Changes Required Before Building Any UI

### 1. Add `activeProfileId` to `users` table

```typescript
// convex/schema.ts — users table
activeProfileId: v.optional(v.id("studentProfiles"))
```

### 2. Remove one-profile guard in `createStudentProfile`

Delete the early-return guard that returns the existing profile if one already exists. Multiple profiles per account are now allowed.

### 3. Update `getMyStudentProfile` query

Accept an optional `profileId` argument. Resolution order:
1. If `profileId` arg is provided → return that profile (verify it belongs to the caller's account)
2. Else check `users.activeProfileId` → return that profile
3. Else return the first profile found for the account (backwards compat)

### 4. New mutations needed

```typescript
setActiveProfile(profileId: Id<"studentProfiles">)
  // patches users.activeProfileId — called by profile switcher

duplicateProfile(sourceProfileId: Id<"studentProfiles">, name: string)
  // creates a new studentProfile document
  // copies all profileCategories with new profileId
  // copies all profileSymbols for each copied category with new profileId + new profileCategoryId
  // sets users.activeProfileId to the new profileId
  // returns new profileId

loadStarterTemplate(profileId: Id<"studentProfiles">)
  // seeds profileCategories + profileSymbols from the admin-managed starter resourcePack
  // called on new profile creation when the user chooses "Start from defaults"
  // also called directly when first profile is created during onboarding
```

---

## New Profile Creation Flow

Triggered from Settings when a profile already exists.

**Step 1 — Name the profile**
- Input for profile name
- Language selector (eng / hin)

**Step 2 — Choose starting point**
- Option A: "Duplicate [existing profile name]" — copies all categories and symbols
- Option B: "Start from defaults" — runs `loadStarterTemplate`

On confirm: create profile → run chosen seeding → set as active → close modal.

---

## Profile Switcher

Location: Settings page, above the student profile section.

- Shows all profiles on the account as selectable cards (name + language badge)
- Active profile highlighted
- Tapping a card calls `setActiveProfile` → `ProfileContext` re-queries → entire app reflects the new profile
- "Add profile" button opens the new profile creation flow above

---

## Category List Screen (`/[locale]/categories`)

### Data

```typescript
// Query
getProfileCategories(profileId: Id<"studentProfiles">)
  // returns profileCategories ordered by `order` field
```

### Render

- `CategoryBoardGrid` of `CategoryTile` components
- Each tile: icon, name (in active language), background colour
- Tap → navigate to `/[locale]/categories/[categoryId]`
- Instructor sees an "Edit" toggle button in the page header

### View mode

- Tap a tile → navigate to board

### Edit mode (instructor only, Level 1)

- Each `CategoryTile` switches to `CategoryTileEditable`
- Drag handle to reorder (patches `order` on `profileCategories`)
- Delete button with confirmation — deletes category + all associated `profileSymbols`, `profileLists`, `profileSentences`, `profileFirstThens`
- Tap the tile body → opens `CategoryMetaModal` (rename, change icon, change colour) — this is a simple metadata modal, not the symbol editor
- "+ Add Category" button appears at the end of the grid in edit mode

---

## Category Detail Screen (`/[locale]/categories/[categoryId]`)

### Mode switcher tabs

```
Board | Lists | First Thens | Sentences
```

Default mode: Board. Mode state is local (not persisted) — resets to Board on navigation.

### CategoryHeader

Reuse the shared `CategoryHeader` component.

- `mode="talker"` or `mode="banner"` — read from `stateFlags.talker_banner_toggle` and current local state
- If `talker_banner_toggle` is true: student sees a toggle button to switch between talker and banner
- If false: locked to instructor's setting

---

## Board Mode

### Data

```typescript
// Query
getProfileSymbols(profileCategoryId: Id<"profileCategories">)
  // returns profileSymbols for this category ordered by `order` field
  // includes imageSource, label, audio, display overrides
```

### Render

- `CategoryBoardGrid` of `SymbolCard` components
- Grid column count from `stateFlags.grid_size` (large=4, medium=8, small=12)
- Each `SymbolCard` wrapped in `ModellingOverlayWrapper` with `componentKey="symbol-{symbolId}"`

### Tap behaviour (view mode)

| Header mode | Tap action |
|---|---|
| Talker | Add to talker bar. If `audio_autoplay` is on, play audio immediately. |
| Banner | Play audio + show PlayModal |

### Edit mode (instructor only, Level 1)

- Instructor sees an "Edit" toggle button in the page header
- Each `SymbolCard` switches to `SymbolCardEditable`
- `SymbolCardEditable` shows: drag handle (reorder), Edit button, Delete button
- **Edit button → opens `SymbolEditorModal` (Level 2)** — full creative editing
- Delete button: removes `profileSymbol` record + associated R2 assets
- Drag to reorder (patches `order` on `profileSymbols`)
- "+ Add Symbol" tile at end of grid → opens `SymbolEditorModal` in create mode

---

## Lists Mode

**View mode**
- Ordered list of `profileLists` for this category
- Each list: name + ordered symbol chips
- Tap a chip → play audio
- Play button → PlayModal with sequential playback

**Edit mode (Level 1)**
- Each `ListItem` switches to `ListItemEditable`: drag to reorder, delete list, edit list name
- Tapping a symbol chip within the editable list → opens `SymbolEditorModal` (Level 2)
- "+ Add List" button → opens a simple name input, then puts the new list into edit mode
- "+ Add Symbol" within a list → opens `SymbolEditorModal` in create mode

---

## First Thens Mode

**View mode**
- Grid of `profileFirstThens` for this category
- Each card: "First [symbol] Then [symbol]"
- Tap either symbol → play its audio

**Edit mode (Level 1)**
- Each `FirstThenCard` switches to `FirstThenCardEditable`: drag to reorder, delete, edit name
- Tapping either symbol slot → opens `SymbolEditorModal` (Level 2) to swap or edit that symbol
- "+ Add First Then" button

---

## Sentences Mode

**View mode**
- Ordered list of `profileSentences` for this category
- Each sentence: name + ordered symbol chips
- Play button → PlayModal + generates/plays Chirp 3 HD natural voice audio
- TTS audio cached to R2 on first play; subsequent plays use cached file

**Edit mode (Level 1)**
- Each `SentenceItem` switches to `SentenceItemEditable`: drag to reorder, delete, edit name
- Tapping a symbol chip → opens `SymbolEditorModal` (Level 2)
- Reordering chips within a sentence patches `items` array order
- "+ Add Sentence" button
- "+ Add Symbol" within a sentence → opens `SymbolEditorModal` in create mode

---

## Permissions Model

All edit controls are gated on view mode. `ProfileContext` exposes `viewMode: "instructor" | "student-view"`.

| Control | Instructor | Student (view-only) | Student (edit — future) |
|---|---|---|---|
| Add category | ✅ | ❌ | ✅ |
| Edit category | ✅ | ❌ | ✅ |
| Delete category | ✅ | ❌ | ❌ |
| Add/edit symbol | ✅ | ❌ | ✅ |
| Reorder symbols | ✅ | ❌ | ✅ |
| Add/edit lists | ✅ | ❌ | ✅ |

Student edit permissions are a Phase 4+ concern. For Phase 3, only instructors can edit.

---

## Category Colour System

`profileCategories.colour` stores a **Tailwind base colour name** — e.g. `"rose"`, `"sky"`, `"orange"`. A single value drives three surfaces:

| Surface | Value used |
|---|---|
| Category tab (folder tile + breadcrumb badge) | `{colour}-500` |
| Symbol hover border — all symbols in the category | `{colour}-500` |
| Symbol card background — all symbols in the category | `{colour}-100` |

Individual `profileSymbol.display.bgColour` / `display.borderColour` overrides still take precedence — the category colour is the default, not a hard override.

### CATEGORY_COLOURS map

A static constant `CATEGORY_COLOURS` in `app/lib/categoryColours.ts` maps each allowed name to its hex pair:

```typescript
export const CATEGORY_COLOURS: Record<string, { c500: string; c100: string }> = {
  rose:   { c500: '#F43F5E', c100: '#FFE4E6' },
  pink:   { c500: '#EC4899', c100: '#FCE7F3' },
  orange: { c500: '#F97316', c100: '#FFEDD5' },
  amber:  { c500: '#F59E0B', c100: '#FEF3C7' },
  yellow: { c500: '#EAB308', c100: '#FEF9C3' },
  lime:   { c500: '#84CC16', c100: '#ECFCCB' },
  green:  { c500: '#22C55E', c100: '#DCFCE7' },
  teal:   { c500: '#14B8A6', c100: '#CCFBF1' },
  sky:    { c500: '#0EA5E9', c100: '#E0F2FE' },
  blue:   { c500: '#3B82F6', c100: '#DBEAFE' },
  indigo: { c500: '#6366F1', c100: '#E0E7FF' },
  violet: { c500: '#8B5CF6', c100: '#EDE9FE' },
  purple: { c500: '#A855F7', c100: '#F3E8FF' },
  fuchsia:{ c500: '#D946EF', c100: '#FDF4FF' },
  red:    { c500: '#EF4444', c100: '#FEE2E2' },
  slate:  { c500: '#64748B', c100: '#F1F5F9' },
};
```

**No dynamic Tailwind class names.** All colour application uses `style={{ backgroundColor: hex, borderColor: hex }}` via this map. This avoids Tailwind purge issues entirely.

### Migration note

`defaultCategorySymbols.ts` currently stores hex values (e.g. `#F97316`). These must be replaced with named keys (`"orange"`) before the colour system is wired. Update the seed data at the same time as implementing the colour picker.

---

## Banner Mode

The `Header` component in `mode="banner"` shows:

```
┌─ Banner card (var(--theme-card) bg) ─────────────────────────────┐
│  [Category image]  Category name                  [pill toggle]  │
│                    [Model] [Edit]                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Category image

Stored as `imagePath: v.optional(v.string())` — a new field to add to `profileCategories` (R2 path, same convention as symbol images). This image:

- Displays in the banner (left side, ~80px square)
- Appears as the folder card image on the categories list screen (replacing the current `ImageIcon` placeholder)
- Is editable only in edit mode (see below)

**Schema addition required:**
```typescript
// convex/schema.ts — profileCategories table
imagePath: v.optional(v.string()),
```

### What is visible in non-edit banner mode

| Element | Visible |
|---|---|
| Category image | ✅ |
| Category name | ✅ |
| Category colour (as tab/breadcrumb) | ✅ |
| Colour picker | ❌ — edit mode only |
| Model button | ✅ (disabled until Phase 6) |
| Edit button | ✅ |

---

## Board Mode — Edit State

### Entering edit mode

Tapping **Edit** in the banner sets `isEditing = true` (local state). No URL change.

### Banner in edit mode

The banner transforms to an editing surface:

- **Category image** — same position, gains orange SVG dashed border + tap-to-change overlay; tapping opens the image picker (subset of SymbolEditorModal image tab — deferred to Phase 4, shows placeholder tap for now)
- **Colour picker** — appears in the banner below the image; renders swatches from `CATEGORY_COLOURS`; selected colour patches `profileCategories.colour` immediately on tap
- Model and Edit buttons remain; Edit button now reads "Done" to exit edit mode

### Symbol grid in edit mode

Every `SymbolCard` switches to `SymbolCardEditable`. Visual rules:

- **Shrink**: inner content padded to ~p-3 within the same grid cell, creating a visible gap from the cell boundary
- **Orange dashed border**: SVG overlay using `stroke: var(--theme-enter-mode)`, `strokeDasharray: "12 6"`, same pattern as `CategoryTile` in edit mode
- **Edit overlay strip** at the bottom of each card (three icon buttons, semi-transparent `var(--theme-card)` bg):
  - Pencil → `onEditRequest(profileSymbolId)` — caller opens `SymbolEditorModal` (Phase 4 placeholder for now)
  - Trash → `onDeleteRequest(profileSymbolId)` — confirmation then removes record
  - Grip → drag handle for reorder (dnd-kit, patches `order` on `profileSymbols`)
- **"+ Add Symbol" tile** at the end of the grid — tapping opens `SymbolEditorModal` in create mode (Phase 4 placeholder)

### SymbolCardEditable component

Lives at `app/components/app/categories/ui/SymbolCardEditable.tsx`.

```typescript
type SymbolCardEditableProps = {
  profileSymbolId: Id<'profileSymbols'>;
  imagePath?: string;
  label: string;
  language: string;
  onEditRequest: (id: Id<'profileSymbols'>) => void;
  onDeleteRequest: (id: Id<'profileSymbols'>) => void;
  dragHandleProps?: { listeners?: ...; attributes?: ... };
};
```

This is a Level 1 edit component. It never opens `SymbolEditorModal` itself — it calls `onEditRequest` and lets the page handle Level 2.

---

## Mode Switcher

The category detail page has four modes switched by a tab bar:

```
[ Board ]  [ Lists ]  [ First Thens ]  [ Sentences ]
```

Tab visibility is gated by state flags:

| Tab | State flag | Default |
|---|---|---|
| Board | always visible | — |
| Lists | `lists_visible` | true |
| First Thens | `first_thens_visible` | true |
| Sentences | `sentences_visible` | true |

Mode state is local — resets to Board on navigation away and back.

The mode switcher is `app/components/app/categories/ui/ModeSwitcher.tsx`.

---

## Convex Indexes Required

```typescript
// profileCategories
.index("by_profile_id", ["profileId"])
.index("by_profile_id_and_order", ["profileId", "order"])

// profileSymbols
.index("by_category_id", ["profileCategoryId"])
.index("by_category_id_and_order", ["profileCategoryId", "order"])

// profileLists / profileSentences / profileFirstThens
.index("by_category_id", ["profileCategoryId"])
```

---

## Build Order

1. Schema changes + new mutations (`setActiveProfile`, `duplicateProfile`, `loadStarterTemplate`)
2. Seed a starter resource pack in Convex dashboard for development
3. Profile switcher + new profile creation flow in Settings
4. Category list screen (read-only first, then edit controls)
5. Category detail — Board mode (read-only first, then edit controls)
6. Lists, First Thens, Sentences modes
7. Wire `ModellingOverlayWrapper` to every symbol card
