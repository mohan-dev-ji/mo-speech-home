# Talker Header and Play Modal

## The Header Component

A single shared component used in two places — the Search page and Category Board mode. It behaves differently in each context.

| Context | Hideable | Banner toggle | Notes |
|---|---|---|---|
| Search page | Yes | No — talker only | Always talker state; no toggle |
| Category / Board | Yes | Yes — if permission ON | Full toggle between talker and banner |

The component is always present in both contexts but can be hidden via the `talker_visible` state flag.

---

## Talker State

Tapping a symbol adds it to the talker bar as a sequence of symbol thumbnails. The bar grows horizontally as symbols are added.

Controls in talker state:
- **Play button** — sends the full sequence to the Play Modal
- **Clear button** — empties the bar
- **Individual symbol tap** — removes that symbol from the sequence

The talker bar is the equivalent of Proloquo2Go's message box. It is the sentence builder.

---

## Banner State

In banner state the talker bar is hidden. Tapping a symbol plays its audio immediately and briefly enlarges the symbol card. There is no sequence building.

Banner state turns the board into a simple symbol-tap interface — useful for direct, single-word communication without the complexity of sentence building.

---

## Switching Between States

A toggle control in the header switches between talker and banner. This toggle is only visible in Category/Board mode — not on the Search page.

If `talker_banner_toggle` is OFF (set by instructor), the toggle is hidden and the board stays in whichever state the instructor has set as default. The student cannot change it.

### Toggle UI Spec

The header card has a fixed button column on the right (same structure in both states — height never changes on toggle):

| Slot | Talker state | Banner state |
|---|---|---|
| 1 (top) | `Zap` icon → switches to banner | `AlignLeft` icon → switches back to talker |
| 2 | Play (green) | Invisible — occupies space |
| 3 | Clear (red) | Invisible — occupies space |
| 4 | Save (blue) | Invisible — occupies space |

The toggle button uses a muted semi-transparent background to distinguish it visually from the action buttons. The `Zap` icon is amber to signal "direct/fast"; the `AlignLeft` icon is white/neutral to signal "return to builder".

The left content area switches between `TalkerBar` (sentence chips) and `Banner` (direct-play indicator). Both use `min-h-[160px]` so the card height is identical in both states — no layout jump on toggle.

The `Banner` component displays:
- Amber `Zap` icon in a rounded container
- "Direct Play" title
- "Tap any symbol to hear it" subtitle

The `Header` component (`app/components/shared/Header.tsx`) is the single entry point — it wraps `TalkerBar`, `Banner`, the button column, and `TalkerDropdown`. Pass `showToggle={false}` (or omit) for Search page to disable the toggle entirely.

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
