# ADR-002 — Lists and Sentences as Global Navigation Items

**Date:** 2026-04-20
**Status:** Accepted

---

## Context

The original design put Lists, Sentences, and First Thens as **modes within each category** — tabs alongside Board on the Category Detail screen. This made sense as an initial mental model (a category is the container for everything), but revealed a UX problem during Phase 3.2 development:

**The in-the-moment problem.** When a student needs a list or sentence, they must remember which category it lives in before they can access it. AAC users often operate under cognitive load, fatigue, or time pressure. Requiring navigation through the category screen to find a list adds friction at exactly the wrong moment.

**The cross-category content problem.** In practice, lists and sentences naturally span categories. A "Morning Routine" list might include symbols from Clothing, Food, Daily Activities, and Emotions. Forcing content into a single category either duplicates symbols across categories or creates arbitrary category assignments. Neither is clean.

**First Thens are a display mode, not a content type.** A First/Then schedule is structurally identical to a list — it is an ordered set of images with a particular visual presentation. Storing it as a separate table (`profileFirstThens`) with its own schema, Convex functions, UI routes, and nav entries is overhead that does not serve the user.

---

## Decision

### 1. Lists and Sentences become top-level navigation items

```
Home  |  Search  |  Categories  |  Lists  |  Sentences  |  Settings
```

Each is independently visible or hidden per student profile via stateFlags. Categories, Lists, and Sentences can each be shown or hidden so the student's nav is focused on what they actually use.

### 2. Categories show Board mode only

The Category Detail page removes the mode switcher entirely. It always shows the Board — the symbol grid. The talker header remains. Edit mode remains. No tabs.

### 3. Lists and Sentences are profile-level, not category-level

`profileLists` and `profileSentences` belong to a `profileId` directly. No `profileCategoryId` foreign key. Content can span categories freely.

### 4. List and Sentence items are self-contained

Items store their own `imagePath` (R2 path) and other fields directly. They do **not** reference `profileSymbolId`. This makes lists independently deletable — deleting a list cleans up its own R2 assets without affecting the category board.

| Table | Item shape |
|---|---|
| `profileLists.items` | `{ order, imagePath?, description? }` |
| `profileSentences.items` | `{ order, imagePath? }` — image only, no per-item text or voice |

Sentence audio is at the sentence level (whole-sentence TTS), not per-item.

### 5. First Thens are deprecated as a separate content type

`profileFirstThens` is removed from the schema entirely. No data existed in this table.

**First Then becomes a display toggle on Lists** — `showFirstThen: boolean`. When active, the first item is labelled "First" and all subsequent items are labelled "Then". This toggle is independent and additive alongside `showNumbers` and `showChecklist`. All three can be active simultaneously.

### 6. The symbol picker reuses the existing SymbolEditorModal

When adding an image to a list or sentence item, the existing `SymbolEditorModal` is opened in a list/sentence context. No separate picker modal is needed.

**Image sources and storage:**

| Source | What happens |
|---|---|
| **SymbolStix** | `imagePath` from the `symbols` table is stored directly in the list/sentence item. No R2 copy — the library file is reused as-is. |
| **Google Images** | Downloaded server-side, uploaded to R2 under the profile path, R2 path stored in the item. |
| **AI Generation** | Generated server-side, uploaded to R2 under the profile path, R2 path stored in the item. |
| **User Upload** | Uploaded to R2 under the profile path, R2 path stored in the item. |

There is no "My Categories" tab. Browsing a category board to copy a symbol path is not part of the picker flow.

When saving in **list or sentence context**, the modal stores only `imagePath` into the list/sentence item — no `profileSymbol` record is created. The save button label reflects the destination ("Save to list" / "Save to sentence").

When saving in **category board context**, the existing flow applies: creates/updates a `profileSymbol` with full label, audio, and display customisation.

---

## Consequences

### Schema

- `profileLists`: remove `profileCategoryId`; items become `{ order, imagePath?, description? }`; add `showFirstThen: v.optional(v.boolean())`; add `showNumbers`, `showChecklist`, `displayFormat` (already added in Phase 3.2 work)
- `profileSentences`: remove `profileCategoryId`; items become `{ order, imagePath? }`
- `profileFirstThens`: deleted from schema
- `studentProfiles.stateFlags`: remove `first_thens_visible`; `lists_visible` and `sentences_visible` now control sidebar nav item visibility rather than category mode tab visibility
- `profileLists` indexes: `by_profile_id` + `by_profile_id_and_order` (no `by_profile_category_id`)

### Navigation

- Sidebar gains **Lists** and **Sentences** nav items
- TopBar mobile nav gains the same
- `nav.lists` and `nav.sentences` added to i18n messages

### Category Detail

- `ModeSwitcher` component removed from `CategoryDetailContent`
- `topBarExtras.modeSwitcher` removed from `BreadcrumbContext`
- `ListsModeContent`, `FirstThensModeContent` references removed from `CategoryDetailContent`

### Build plan updates

- Phase 3.3 (Category Detail four modes) revised to Board-only
- Phase 3.5 (Lists, Sentences, First Thens as category modes) replaced by new Phase 3.5 (Global Lists) and Phase 3.6 (Global Sentences)

### What is NOT affected

- Category board (Board mode) — unchanged
- Symbol editor for category boards — unchanged  
- `profileSymbols` table — unchanged
- Category colour system — unchanged
- Resource library packs — `librarySourceId` pattern unchanged; pack loading will need to create profile-level lists/sentences rather than category-level
- Modelling mode — unchanged
