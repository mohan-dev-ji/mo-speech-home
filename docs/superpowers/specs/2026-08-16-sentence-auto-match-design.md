# Auto-match symbols in the create-sentence modal — design

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-16
**Context:** MOS-13 (Phase 4 · rebuild defaults for marketing) — re-making the default sentences.
**Precedent:** phase-17 auto-match (categories + core-word lists) — `docs/4-builds/plans/_done/phase-17-auto-match-symbols-SPEC.md`

---

## 1. Problem

Creating a default sentence today is: type the sentence, create, then tap **+** and hand-pick a
symbol for every single word through the symbol editor. For a bulk authoring run that is the slowest
surface in the app.

Lists solved the same problem in phase-17: the create modal grew per-row auto-match checkboxes, and
authoring went from minutes to seconds. Sentences never got the equivalent.

## 2. Decision

**One "Auto-match" checkbox to the right of the sentence-name input.** When ticked, submitting splits
the typed sentence into words, takes each word's top symbol-search hit, and creates the sentence with
those images already in its slot strip, in word order.

The typed name is never rewritten. It stays the sentence text and the TTS source; auto-match only
fills the image strip.

### 2.1 What gets filled — image-only slots

Sentences created from this modal are **fluent**: the edit-mode strip is `profileSentences.slots[]`,
which are **image-only** tiles (`{ order, imagePath?, displayProps? }` — no per-slot label, no
per-slot audio). Playback is one whole-utterance TTS clip; the images are decoration.

Auto-match therefore writes `slots[]` and nothing else. It does **not** build `units[]` word blocks
(the talker-saved `playback: "sequence"` shape) — that would change what the create button produces
and how every created sentence plays.

Consequence: **no TTS leg.** The category flow resolves a per-symbol clip when the typed word diverges
from the symbol's own word (phase-16 audio-follows-label). A fluent sentence speaks the whole
utterance, so there is nothing per-slot to voice. This is the part of the category flow sentences
genuinely don't need, and the types say so.

### 2.2 Tokenisation

- Split on whitespace.
- Strip leading/trailing punctuation per token (`"home."` → `home`).
- Drop tokens that reduce to nothing.
- Keep contractions and hyphens intact — `don't` and `sit-down` are searched as typed.
- One slot per surviving token, in order. Cap at **30** slots.

### 2.3 Unmatched words → blank slot, not skipped

A word with no search hit still gets a slot, with no `imagePath` — the existing blank grey tile.

This keeps **one tile per word**, so tile positions line up with the sentence text and the instructor
taps the blank to fill it. Skipping unmatched words would desync tile count from word count and force
manual add-then-drag. The cost is that a blank tile carries no label (fluent slots have no label
field), so you infer the word from its position — acceptable, since position is exactly what's
preserved.

### 2.4 Scope: sentences only, not phrases

The talker dropbar reuses `CreateSentenceModal` for **Create Phrase**, which writes
`profilePhrases.words[]` — a different shape (`label` + `imagePath` + `audioPath` per word). Filling
that well needs its own decisions about per-word audio.

Auto-match is therefore **opt-in via a prop**, default off. The phrase host passes nothing and is
byte-for-byte unchanged.

### 2.5 Default state: unchecked

The box opens unticked, matching the list modal's per-row boxes, and `reset()` clears it alongside
the name. Unticked create is byte-for-byte today's behaviour (`slots: []`), so nobody who ignores the
checkbox sees a change.

## 3. UX

```
┌─ New sentence ───────────────────────────────┐
│ Sentence                                     │
│ ┌──────────────────────────────┐  Auto-match │
│ │ I want to go home            │      [x]    │
│ └──────────────────────────────┘             │
│                                              │
│   [ Cancel ]          [ Auto-matching… ]     │
└──────────────────────────────────────────────┘
```

- Checkbox styling matches `SymbolListFields`' select-all header: 24px box,
  `accent-[var(--theme-brand-primary)]`, `text-theme-xs` secondary-colour label.
- Dialog widens `max-w-sm` → `max-w-md` so the input isn't squeezed. (`CreateListModal` is already
  `max-w-md`.)
- On submit with the box ticked, the button shows the "Auto-matching…" copy while the search pass
  runs, then **one** `createProfileSentence` call carries the matched slots — block-then-create, the
  same shape as `useCreateCategory`, so the sentence never exists in a half-filled state.
- The new sentence lands in edit mode (existing `setIsEditing(true)`) with its tiles already there.

**Latency is visible by design.** A 6-word sentence is 6 parallel round-trips — fast, but the button
sits on "Auto-matching…" for a beat. That is the trade for creating in one shot rather than
creating-then-filling.

**No undo.** Auto-match writes on create; a bad row is fixed by deleting slots in edit mode, same as
lists. A preview step would cost more than it saves for an authoring run where every sentence is
reviewed anyway.

## 4. Code shape

The auto-match machinery stops being category-specific once sentences use it, so the shared half
moves to a neutral home. Total churn: two file moves and three import lines.

### 4.1 Moved (not rewritten)

| From | To | Note |
|---|---|---|
| `lib/categories/autoMatchSymbols.ts` (types) | `lib/symbols/autoMatchDeps.ts` (new) | `SearchHit` + `AutoMatchDeps` move out; `buildCreateSymbols` stays put (category-only) |
| `app/lib/categories/useAutoMatchDeps.ts` | `app/lib/symbols/useAutoMatchDeps.ts` | |

`SearchHit` gains `imagePath: string` — always present on a symbol row (`symbols.imagePath` is
`v.string()`), and `useAutoMatchDeps` now returns it. The category path ignores the extra field.

Importers to update: `useCreateCategory.ts`, `useAddSymbolsToCategory.ts`, and the hook itself.

### 4.2 New — `lib/sentences/autoMatchSlots.ts`

Pure: no React, no Convex, injected search. Mirrors why `buildCreateSymbols` is testable.

```ts
export type SlotSpec = { order: number; imagePath?: string };

export function splitSentenceWords(text: string, max?: number): string[];

export async function buildSentenceSlots(
  text: string,
  language: string,
  deps: Pick<AutoMatchDeps, 'search'>,
): Promise<SlotSpec[]>;
```

`Pick<…, 'search'>` is deliberate — see §2.1, there is no `resolveTts` leg.

### 4.3 Changed

- **`app/components/app/sentences/modals/CreateSentenceModal.tsx`** — new `showAutoMatch?: boolean`
  prop (default `false`); checkbox state reset by `reset()`; `onCreate` becomes
  `(name: string, autoMatch: boolean) => Promise<void>`.
- **`app/components/app/sentences/sections/SentencesModeContent.tsx`** — `handleCreate(name, autoMatch)`
  awaits `buildSentenceSlots(name, language, deps)` when ticked and passes `slots` into the existing
  `createSentence` call. Passes `showAutoMatch`.
- **`app/components/app/shared/ui/TalkerDropdown.tsx`** — untouched behaviourally; doesn't pass
  `showAutoMatch`, and `handleCreatePhrase` ignores the second arg.
- **`messages/en.json`** — `sentences.createModalAutoMatch`, `sentences.createModalAutoMatchAria`,
  `sentences.createModalAutoMatching`. **en.json only** (per CLAUDE.md rule 1).

No schema change, no Convex change: `createProfileSentence` already accepts `slots[]`, and
`displayProps` on a slot is optional, so `{ order, imagePath }` validates as-is.

### 4.4 Data flow

```
typed name
  → splitSentenceWords()
  → Promise.all( deps.search(word, language) )      // api.symbols.searchSymbols, limit 1, per word
  → SlotSpec[]  ({ order, imagePath? })
  → createProfileSentence({ name, authoredLanguage, folderId?, slots })
  → setIsEditing(true)
```

Searches fan out in parallel, one query per word at `limit: 1` — the same call the list path makes,
so the "first search-page result" guarantee comes from the same exact-whole-word-boost code in
`convex/symbols.ts:searchSymbols` that the search page ranks with.

**Language:** words are searched in the current **board** `language`, which is also the
`authoredLanguage` stamped on the sentence — consistent with what `handleCreate` already does.

## 5. Edge cases

| Case | Behaviour |
|---|---|
| Checkbox unticked | `slots: []` — today's behaviour, no search calls |
| Empty / punctuation-only name | Submit already blocked on `!name.trim()`; if every token strips to nothing, create with `slots: []` |
| Word has no hit | `{ order: i }` with no `imagePath` → blank tile at that position |
| One search throws (network) | Each search is caught individually → that slot is blank, the rest still fill |
| All searches fail | Sentence still created, all slots blank — never a failed create |
| More than 30 words | First 30 get slots; the name keeps every word, extra words are un-tiled |
| Re-opening the modal | `reset()` clears the checkbox alongside the name |
| Double-submit | Existing `isCreating` guard wraps the whole `onCreate`, so it covers the search pass |

## 6. Verification

**This repo has no test runner** — no vitest/jest, no `.test.ts` files, no test script. Phase-17
states it outright: *"No test runner exists… Do not add a test runner."* The gate is therefore the
phase-17 gate, and the pure module's edge cases are verified through the real UI rather than in
isolation.

**Per task:** `npx tsc --noEmit -p tsconfig.json` filtered to the touched files, then
`npx eslint <files>`.

**Browser** — signed-in Chrome on the running dev server (`:3000`), Sentences page. Each row is one
typed sentence and the strip it produces:

| Typed into the modal | Expected strip |
|---|---|
| `I want to go home` (ticked) | 5 tiles, word order, edit mode opens |
| `I want to go home.` | Same 5 tiles — trailing `.` stripped, no 6th tile |
| `don't sit-down now` | 3 tiles — contraction and hyphen searched intact |
| A sentence with a made-up word | A blank tile at that word's position, siblings filled |
| A 35-word sentence | 30 tiles; the name keeps all 35 words |
| `I want to go home` (unticked) | No tiles — today's behaviour |
| Talker dropbar → Create Phrase | No checkbox in the modal at all |

**Regressions to re-check** (the file moves touch live category paths): create a category with
auto-match ticked, and add a list to core words with auto-match ticked. Both must still fill symbols
and audio exactly as before.

## 7. Out of scope

- Auto-matching phrase `words[]` (§2.4)
- Building `units[]` word blocks from the modal (§2.1)
- Any preview / confirm step before the write (§3)
- Persisting the checkbox state across sessions
