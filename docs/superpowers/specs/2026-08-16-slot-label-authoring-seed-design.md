# Slot labels as an authoring seed (+ fluent fork-on-edit) — design

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-16
**Context:** MOS-13 (Phase 4 · rebuild defaults for marketing), discovered while authoring default
sentences with the phase-24 auto-match checkbox.
**Builds on:** `docs/superpowers/specs/2026-08-16-sentence-auto-match-design.md` (phase-24)
**Touches:** ADR-015 (`slots[]` vs `units[]`), ADR-016 (per-language variants)

---

## 1. Problem

Auto-match fills a sentence's slot strip with one tile per word. Tapping a tile opens the symbol
editor with an **empty** SymbolStix search box, so to change a tile you retype the word you already
typed in the sentence. On a blank tile it is worse: a fluent slot stores no label, so nothing on
screen tells you which word that gap was for.

The unit editor on talker-saved sentences does not have this problem — `handleEditWord` passes
`initialLabel`, and `SymbolEditorModal.tsx:265` lazy-inits the search box from it. Only the **fluent
slot** path lacks a word to seed with.

## 2. Decision

**Fluent slots gain a localised `label`, stored purely to seed the search box. It is never
rendered.**

Sentence display does not change, in view mode or edit mode. This is an authoring aid, invisible to
the student.

### 2.1 Why localised rather than a plain string

A plain `searchWord: string` would seed one language. The localised record means the **seed follows
the board**: authoring a Hindi variant seeds Hindi words instead of stranding English ones. It also
costs nothing extra to write — auto-match already holds the matched symbol's full multi-language
`words`, exactly as `buildCreateSymbols` does for category symbols, which store
`{ ...hit.words, [language]: typedWord }` for this same reason.

Not rendering it is what keeps this cheap. The moment a label is displayed it becomes content —
subject to translation review, profile text-size flags, tile layout at 60px. As an authoring seed it
is none of those things.

### 2.2 Where the label comes from

| Moment | Label written |
|---|---|
| Auto-match, word matched | `{ ...hit.words, [boardLang]: theTypedWord }` |
| Auto-match, word matched nothing | `{ [boardLang]: theTypedWord }` — the blank tile still knows its word |
| Slot editor save | `{ ...draft.symbolWords, [boardLang]: searchBoxValue }` |
| Slot editor save, non-SymbolStix image | `{ ...existingLabel, [boardLang]: searchBoxValue }` — Upload / Image Search / AI Generate carry no word set |

**The board-language word changes only when you type a new search word** — never merely because you
clicked a different symbol. The mechanism is self-enforcing: the box seeds *from* the label, so an
untouched box writes back the same value. Other languages do follow the picked symbol, which keeps
them true to the tile.

Clearing the box drops that language's entry; the label is removed entirely if nothing remains.

**The seed is read exact-language only — `label[boardLang]`, never `displayString`.** This matters more
than it looks. `displayValue` falls back exact → `en` → *first key in insertion order*, which is right
for display and wrong for a seed, because every SymbolStix pick supplies a multi-language word set:

- Clearing would never work — deleting `label.en` leaves `{es:'fuera'}`, and tier 3 resurfaces `fuera`.
- Worse, the save contract is "the box's content **is** this language's word". So a fallback-seeded box
  that the user never retypes gets written straight back under the wrong key — `label.en = 'fuera'`,
  or on a Hindi board `label.hi = 'home'`, which then reseeds forever. A display convenience becomes a
  persisted cross-language write.

No entry for the board's language means no seed, which is the honest answer: `searchText.hi` holds
Hindi words and their romanisations, never English, so an English seed there returns nothing anyway.

### 2.3 Display / Text / Shape come out of the slot editor

Those three accordions write `displayProps`, which **no sentence renderer reads** — `ThumbnailStrip`
(view) and `SortableSlot` (edit) both draw image-only and ignore it entirely. They have never done
anything. The shipped default sentences (`convex/data/sentences/*.json`) carry
`showLabel: true`, `bgColour: '#ffffff'`, `cardShape: 'rounded'` on every slot, all inert.

The slot editor becomes: image-source tabs, the search box, the preview.

Existing stored `displayProps` values are **left alone, not migrated** — they are already inert, and
ADR-015 has `slots[]` slated for removal. They are preserved on pass-through (reorder, delete) and
simply never newly authored.

### 2.4 Fluent slot writers must fork on edit

Discovered while checking whether per-language editing survives this change: **the fluent slot path
has no fork-on-edit.** `handleSlotSave`, `handleRemoveSlot` and `handleReorderSlots` all call
`updateSlots` directly on whichever row is displayed. `persistUnits` (the sequence path) does fork —
it creates or reuses the board-language variant and writes to *that*, so a source is never mutated
from another board.

So today, on a Hindi board showing an English source as a fallback, reordering or editing a slot
edits **the English sentence**. Talker-saved sentences are safe; fluent ones are not.

That is pre-existing. What makes it this design's problem is that slot saves will now write a
**board-language-keyed label** — editing on a Hindi board would write `label.hi` into the English
row. That is precisely the cross-language contamination ADR-016 exists to prevent, and it would be
introduced here rather than merely inherited.

**All three writers get the fork**, sharing one helper rather than a second copy of the logic
currently inlined in `persistUnits`.

### 2.5 What the fork looks like on screen: nothing

A manual fork (`createSentenceVariant` with no `text`) copies `name` and `text` from the source with
their **source-language** keys, setting only `authoredLanguage`. So `needsTranslation(fluentPrimary,
boardLang)` still returns true, `badgeLang` stays the source language, and the row keeps showing
**Made in EN** with the translate control available — deliberate, per `convex/profileSentences.ts:205`
("a partial/untranslated variant shows something + the badge, not blank").

Editing a slot on a Hindi board therefore creates the Hindi variant **silently**: the badge does not
change, nothing shifts visually, and the only difference is that the English source is now protected.

The trade is that the fork is invisible — you cannot tell from the row that a variant now exists.
That is already true of talker-saved sentences, so this makes the two consistent rather than adding a
new surprise.

**This stops the bleeding; it does not repair it.** Sentences already edited from a foreign board
carry those edits in the source row. Auditing that is out of scope.

## 3. Code shape

### 3.1 Backend

- **`convex/schema.ts`** — `profileSentences.slots` object gains `label: v.optional(localisedString)`,
  commented explicitly as authoring-only and never rendered, so a later reader doesn't "fix" the
  renderer to show it.
- **`convex/profileSentences.ts`** — the same optional field on `createProfileSentence.slots` and
  `updateProfileSentenceSlots.slots` args. `flattenUnitsToSlots` is untouched: it mirrors sequence
  sentences, which use the unit editor.

### 3.2 Pure builder

**`lib/sentences/autoMatchSlots.ts`** — `SlotSpec` gains `label?: Record<string, string>`.
`buildSentenceSlots` writes the §2.2 rows for hit and miss. `SearchHit` already carries `words`, so
no new dependency.

### 3.3 Symbol editor

**`app/components/app/shared/modals/symbol-editor/`**

- `SentenceSlotSaveResult` becomes `{ imagePath?, searchWord?, symbolWords? }` — `displayProps` drops
  out.
- The `sentenceSlot` save path returns the search box's current value and `draft.symbolWords`, which
  already exists ("Canonical words of the currently-picked SymbolStix symbol, keyed by ISO code.
  Empty for non-symbolstix sources").
- New `initialSearchQuery?: string` prop seeds the box **without** touching `labelEng`, keeping
  `sentenceSlot` mode clear of the label machinery: `useState(() => initialSearchQuery ?? initialLabel ?? '')`.
- Display / Text / Shape are gated out of `sentenceSlot` mode.

The editor stays ignorant of slots and labels. It reports what was searched and what symbol was
picked; the page decides what that means. That is what keeps the merge rule in one place.

### 3.4 Sentences page

**`app/components/app/sentences/sections/SentencesModeContent.tsx`**

- One `resolveSlotWriteTarget(sentenceId)` helper carrying the fork logic currently inlined in
  `persistUnits`; `handleSlotSave`, `handleRemoveSlot`, `handleReorderSlots` all route through it and
  become async.
- `handleSlotSave` merges the new label per §2.2.
- The slot editor is passed `initialSearchQuery={displayString(slot.label, language, DEFAULT_LOCALE)}`.

## 4. Edge cases

| Case | Behaviour |
|---|---|
| Slot has no label (pre-existing, or hand-added **+**) | Empty search box — today's behaviour |
| Image from Upload / Image Search / AI Generate | `symbolWords` empty → keep existing other-language entries, patch board language only |
| Search box cleared | That language's entry dropped; label removed if nothing remains |
| Symbol swapped without retyping | Board-language word unchanged; other languages follow the new symbol |
| Row already in the board language | No fork — `targetId === sentenceId`, same as `persistUnits` |
| Fallback row edited | Forks to the board-language variant, seeded from the source's slots (labels included); the edit lands on the variant |
| Add-slot (**+**) on a fallback row | Forks, appends to the variant |
| Existing stored `displayProps` | Preserved on pass-through, never newly authored |

## 5. Verification

No test runner (see the phase-24 spec §6; phase-17 forbids adding one). Gate is
`npx tsc --noEmit -p tsconfig.json` grep-filtered to touched files — the baseline carries 4
pre-existing unrelated errors — plus `npx eslint`, then signed-in Chrome on `:3000`.

**Seeding**
- Auto-match a sentence, tap a filled tile → its word is already in the search box.
- Tap a **blank** tile → the word that found nothing is in the box.

**The typed-word rule**
- Swap to a different symbol without retyping, save, reopen → box unchanged.
- Type a new word, pick a symbol, save, reopen → box shows the typed word, not the symbol's own.

**The editor**
- `sentenceSlot` mode shows no Display / Text / Shape.
- Category and list editors still show theirs (different `editorMode`).

**The fork** — the part with real blast radius, so all three writers, not just save:
- On a Hindi board, on an EN-authored sentence: edit a slot → a Hindi variant exists and the English
  source is byte-unchanged. Repeat for reorder and for delete.
- Badge still reads **Made in EN** afterwards, translate control still present (§2.5).
- On an EN board editing an EN sentence → no variant created.

**Regression**
- Sentence strips render identically to before in view *and* edit mode — the whole premise is that
  display does not change.
- Talker-saved sentences: unit editor still pre-fills, unit edit/reorder/delete unchanged.

## 6. Out of scope

- Rendering the label anywhere.
- Migrating or clearing existing `displayProps` on slots.
- Auditing sentences already damaged by foreign-board edits (§2.4).
- Adding labels to `profileLists` items or phrase words.
- Fork-on-edit anywhere outside the fluent slot writers.
