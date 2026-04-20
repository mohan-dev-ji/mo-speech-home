# Lists and Sentences

## Overview

Lists and Sentences are global content types that belong directly to a student profile. They are **not** attached to a category. Each appears as its own top-level nav item alongside Categories.

```
Home  |  Search  |  Categories  |  Lists  |  Sentences  |  Settings
```

Each nav item can be shown or hidden per student profile via state flags (`lists_visible`, `sentences_visible`). This lets instructors focus a student on only what they actively use.

---

## Lists

### What a list is

An ordered set of symbols — typically a visual routine, schedule, or topic collection. Lists are the most flexible content type: they can draw symbols from any category, from the SymbolStix library, or from uploaded images.

### Display modes

Every list has a `displayFormat` field with three options:

| Format | Description |
|---|---|
| `rows` | One symbol per row, full-width. Labels alongside the image. Default. |
| `columns` | Two symbols per row. Compact grid. |
| `grid` | Three or more per row. Image-dominant; smaller labels. |

### Toggles (additive — all can be active simultaneously)

| Toggle | Field | Effect |
|---|---|---|
| Numbered List | `showNumbers` | Shows a number badge on each item (1, 2, 3…) |
| Checklist | `showChecklist` | Adds a checkbox per item that the student can tick |
| First Then | `showFirstThen` | Labels item 0 as "First" and all subsequent items as "Then" |

All three toggles are independent and additive. A list can be numbered, a checklist, and a First Then all at once.

### Item data model

List items are self-contained. They do **not** reference `profileSymbolId`. Each item stores its own `imagePath` (R2 path) and optional description.

```typescript
items: Array<{
  order: number
  imagePath?: string      // R2 path — library path, category copy, or list-owned upload
  description?: string    // per-item text label (visible in rows/columns mode)
}>
```

**Why self-contained?** Deleting a list can clean up only its own R2 assets without touching the category board. If a symbol is changed or deleted from a category, lists that copied its image are unaffected.

### Image sources for list items

When adding an image to a list item, a `ListItemPickerModal` opens with three tabs:

| Tab | What it does |
|---|---|
| **My Categories** | Browse existing profile categories. Tap a symbol to copy its `imagePath` string into the list item. The original category board symbol is untouched. |
| **SymbolStix** | Search the SymbolStix library by keyword. Tap an image to use its `imagePath` directly. SymbolStix paths are never deleted (shared library asset). |
| **Upload** | Upload a custom image. Stored at `profiles/{profileId}/lists/{listId}/items/`. These are owned by the list — deleted when the list is deleted. |

### Image ownership and deletion

| Image source | Who owns it | Deleted when list is deleted? |
|---|---|---|
| Copied from category (imagePath string copy) | Category owns it | No — list only copied the path string |
| SymbolStix library path | Shared library | No — never deleted |
| Uploaded to list path | List owns it | Yes — R2 asset deleted with list |

This model means `deleteProfileList` only needs to clean up R2 assets under `profiles/{profileId}/lists/{listId}/`.

---

## Sentences

### What a sentence is

An ordered set of symbol images that form a visual phrase. Sentences are image-only — no per-item text, no per-item voice. Audio is at the sentence level: a whole-sentence TTS string spoken by Google Chirp 3 HD (natural voice).

### Item data model

```typescript
items: Array<{
  order: number
  imagePath?: string      // R2 path — same three sources as list items
}>
```

No `description` field. No per-item audio.

### Sentence audio

`ttsText: { eng?: string, hin?: string }` is authored by the instructor (the text to be spoken, not the symbol labels). On first play:
1. Check `ttsAudioPath` — if cached, play from R2.
2. On cache miss, call Google Chirp 3 HD TTS server-side, store result at `profiles/{profileId}/sentences/{sentenceId}/audio/{lang}.mp3`, patch `ttsAudioPath`.

### Image sources

Same `ListItemPickerModal` — same three tabs (My Categories / SymbolStix / Upload). Upload path is `profiles/{profileId}/sentences/{sentenceId}/items/`.

---

## Convex Schema

### profileLists

```typescript
profileLists: {
  _id: Id<"profileLists">
  profileId: Id<"studentProfiles">         // profile-level; no profileCategoryId
  name: { eng: string, hin?: string }
  order: number
  displayFormat: "rows" | "columns" | "grid"
  showNumbers: boolean
  showChecklist: boolean
  showFirstThen: boolean
  librarySourceId?: string
  items: Array<{
    order: number
    imagePath?: string
    description?: string
  }>
  createdAt: number
  updatedAt: number
}
```

Indexes: `by_profile_id`, `by_profile_id_and_order`

### profileSentences

```typescript
profileSentences: {
  _id: Id<"profileSentences">
  profileId: Id<"studentProfiles">         // profile-level; no profileCategoryId
  name: { eng: string, hin?: string }
  order: number
  librarySourceId?: string
  items: Array<{
    order: number
    imagePath?: string
  }>
  ttsText?: { eng?: string, hin?: string }
  ttsAudioPath?: { eng?: string, hin?: string }
  createdAt: number
  updatedAt: number
}
```

Indexes: `by_profile_id`, `by_profile_id_and_order`

### profileFirstThens — deprecated

`profileFirstThens` is removed from the schema entirely. No data existed in this table. First Then is now a display toggle (`showFirstThen`) on `profileLists`, not a separate content type.

---

## Navigation and State Flags

Two new flags control nav visibility:

| Flag | Default | Controls |
|---|---|---|
| `lists_visible` | ON | Whether Lists nav item is visible to the student |
| `sentences_visible` | ON | Whether Sentences nav item is visible to the student |

These are independent of `categories_visible`. An instructor can hide Categories and only show Lists, or show all three.

---

## Routes

```
/[locale]/lists/          ← Global lists screen (index of all profile lists)
/[locale]/lists/[listId]/ ← List detail
/[locale]/sentences/      ← Global sentences screen
```

---

## Relationship to Categories

Categories are **board-only** after ADR-002. The mode switcher (Board / Lists / First Thens / Sentences) has been removed. Category Detail always shows the symbol board.

Lists and Sentences are independent — they can draw symbols from any category, from the library, or from uploads. There is no `profileCategoryId` on either table.

Resource library packs that previously included category-level lists/sentences will create profile-level lists/sentences on load (no category FK).

---

## ListItemPickerModal

A context-aware picker modal opened when adding an image to a list or sentence item.

```
┌─ Add Symbol ──────────────────────────────────────┐
│  [ My Categories ] [ SymbolStix ] [ Upload ]      │
│                                                   │
│  My Categories tab:                               │
│    ┌──────────────────────────────────────────┐   │
│    │ [Clothing ▸]  [Food ▸]  [Daily ▸] …     │   │
│    │                                          │   │
│    │  [symbol] [symbol] [symbol] [symbol]     │   │
│    └──────────────────────────────────────────┘   │
│                                                   │
│  SymbolStix tab:                                  │
│    [search input]                                 │
│    [symbol grid — tap to select]                  │
│                                                   │
│  Upload tab:                                      │
│    [file picker — compresses to .webp client-side]│
└───────────────────────────────────────────────────┘
```

Tapping any symbol in any tab saves `imagePath` into the list/sentence item and closes the modal. No `profileSymbol` record is created.

---

## Symbol Editor Context Awareness

When the symbol editor modal is opened from a **category board** context, the save flow creates/updates a `profileSymbol` record (with label, audio, display options). Save button reads "Save to [Category Name]".

When opened from a **list or sentence** context, the save flow writes only `imagePath` into the item — no `profileSymbol` record, no label/audio fields shown. Save button reads "Save to List" / "Save to Sentence".

The modal adapts its UI and save behaviour based on calling context.
