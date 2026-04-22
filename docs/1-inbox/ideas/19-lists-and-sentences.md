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

An ordered set of symbol slots that form a visual phrase. Each slot has an image and display properties (background, text colour, card shape etc.) but no per-slot audio. Audio is at the sentence level — the whole sentence spoken in the student's selected voice.

### Slot data model

```typescript
slots: Array<{
  order: number
  imagePath?: string      // R2 path — SymbolStix path or profiles/{profileId}/images/
  displayProps?: {
    bgColour?: string
    textColour?: string
    textSize?: 'sm' | 'md' | 'lg' | 'xl'
    showLabel?: boolean
    showImage?: boolean
    cardShape?: 'square' | 'rounded' | 'circle'
  }
}>
```

No per-slot audio. No `description` field per slot.

### Sentence audio

`text` is the sentence as authored by the instructor (what is spoken, not the symbol labels). Audio is resolved via the lookup-first flow in `POST /api/tts`:

1. Search SymbolStix audio folder for the profile's current `voiceId`
2. Search global `ttsCache` by `(text, voiceId)`
3. If not found → generate via Google Cloud TTS (WaveNet/News API) → upload to `audio/{voiceId}/tts/{uuid}.mp3` → cache → return `r2Key`

`audioPath` stores the resolved R2 key (global TTS cache key, or `profiles/{profileId}/audio/{uuid}.webm` for recorded voice). On play, audio is served via `/api/assets?key={audioPath}`.

The **Sentence Audio Editor** is a dedicated component (separate from the universal `SymbolEditorModal`) that presents:
- Text field (pre-populated from slot descriptions if available, fully editable)
- **Generate** button → runs the lookup-first flow above
- **Record** button → MediaRecorder flow; blob uploaded to `profiles/{profileId}/audio/` on Save
- Preview and regenerate/re-record freely before committing

### Image sources

`SymbolEditorModal` in `sentenceSlot` mode — image picker tabs + display properties shown; label and audio sections hidden. SymbolStix paths stored directly; Google Images and AI gen uploaded to R2 under `profiles/{profileId}/images/`. No `profileSymbol` record created.

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
    audioPath?: string    // global TTS key or profiles/{profileId}/audio/...
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
  text?: string                            // sentence text — feeds TTS and display
  slots: Array<{
    order: number
    imagePath?: string
    displayProps?: DisplayProps
  }>
  audioPath?: string                       // global TTS key or profiles/{profileId}/audio/...
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

`SymbolEditorModal` is a universal modal used across all three contexts. The `mode` prop controls which sections are shown and what Save does.

| Section | `categoryBoard` | `listItem` | `sentenceSlot` |
|---|---|---|---|
| Image picker (4 tabs) | ✓ | ✓ | ✓ |
| Label / Description | Label + language | Description | — |
| Audio (Generate / Record) | ✓ | ✓ | — |
| Display properties | ✓ | — | ✓ |
| Save creates | `profileSymbol` record | `imagePath` + `audioPath` on item | `imagePath` + `displayProps` on slot |
| Save button label | "Save to [Category]" | "Save to list" | "Save to sentence" |

Sentence-level audio is handled by the **Sentence Audio Editor** — a separate component, not the universal modal. See the Sentence Audio section above and `05-symbol-editor.md` for full details.
