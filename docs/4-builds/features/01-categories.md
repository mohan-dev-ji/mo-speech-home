# Feature Spec: Categories (Phase 3)

**Status:** Not started  
**Phase:** 3  
**Depends on:** Phase 1 (studentProfiles, profileCategories schema), Phase 2 (SymbolCard, CategoryBoardGrid, TalkerSection)  
**Reference docs:** `02-categories.md`, `12-convex-schema.md`, `06-resource-library.md`

---

## Goal

Instructor can create, edit, and reorder categories. Student can navigate a grid of categories and interact with symbols on the board. Multiple profiles per account are supported, each with their own independent category set.

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

- `CategoryBoardGrid` of category tiles
- Each tile: icon, name (in active language), background colour
- Tap → navigate to `/[locale]/categories/[categoryId]`
- Instructor sees an edit button on each tile (pencil icon, top-right corner)
- Instructor sees a "+ Add Category" tile at the end of the grid

### Edit mode (instructor only)

- Tap edit → `CategoryEditModal`: rename, change icon, change colour, delete
- Drag to reorder (updates `order` field on `profileCategories`)
- Delete: confirmation modal with destructive warning — deletes category + all its `profileSymbols`

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

### Tap behaviour

| Header mode | Tap action |
|---|---|
| Talker | Add to talker bar. If `audio_autoplay` is on, play audio immediately. |
| Banner | Play audio + show PlayModal |

### Instructor edit controls

- Long-press or edit-mode button reveals: reorder handle, edit button, delete button
- Edit → opens `SymbolEditorModal` (Phase 4)
- "+ Add Symbol" button at end of grid → opens `SymbolEditorModal` in create mode

---

## Lists Mode

- Ordered list of `profileLists` for this category
- Each list: name + ordered symbol chips
- Tap a chip → play audio
- Play button → PlayModal with sequential playback
- Instructor: add/edit/delete lists

---

## First Thens Mode

- Grid of `profileFirstThens` for this category
- Each card: "First [symbol] Then [symbol]"
- Tap either symbol → play its audio
- Instructor: add/edit/delete first-thens

---

## Sentences Mode

- Ordered list of `profileSentences` for this category
- Each sentence: name + ordered symbol chips
- Play button → PlayModal + generates/plays Chirp 3 HD natural voice audio
- TTS audio cached to R2 on first play; subsequent plays use cached file
- Instructor: add/edit/delete sentences

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
