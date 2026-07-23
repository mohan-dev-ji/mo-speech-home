# Language Variant Lifecycle (board-true editing) — Design Spec

- **Date:** 2026-07-18
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Supersedes:** [`docs/4-builds/plans/_done/phase-15.6-revert-translation.md`](../../4-builds/plans/_done/phase-15.6-revert-translation.md) and [`docs/superpowers/specs/2026-07-16-revert-translation-design.md`](2026-07-16-revert-translation-design.md) — Revert becomes Stage 3 of this larger model.
- **Relates to:** ADR-016 (composed-content language variants) Addenda A–G; ADR-009 (localised records); Phase 15 (voice-follows-text); Phase 15.5 (live-translation badge).

---

## Context of discovery

Phase 15.5 shipped the "Made in `<lang>`" badge + on-demand translation for order-free
labels and composed-content variants. Acceptance testing (owner, HI/ES boards) then
uncovered a chain of issues that turned out to share **one root cause**:

1. **Revert pushback.** With no way back from a translation, the owner questioned whether
   Revert was worth building — until we found translation is a genuine one-way door.
2. **Voice is not uniform.** Talker / fluent sentences re-resolve voice per text
   (`voiceForLanguage(resolvedLocale(...))`); **list items always use the board voice**;
   **block sentences are internally inconsistent** — single-symbol (word) blocks speak the
   Hindi translation while phrase blocks speak English in a Hindi accent.
3. **Cross-board editing footgun.** Editing a fluent sentence's English on a Hindi board
   *also changes the English board* — because with no Hindi variant yet, you're editing the
   shared **source row**.
4. **Delete is ambiguous & permanent.** The single delete button removes whichever collapsed
   row is showing (a variant *or* the source), silently orphaning the group; hand-authored
   arrangements are lost forever.

**Root cause (all four):** *editing an item that is showing the origin as a fallback, on a
non-origin board, writes the edit under the board's language — mislabeling the content.*
- Phrases/blocks: `InlinePhraseEditor` keys `name: {...unit.name, [language]: v}` → English
  typed on a Hindi board lands under `hi` → Hindi voice speaks English.
- Fluent: `updateProfileSentenceAudio` writes `text` as a plain **string**, collapsing the
  record → every board changes.
- Labels: 15.5 merges under `[language]` → same mis-key risk.

The owner reframed the "English-in-a-Hindi-accent" behaviour as a **feature** (a localised
accent that helps bilingual learners), and landed on a single coherent model: **editing is
always true to the board, and Revert is the clean way back.** This spec is that model.

## Problem

Editing localised content on a non-origin board mislabels the content's language, which
simultaneously (a) corrupts the language→voice mapping, (b) mutates the shared origin across
boards, and (c) leaves no clean way to undo. Delete conflates "this language" with "the whole
item."

## Goal

A single **board-true** lifecycle for every localised item: forking a board version happens
automatically on edit, each version speaks in its own board's voice, Revert cleanly removes a
board version, and Delete unambiguously removes the whole item — reusing the existing variant
structures, with no data migration.

## Owner decisions (locked in brainstorm)

1. **Edit rule:** *always fork to the board.* Editing on a non-origin board creates/edits a
   board-language version, seeded from origin; the origin is edited only on its own board.
2. **Voice model:** *board-accent.* A forked item speaks in its board's voice; an un-forked
   origin fallback speaks in the origin voice + shows "Made in". Composed-content blocks all
   follow the variant's one language.
3. **Delete vs Revert:** Revert = remove **this board's** version → origin returns. Delete =
   remove the **whole item across all languages**.
4. **Delete safety:** permanent, gated behind an explicit "removes on every board, can't be
   undone" confirm. No trash/undo infrastructure.
5. **Existing data:** no migration — read-compatible; new edits write the correct shape.

---

## Design

### 1. Two states, three transitions

Every localised item, on a given board, is in exactly one state:

| State | Shows | Voice | Affordance |
|---|---|---|---|
| **Origin fallback** (no board version) | origin text | origin voice | view-mode "Made in `<origin>`" → translate/fork |
| **Board version** (forked) | board text | **board voice/accent** | edit-mode "Revert to `<origin>`" |

Transitions: **Fork** (origin → board version, via translate or first edit), **Revert** (board
version → origin fallback), **Delete** (either → removed on every board).

### 2. fork-on-edit (per data model)

Fork uses the **existing** variant machinery — no new structure:

- **Composed content** (sentences / phrases): the first content edit — text, symbol swap,
  reorder, or (re)record — on a non-origin board where the collapsed row is **not** already a
  board variant calls `createSentenceVariant` / `createPhraseVariant(source, board)` (which
  seeds a sibling row from the source arrangement and links the variant group), then applies
  the edit to the **fork**. Subsequent edits target the fork. The source is never mutated from
  another board.
- **Labels** (list items/titles, folder/category names): editing writes the **board key** into
  the localised record (the "fork" is adding that key). A fluent sentence's legacy string
  `text` is converted to a record on first fork.
- **Origin board:** editing edits the origin in place (its home board). "Origin" = the source
  row for composed content; `originLocale(record)` (DEFAULT_LOCALE-privileged, else first key)
  for labels.

**Because fork reuses the existing structure, a forked variant is indistinguishable from an
existing default/translated variant** — the same code paths render, play, revert, and delete
both.

#### 2a. Word-unit save-path defects (folded into Stage 2, found in testing)

Editing a **single-symbol (word) unit** of a talker-saved/sequence sentence exposed two
defects in the word-unit save path (`SentencesModeContent.handleUnitSave` → `SymbolEditorModal`
save; `PropertiesPanel.tsx:243`). Both are properly owned by the fork-on-edit work because they
live in the exact save path Stage 2 reworks:

1. **Word-unit keying — NOT a defect under board-accent (de-scoped, corrected 2026-07-18).**
   The word editor's field is internally `labelFieldLang = 'en'`, but the save always writes under
   the **board** key (`label: { [language]: value }`), and at fork time `[language]` IS the fork's
   `authoredLanguage`. So the stored key is always correct; the `'en'` is an internal field name
   with no effect on the stored language. Under board-accent, "type English on a Hindi board →
   stored as the Hindi variant's content, spoken in the Hindi accent" is the *intended* state, not
   a mis-key. **No change needed here.** (The genuine shape issue is on the FLUENT path, below.)
2. **Fluent text shape.** `updateProfileSentenceAudio` writes `text` as a **plain string**
   (`convex/profileSentences.ts:302`), inconsistent with the record shape variants use. When a
   fluent edit forks, the fork's `text` must be written as a **record keyed by the fork's
   `authoredLanguage`** (merge, not string-overwrite), so the variant model stays consistent.
3. **Audio invalidation on text change.** A word unit stores `label` and `audioPath` as
   independent fields; the save carries the **old clip forward verbatim**, and playback plays a
   trusted (`accounts/…`) clip verbatim (`recordingKey` → `CompositionPlayModal.playOne`),
   skipping TTS — so display shows the new text while audio plays the stale clip (e.g. shows
   "dinner", speaks "raat ko khana"). Phrases already invalidate on rename
   (`InlinePhraseEditor.tsx:96`); words have no equivalent. **Decision:** when a word-unit's text
   changes and no new audio was deliberately set, **drop the stale clip regardless of source
   (recording included)**. **Fallback:** playback then re-synthesizes the current text in the
   block's board-accent voice (`resolveTtsKey(label, voiceForLanguage(authoredLanguage))`) —
   graceful; only the mismatched waveform is lost. To keep a recording, re-record after editing.

4. **Composed words must speak their LITERAL text (bypass the SymbolStix default lookup) —
   SHIPPED & verified.** The deeper root cause of "shows dinner/breakfast, speaks the Hindi
   word": `/api/tts` does a SymbolStix lookup by the word and, for a known symbol, returns the
   symbol's **per-language default recording** (`resolveSymbolAudioPath`) — i.e. the canonical
   board-language word ("nashta"), not the authored text. Phrases never hit this (a multi-word
   name matches no single symbol → literal TTS → sounds right). **Fix:** composed-block playback
   passes `literal:true` (`resolveTtsKey` → `/api/tts`), which **skips the symbol-default branch**
   and synthesises the exact text in the board voice — so a word says what was typed, in the
   board accent, exactly like phrases. Route + client only (no Convex-function change), verified
   working live. **Perf follow-up:** the shared `ttsCache.lookup` still returns `symbolstix` for
   the word, so literal clips currently regenerate each play; add a `skipSymbolstix` arg to
   `ttsCache.lookup` when this merges to `main` (where convex dev deploys) so they cache.
   **Also applies to list items (retest, owner):** 1-word list descriptions (e.g. "breakfast")
   still resolve the symbol default via `ListItemPlayModal → playTts`. Extend the `literal` flag
   to `playTts` and pass `literal:true` from list playback (Stage 2 Task 5).

These are **independent of Stage 1** (which only changed block `locale`); they reproduce
pre-Stage-1 and are audio/route defects, not voice-selection.

### 3. Voice — board-accent (FINAL) + the block fix

**Voice model is board-accent — confirmed after hearing it.** (The owner considered native-voice
mid-testing, then reverted: `{ hi: "breakfast" }` should say "breakfast" **in the Hindi voice/
accent**, never translate to "nashta" and never switch to an English voice — matching how phrases
already sound. On a board of language L, the L voice is always used, *except* an un-translated
item that still falls back to the origin. This yields **seamless bilingual block sentences**.)


- Forked board variant → **board voice** (its `authoredLanguage`). Origin fallback → **origin
  voice** + badge. List items already use the board voice — **no change**.
- **Block-voice fix (retroactive):** composed-content block playback
  (`blocksFromUnits` + `CompositionPlayModal`) resolves the voice from the **collapsed row's
  single `authoredLanguage`** for *all* blocks, instead of each block's own `resolvedLocale`.
  This removes the word-vs-phrase split: every block in a Hindi variant speaks in the Hindi
  voice, regardless of which block texts were individually translated. The **live talker bar**
  (`blocksFromTalker`), which legitimately mixes languages, is unchanged.

### 4. Revert & Delete

- **Revert** — an icon in the item's **edit toolbar** (edit mode), on each item / variant,
  shown only when a board version exists over a survivable origin (labels: `canRevertLabel`;
  composed: the collapsed row is a non-source variant authored in the board language). Opens a
  confirm, then removes just this board's version:
  - labels → strip the board key (`stripLocaleKey`);
  - composed → delete the board-language variant **row**.
  Origin + "Made in" badge return; other languages untouched. Never shown on the origin board.
- **Delete** — the existing trash button, **redefined** to remove the **whole item across all
  languages** (composed: the source **and every sibling variant** in the group; labels: the
  whole record/row), behind an explicit "*removes it on every board · can't be undone*"
  confirm. This replaces today's delete-the-shown-row behaviour, fixing the orphan-the-group
  bug. A new `deleteSentenceGroup` / `deletePhraseGroup` mutation (delete all rows sharing the
  `variantGroupId`) backs the composed case; labels reuse existing single-record deletes.

### 5. Scope / surfaces

Uniform across all localised content — **list items, list titles, folder & category names,
sentences, phrases**. Mechanism differs (labels = record key; composed = sibling row); UX
(fork-on-edit, board-accent, revert, delete) is identical.

### 6. Existing data — no migration

Reads already accept string-or-record; new edits write the correct shape; old mis-keyed text
becomes a normal board variant the owner can Revert. **Accepted consequence:** a
partially-translated variant now speaks entirely in its board accent (consistent), which may
change how some already-authored content sounds.

---

## Data model & components (reuse-first)

- **Reused mutations:** `createSentenceVariant`, `createPhraseVariant` (fork); existing
  `updateProfileList*` / `renameFolder` / `updateCategoryMeta` (label writes);
  `deleteProfileSentence` / `deleteProfilePhrase` (single-row, used by Revert).
- **New mutations:** `deleteSentenceGroup(variantGroupId)` / `deletePhraseGroup(variantGroupId)`
  — delete every row in a variant group (Delete = whole item).
- **Helpers (from the 15.6 groundwork, kept):** `RevertBadge`/edit-toolbar icon,
  `stripLocaleKey`, `originLocale`, `canRevertLabel` in `lib/languages/variants.ts`.
- **Block voice:** change the locale source in `blocks.ts` (`blocksFromUnits`) — carry the
  row's `authoredLanguage` as every block's `locale`, rather than per-block `resolvedLocale`.
- **fork-on-edit interception:** in the composed-content edit handlers
  (`SentencesModeContent`, `InlinePhraseEditor`, `TalkerDropdown` phrase edit) and the fluent
  text edit — before writing, if `authoredLanguage(collapsedRow) !== board`, fork first.

## Testing & acceptance

**No unit-test harness** (project convention): verify with `npx tsc --noEmit` +
`npx tsc -p convex/tsconfig.json --noEmit`, plus a manual matrix walk on the running app.

Owner's test strategy (validated):
- **Existing content** (defaults, including items deliberately holding wrong-language text) →
  exercises **Revert** and **board-accent voice/accent**, and **swapping language text on
  different boards**. Valid because forks reuse the same structure as existing variants.
- **New content in ungrouped modules** → exercises **fork-on-edit**, **delete**, and
  **create**.
  - ⚠️ **A fork only occurs when editing on a board *different* from the item's origin.** To
    test forking: create the item on board A, then **switch to board B and edit it**. Editing
    on the origin board edits the origin (no fork).

Acceptance matrix — per board EN/ES/HI, for list item / list title / folder-or-category name /
sentence / phrase:
1. **Fork:** edit a fallback item on a non-origin board → a board version is created (seeded
   from origin); the origin board is unchanged.
2. **Board-accent voice:** a forked item (even one holding origin-language text) speaks in the
   board voice; an un-forked item speaks in the origin voice + shows "Made in".
3. **Block consistency:** a block sentence with mixed per-block translation speaks entirely in
   the collapsed row's board voice — no word-vs-phrase split.
4. **Revert:** edit-toolbar Revert → confirm → origin returns + "Made in" reappears; other
   languages unchanged; not offered on the origin board.
5. **Delete:** trash → confirm ("every board") → the item is gone on all boards; no orphaned
   variants.
6. **Create:** a new ungrouped item is authored in the creating board's language (its origin).
7. Fork ↔ Revert round-trips and survives a board switch.
8. **Word-unit save (Stage 2, §2a):** edit a single-symbol/word block's text on a forked
   variant → the text is keyed under the fork's `authoredLanguage` (not blindly the board key
   via a hardcoded-`en` field), AND the audio re-synthesizes the new text in the board voice
   (the stale clip is dropped) — no more "shows dinner, speaks raat ko khana".

## Implementation staging (for the plan)

1. **Block-voice consistency** — voice = variant's `authoredLanguage`. Small, standalone, safe,
   high value; ship first.
2. **fork-on-edit** for composed content (the cross-board footgun fix) — **plus the two
   word-unit save-path defects (§2a): correct-language keying and audio-invalidation-on-text-
   change.** They live in the same save path this stage reworks.
3. **✅ Shipped (`main`, 2026-07-19). Revert** edit-toolbar icon across all surfaces (absorbs the 15.6 revert plan).
4. **✅ Shipped (`main`, 2026-07-19). Delete → whole-item** redefinition + `deleteGroup` mutations + confirm copy.

Labels (lists/folders) are already largely board-true (per-language key merge from 15.5); their
work is mainly the Revert icon (Stage 3) and Delete confirm copy (Stage 4).

## Out of scope / risk

- No trash/undo; no native-voice-everywhere; no bulk data migration.
- **Risk:** this changes **core editing behaviour on a live app**. The staging exists so the
  low-risk pieces (block-voice, revert) can ship and be validated before the behaviour-changing
  pieces (fork-on-edit, delete-redefine).

## Follow-up docs

On implementation, fold the model into **ADR-016** (new addendum) as the canonical
board-true-editing decision, superseding the standalone 15.6 revert note.
