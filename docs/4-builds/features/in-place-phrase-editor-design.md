# In-Place Phrase Editor (sentence snapshots) — Design Spec

> **Status:** Approved design (brainstormed 2026-07-04). Next step: turn into an implementation plan via the writing-plans skill. Builds on the shipped "Block-Aware Play Modal & Unit-Based Sentences" work (see `block-play-modal-and-unit-sentences.md`).

## Goal

Let an instructor **edit a phrase in place** while editing a talker-saved ("sequence") sentence — change its words, name, and audio — using the **same phrase builder** the talker dropbar uses. Edits are **local to that one sentence's snapshot**; the phrase bank and every other sentence are untouched (ADR-015: sentence phrases are frozen snapshots of the bank).

## Background / why this is safe

A phrase inside a sentence lives in `profileSentences.units[]` as a self-contained snapshot:
`{ kind:'phrase', order, name:{..}, audioPath?, recordedAudioPath?, librarySourceId?, words:[{order, imagePath?, audioPath?, label?, displayProps?}] }` (schema.ts `compositionUnit`). It is **not** a live reference to `profilePhrases` (the bank). So editing it in place is just editing this sentence's own copy and re-saving via `updateProfileSentenceUnits` — no bank mutation, no cross-sentence propagation. This keeps ADR-015's "snapshots are frozen from the bank" intact while allowing the snapshot itself to be edited.

A phrase plays as **one clip** in the block modal (`audioKey = recordedAudioPath ?? audioPath`, else TTS of the name). Per-word audio inside a phrase is never used in playback — which is why the existing bank phrase-word editor is image-only (`sentenceSlot` mode). The snapshot editor matches this.

## Grounding — read these first (no re-exploration needed)

- `app/components/app/shared/ui/TalkerDropdown.tsx` — the **source** of the phrase builder:
  - `PhraseEditCard` (~line 910): presentational, callback-driven (`onRename/onWordAdd/onWordEdit/onWordDelete/onAudio/onDelete`), wraps a sortable card (delete + drag-reorder) around the inner builder. `WordChip` (local) renders each word tile with edit + delete.
  - Inner builder block (~970–1023): word-chip row + add-word button + name `<input>` + audio button (`Volume2`/`Mic`) + incomplete warning. **This is what gets extracted.**
  - Word editor wiring (~685–701): `SymbolEditorModal` `editorMode="sentenceSlot"` (image-only) → `handlePhraseWordSave` (preserves label on edit, `label: undefined` on add).
  - Phrase audio wiring (~703–724): `SentenceAudioModal` with `sentenceId={null}` + `saveOverride({ text, recordedAudioPath })` — already decoupled from any specific sentence. Reusable verbatim with a snapshot-local override.
- `app/components/app/sentences/sections/SentencesModeContent.tsx` — the **host**:
  - `UnitStrip` / `SortableUnitBlock` — block-level sentence editor. A phrase block's `onTap` currently calls `onPlayBlock` (tap-to-play in edit mode). This becomes tap-to-edit.
  - `unitsOf` / `persistUnits` (reindex + `updateProfileSentenceUnits`) — reuse for the phrase-save write.
  - `CompositionUnitClient` (from `composition/blocks.ts`) — the client unit type.
- `app/components/app/shared/ui/composition/CompositionBlock.tsx` — phrase block visual (zinc box). Unchanged.
- `convex/profileSentences.ts` — `updateProfileSentenceUnits` (already shipped) patches `units` + regenerates flat `slots`. **No backend changes needed.**
- `convex/schema.ts` — `compositionUnit` / `compositionWord` validators (the snapshot shape).

## Scope decisions (locked)

- **Edit scope:** local to the sentence snapshot only. No bank write, no cross-sentence propagation.
- **Capabilities:** the phrase builder "as is" — add / remove / edit words (image + preserved label), rename the phrase, set phrase audio (record or TTS-of-name). No word **reordering** inside a phrase (the builder doesn't do it today).
- **Tap behaviour:** in sentence **edit mode**, tapping a phrase block **opens the editor** (replacing tap-to-play — consistent with word blocks tapping to edit). Play now lives on the editor's audio button.
- **Min words:** **block Save when the phrase has < 2 words** (mirrors the builder's own rule; a 1-word phrase should be a word). Show the "needs 2 symbols" warning and disable Save.
- **Backend:** none. Reuses `updateProfileSentenceUnits`.

## Components

### `PhraseBuilderBody` (new, shared, presentational)
- Location: `app/components/app/shared/ui/composition/PhraseBuilderBody.tsx` (co-located with the other composition UI). `WordChip` extracted alongside (same file or a sibling).
- Props: `{ name: string; words: { imagePath?: string; label: string }[]; hasAudio: boolean; incomplete: boolean; incompleteLabel; audioReadyLabel; audioGenerateLabel; renameLabel; addLabel; removeLabel; onRename(value); onWordAdd(); onWordEdit(index); onWordDelete(index); onAudio(); }`.
- Renders exactly the inner builder block from `PhraseEditCard` (word chips + add button + name input + audio button + incomplete warning). No sortable wrapper, no delete/move — those are card-only.
- **What it does:** render an editable phrase (words + name + audio affordance). **How to use it:** feed it a phrase's display data + callbacks. **Depends on:** `WordChip`, theme tokens, lucide icons — nothing data-layer.

### `PhraseEditCard` (refactored, dropbar — no behaviour change)
- Now renders `<PhraseBuilderBody …/>` inside its existing sortable card, keeping the below-card delete + drag-reorder controls. Pure extraction: the dropbar's phrase editing must behave identically after.

### `PhraseUnitEditorModal` (new)
- Location: `app/components/app/sentences/modals/PhraseUnitEditorModal.tsx`.
- Props: `{ isOpen: boolean; unit: <phrase CompositionUnitClient>; language: string; accountId: Id<'users'>; voiceId: string; onSave(updatedUnit): void; onClose(): void }`.
- **Local state** seeded from `unit`: `name` record, `words` array (`{order, imagePath?, audioPath?, label?, displayProps?}`), `audioPath?`, `recordedAudioPath?`, and preserved `librarySourceId?` / `order`.
- Renders `PhraseBuilderBody` (mapping local words → `{imagePath, label}` via `displayString`) + a **Save / Cancel** footer. Save disabled while `words.length < 2`.
- **Hosts its own sub-editors** (same components the dropbar uses):
  - `SymbolEditorModal` `editorMode="sentenceSlot"` for add/edit word → mutate local `words` (mirror `handlePhraseWordSave`: append `{order,imagePath,label:undefined,displayProps}`; on edit preserve existing label, swap `imagePath`/`displayProps`; reindex `order`).
  - `SentenceAudioModal` `sentenceId={null}` + `saveOverride({ text, recordedAudioPath })` → mutate local `name` (set `{...name,[language]:text}`) and `recordedAudioPath`. **Name/audio nuance:** if `text` changed the name AND no new `recordedAudioPath`, **clear local `audioPath`** so playback TTS-resolves the new name instead of speaking a stale clip. A new recording always wins.
- **Save:** build the updated phrase unit from local state (`kind:'phrase'`, same `order`, `name`, `audioPath?`, `recordedAudioPath?`, `librarySourceId?`, reindexed `words`) and call `onSave(updatedUnit)`. **Cancel/backdrop:** discard.

## Data flow

1. `SentencesModeContent` adds state `phraseEditTarget: { sentenceId: Id<'profileSentences'>; unitIndex: number } | null`.
2. `UnitStrip` gains `onEditPhrase(sentenceId, unitIndex)`; `SortableUnitBlock`'s `onTap` routes a **phrase** block to `onEditPhrase` (word blocks still `onEditWord`; `onPlayBlock` is dropped from the edit strip).
3. `onEditPhrase` → `setPhraseEditTarget({ sentenceId, unitIndex })`.
4. Render `PhraseUnitEditorModal` seeded from `units[unitIndex]` (guard: it is a phrase unit).
5. `onSave(updatedUnit)` → replace `units[unitIndex]` with `updatedUnit` → `persistUnits(sentenceId, units)` (`updateProfileSentenceUnits`, reindexes order + refreshes `slots`). Local-only.
6. `onClose` → `setPhraseEditTarget(null)`.

## i18n (en.json only)

Reuse existing `talker.*` phrase keys where they fit (`phraseAddSymbol`, `phraseRemoveSymbol`, `phraseRename`, `phraseNeedsTwo`, `phraseAudioReady`, `phraseAudioGenerate`, `phraseEditTitle`, `phraseFieldLabel`). Add under `sentences` only what's missing: a modal title (e.g. `phraseEditorTitle` = "Edit phrase"), `save`, `cancel` if not already present. New keys → `messages/en.json` only.

## Verification

- **tsc:** `npx tsc --noEmit` clean (ignore `lib/stripe.ts`); no convex change so `convex/tsconfig.json` unaffected. `curl /en/sentences` → 307.
- **Dropbar regression:** the talker Phrases tab edit mode still adds/removes/edits words, renames, and sets audio exactly as before (pure extraction).
- **Manual:** edit a talker-saved sentence → tap a phrase block → editor opens with its words/name/audio → add a word, rename, record/generate audio, remove a word → Save blocked at 1 word, allowed at 2+ → Save; reopen the sentence, confirm the phrase changed **only here** (bank + other sentences unchanged) and Play still steps it as one block with the new audio.

## Out of scope

- Word reordering inside a phrase (builder doesn't do it).
- Writing edits back to the bank phrase / other sentences.
- Per-word audio inside a phrase (unused in playback).
- Any backend/schema change.
