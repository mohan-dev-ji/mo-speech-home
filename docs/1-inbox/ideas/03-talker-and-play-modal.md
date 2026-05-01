# Talker Header and Play Modal

> **Architecture note:** See ADR-004 for the decision to make the talker persistent and global.

## The Talker Bar

The talker bar renders in the **app layout shell** above all pages. It is not owned by any individual page. The sentence buffer (`talkerSymbols`) lives in `TalkerContext` and survives navigation — the student can tap symbols across category boards, the search page, and the categories list without losing their sentence.

The talker is visible on **every app page** when `stateFlags.talker_visible` is ON.

---

## Toggle Hierarchy

Two controls in QuickSettings govern the talker:

| Toggle | Flag | What it does |
|---|---|---|
| **Header on/off** | `talker_visible` | Master switch — hides the entire talker bar. When OFF the bar is not rendered on any page. |
| **Talker / Banner mode** | stored on TalkerContext | Sub-mode for the visible header. Only active in QuickSettings when Header is ON. |

The in-header pill toggle is removed. Mode switching is done exclusively via QuickSettings. This keeps the toggle hierarchy explicit and centrally managed.

---

## Talker Mode

Tapping a symbol adds it to the talker bar as a sequence of symbol thumbnails.

Controls in talker mode:
- **Play button** — sends the full sequence to the Play Modal
- **Clear button** — empties the bar
- **Individual symbol tap** — removes that symbol from the sequence

The talker bar is the equivalent of Proloquo2Go's message box. It is the sentence builder.

---

## Banner Mode

In banner mode the talker bar is still visible but the sentence buffer is bypassed. Tapping a symbol plays its audio immediately. There is no sequence building.

Banner mode turns the app into a simple symbol-tap interface — useful for direct, single-word communication without the complexity of sentence building.

---

## Switching Between Modes

Mode is changed via QuickSettings (not via an in-header pill toggle).

If `talker_banner_toggle` is OFF (set by instructor), the mode toggle row is hidden in QuickSettings and the app stays in whichever mode the instructor has set. The student cannot change it.

---

## Category Page Header

The category name, colour, and folder image are displayed in a thin `CategoryPageHeader` component that lives at the top of the category detail board — separate from the talker bar. Edit mode (BannerEdit) is triggered from there, not from the talker.

---

## Header Component

`app/components/app/shared/ui/Header.tsx` is a pure talker display. It no longer accepts category-specific props (`categoryName`, `categoryImagePath`, `categoryColour`, `onEditCategory`, `showToggle`, `mode`, `onToggleMode`). It renders the `TalkerBar`, the action button column, and the `TalkerDropdown`.

---

## Play Modal

Triggered from:
- The play button in the talker bar (plays the current sequence)
- A board in banner state (plays a single symbol or a list)
- Any list or sentence in a category

### What it does

Plays symbols one at a time, enlarged with audio. The full sequence is shown as a thumbnail strip at the bottom for visual context — the student always knows where they are in the sequence.

After the final symbol plays, a repeat button appears. Tapping it replays the sequence from the start.

### Audio in Play Modal

Each symbol plays its resolved audio in priority order:
1. User recording (if set on the profileSymbol)
2. TTS override (if set)
3. Alternative R2 word (if set)
4. Default SymbolStix pre-generated audio (fallback)

For sentences, the Play Modal plays the full sentence as a single natural voice audio clip (Google Chirp 3 HD) rather than symbol by symbol.

### Dismissing

Tapping the close button or swiping down returns to the originating screen with state preserved.

---

## Core Vocabulary Dropdown

### The Problem It Solves

Most AAC boards repeat core words — "I", "want", "the", "and", "is", "not", "like", "go" — across every single category. This wastes valuable grid space in every board and creates visual noise. These words don't belong to any specific category; they belong to every sentence.

The core vocabulary dropdown solves this by pulling these words out of the category boards entirely and making them permanently accessible from the talker header, regardless of which category or screen the student is on.

---

### What It Is

A dropdown panel that opens from the talker header. It displays a smaller version of the symbol card grid — the same visual treatment as the board but more compact, overlaying the current screen without navigating away from it.

The dropdown has three tabs, switchable within the panel:

| Tab | Content |
|---|---|
| **Core Words** | The most common AAC vocabulary — pronouns, verbs, descriptors, prepositions (200–400 words covering ~75–80% of daily AAC use) |
| **Numbers** | 0–9 plus common number words |
| **Letters** | A–Z for spelling |

This solves the navigation problem for three sets of content that don't belong to any specific category but need to be reachable from anywhere in the app.

---

### Behaviour

Tapping a word in the dropdown follows the current talker state:
- **Talker state** — word is added to the talker bar sequence
- **Banner state** — word plays its audio immediately

The dropdown closes after a tap, or can be dismissed by tapping outside it.

---

### Why This Matters for Board Design

With core words accessible via the dropdown, category boards can focus entirely on topic-specific vocabulary. A Food category contains only food symbols. A Feelings category contains only feeling symbols. The boards become cleaner, more focused, and easier for the student to navigate — because the words needed to build sentences around those topics live in the dropdown, not scattered across every board.

---

### Data Model

The core word, number, and letter sets are sourced from the SymbolStix library — they are `symbols` records, not custom content. The sets are defined in the resource library or as a fixed seed in the codebase, and are shared across all profiles. They do not live in `profileSymbols` — they are read directly from the `symbols` table using the `priority` field (1–500 for core vocabulary).

Numbers and letters are a fixed set — no customisation needed. Core words can be extended or reordered by the instructor in a future version, but in V1 the set is the Mo Speech default core vocabulary list.

The dropdown does not require any new Convex tables. It reads from the existing `symbols` table filtered by `priority` (core words) or by a fixed symbol ID list (numbers, letters).

---

### State Flag

A `core_dropdown_visible` state flag (defaulting ON) allows the instructor to hide the dropdown from the student's view if it is not appropriate for their current stage of AAC development.

Add to `childProfile.stateFlags`:
```typescript
core_dropdown_visible: boolean   // default: true
```
