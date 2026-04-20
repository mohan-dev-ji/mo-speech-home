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

When adding an image to a list item, the existing `SymbolEditorModal` opens in list context. The image tabs work exactly as in the category board flow, but the save behaviour is different (see below).

| Source | Storage |
|---|---|
| **SymbolStix** | `imagePath` from the `symbols` table stored directly in the list item. No R2 copy — the shared library file is reused as-is. |
| **Google Images** | Downloaded server-side, uploaded to R2 under `profiles/{profileId}/`, R2 path stored in the item. |
| **AI Generation** | Generated server-side, uploaded to R2 under `profiles/{profileId}/`, R2 path stored in the item. |
| **User Upload** | Uploaded to R2, path stored in the item. |

There is no "My Categories" tab. The category board is a separate context; symbols are not browsed or copied from there when editing lists.

### Image ownership and deletion

| Image source | Who owns it | Deleted when list is deleted? |
|---|---|---|
| SymbolStix library path | Shared library | No — never deleted |
| Google Images / AI gen uploaded to profile R2 | Profile-level asset | Yes — R2 asset deleted with the list |
| User upload | Profile-level asset | Yes — R2 asset deleted with the list |

`deleteProfileList` cleans up only R2 assets that were uploaded specifically for that list. SymbolStix paths are skipped.

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

Same `SymbolEditorModal` in sentence context — same image source tabs (SymbolStix / Google Images / AI Generation / Upload). SymbolStix paths stored directly; Google Images and AI gen uploaded to R2 under `profiles/{profileId}/`. No `profileSymbol` record created.

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

## Symbol Editor Context Awareness

The `SymbolEditorModal` is used for adding images to both category boards and list/sentence items. The image source tabs (SymbolStix / Google Images / AI Generation / Upload) are the same in both contexts.

**Save behaviour differs by calling context:**

| Context | Save creates | Save button label |
|---|---|---|
| Category board | `profileSymbol` record (with label, audio, display fields) | "Save to [Category Name]" |
| List item | Only `imagePath` stored in the list item — no `profileSymbol` created | "Save to list" |
| Sentence item | Only `imagePath` stored in the sentence item — no `profileSymbol` created | "Save to sentence" |

In list/sentence context, the label, audio, and display sections of the editor are not shown — only the image picker tabs.
