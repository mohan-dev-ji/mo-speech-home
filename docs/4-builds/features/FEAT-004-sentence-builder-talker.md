# Phase 14 — Sentence Builder + Talker Renovation

**Status:** Spec (Proposed) · **Architecture:** [ADR-015](../decisions/ADR-015-composition-primitive-and-phrase-tree.md) · **Date:** 2026-06-29

---

## Goal

Let users build sentences from **phrases and words in the talker**, see how an utterance decomposes, and learn that **phrases are reusable building blocks for other sentences** — the GLP build-up / break-down loop ([dossier doc 6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md)) made real. Ship the **MVP spine**; defer the intelligence layer.

This is **the opposite of today's model**, where one symbol can carry a whole sentence's audio. Phase 14 brings symbols *together* into named, prosodic, reusable phrases.

---

## In scope (the MVP spine)

1. **Phrase as a first-class unit** — a named, audio-bearing chunk made of word-units, rendered as a **zinc** box, stored in a new **Phrases tree** (4th content tree). No public library tab — phrases are developed in the dropdown (amended 2026-06-30; see ADR-015 §4).
2. **Compositions that keep their parts** — `profileSentences` gains `kind` + `units[]`; a saved sentence retains which units were phrases vs words (never flattened to text).
3. **Talker dropdown renovation** — Tab 1 = **Core words** (a grid of core-word modules, Numbers/Letters folded in); Tabs 2–6 = **phrase banks** (views into the Phrases tree).
4. **Talker bar renovation** — holds a mix of white symbol chips and zinc phrase boxes; **drag-to-reorder + remove** (`dnd-kit`, touch-first); the **save button** writes a `kind: "sentence"` composition.
5. **Composition builder** — the sentences-page editor generalises to author both phrases and sentences, and to drop phrase-units into a sentence.
6. **Read-only decomposition view** — for the child to *see* and the instructor to *model with*. "See how this was built," never "now build it."
7. **Seed content** — core-word modules + a few showcase phrases + **empty phrase banks** ready for instructors/high-functioning users to fill.

## Out of scope (deferred, gateable)

Curated next-word prediction · auto-navigation · editing a phrase's membership inside the talker bar · phrase-in-phrase nesting · morphology engine · keyboard page · per-language prediction/morphology datasets. (See [ADR-015 → Out of scope](../decisions/ADR-015-composition-primitive-and-phrase-tree.md).)

---

## Data model (summary — see [ADR-015](../decisions/ADR-015-composition-primitive-and-phrase-tree.md) §1–4)

- **One composition primitive**, `kind: "phrase" | "sentence"`. Same shape, different role/tree.
- `profileSentences`: + `kind` (default `"sentence"`), `slots[]` → `units[]` (word | phrase union). Sentences may hold word-units **and** phrase-units.
- **New `profilePhrases` table**: same shape, `kind: "phrase"`, holds `words[]` only (one level — no phrase-in-phrase).
- **Snapshot at insert** — a phrase dropped into a sentence is copied, not referenced. *Structure frozen, localised text live* (ADR-012 §7).
- **Phrases tree** + `phraseLifecycle` overlay + curated phrase modules in `libraryModules` (`tree: "phrases"`), per the ADR-014 2026-06-27 module model.

---

## UI surfaces

### Talker dropdown (Figma `3222:4984` Core-words, `3222:5565` Phases)
- **Tab 1 — Core words:** grid of core-word module tiles (General · Pronouns · Joining words · Position Words · Time · Numbers · Letters). Retires hardcoded `LITTLE_WORDS_GROUPS`.
- **Tabs 2–6 — Phrases 1–5:** phrase banks = Phrases-tree folders. Each shows phrase cards (zinc boxes with name pill). Tapping a phrase inserts it into the talker as a phrase-unit.
- Controlled by the existing `core_dropdown_visible` flag.
- **Open animation:** slides down from the chevron as a surface layer lying *on top of* the navigated category (not a replacement). Honours `reduce_motion` + OS `prefers-reduced-motion` (snaps open, no slide).

### Talker bar (Figma `3222:5565` top region)
- Renders `units[]`: white chip for a word-unit, **zinc box + name pill** for a phrase-unit (Symbol/variant=Phrase `3222:5809`; inner chips keep category colour).
- **Shuffle editing:** `dnd-kit` drag-to-reorder (long-press activation so taps still play audio; keyboard/ARIA fallback) + corner **X-button** remove. Drag unit = a talker unit; a phrase box moves/removes whole.
- **Play (live, unsaved):** staggered sequence of each unit's clip (phrase clip for phrase-units, symbol clip for word-units).
- **Save:** writes a `kind: "sentence"`, `playback: "sequence"` composition retaining the decomposition + each unit's audio path. **Requires choosing a target sentence module/folder** (folder picker with a smart default per ADR-014 §7 soft suggest-on-save). No whole-sentence TTS is generated for a talker save.

### Composition builder (generalised sentences-page editor)
- Authors both `kind`s: **Save as Phrase** → phrase bank (zinc, word-units only); **Save as Sentence** → Sentences tree (word + phrase units).
- Page-authored sentences use **fluent whole-utterance TTS** (`playback: "fluent"`, recorded / Chirp 3 HD), as sentences do today; tone arrives Phase 15. Talker-saved sentences stay on the staggered unit-sequence path (`playback: "sequence"`).
- Honours the two-level edit pattern — symbol creative editing stays in `SymbolEditorModal`, never inline.

### Decomposition view (read-only)
- Shows a saved sentence as its ordered units; a phrase-unit expands to reveal its words. Tapping a unit plays *that unit's* audio.
- UX copy is model-not-test: "See how this was built." No fill-in-the-blank affordance.

### Dropdown edit modes (added 2026-06-30 — Figma `core-word-edit` / `phrases-edit`)

The dropdown's two content types are **instructor-authorable in place**, reusing the existing category-edit and sentence-edit machinery rather than new editors. An Edit/Done toggle in the dropdown flips the active tab into edit mode.

- **Core-words edit** ≈ **category edit mode**. Editable core category: dashed editable name, draggable/deletable symbol tiles, an **add-symbol placeholder** that opens `SymbolEditorModal` in `categoryBoard` mode (image + audio generator). Likely the *same* editable-board component as the categories page.
- **Phrases edit** ≈ **sentence edit mode**, restyled. Same features as editing a sentence — add symbol, edit text + audio (Generate TTS / Record), move, delete, **and the move-to-folder ("move group") button** (reuse the one in the sentence row) — but laid out **stacked** (symbol over text) so a phrase reads like a symbol that sits among symbols in the talker, not like a side-by-side sentence row.
- **Create a core group** = the **New category** flow adjusted for core: name + proposed words → the new group opens in edit mode with empty placeholders, each click opening the symbol editor (with audio) to bind a real symbol. Materialises a `surface:"core"` category.
- **Create a phrase** = the **New sentence** modal: type the phrase name → an empty phrase block opens → add a symbol (no audio at the word level) → tapping the text opens the **Edit Sentence** modal to change text + Generate/Record the phrase's audio.

Intent: *no bespoke editors* — refactor the category-board editor and the sentence editor (`SlotStrip` + Edit-Sentence modal + move-to-folder) for dropdown usage; only the phrase layout (stacked) and the surface (dropdown vs page) differ.

---

## Seed content

- **Core-word modules** reseeded from the retired `LITTLE_WORDS_GROUPS` (General = old core-a + core-b merged; Pronouns; Joining words; Position Words; Time) + Numbers + Letters.
- **A handful of showcase phrases** in bank 1 (e.g. `Let's go`, `I want`, `all done`) to demonstrate the zinc box, the decomposition, and reuse-into-a-sentence.
- **Empty phrase banks** (2–5) provisioned and ready for instructor authoring.

---

## Suggested build slices (firmed up during writing-plans)

1. **Schema + migration** — `kind`, `units[]`, `profilePhrases`, `phraseLifecycle`; migrate existing `profileSentences`; back up first. Verify with `tsc -p convex/tsconfig.json` (no `convex dev` in worktree).
2. **Phrases tree backend** — the module recipe applied (install/catalogue/lifecycle/CRUD); seed showcase + empty banks (auto-installed via `seedDefaultAccount`). No public library tab — developed in the dropdown.
3. **Talker dropdown renovation** — Tab 1 core-word modules, Tabs 2–6 phrase banks.
4. **Talker bar — phrase rendering + shuffle editing** — `dnd-kit`, zinc boxes, reorder/remove, sequence-play.
5. **Talker save → composition** — wire the save button; write `kind: "sentence"` with decomposition.
6. **Composition builder + decomposition view** — generalise the editor; read-only build-up/break-down view.

Each slice should land behind the existing instructor/student-view split and be demoable to the advising SLP.

---

## References

- [ADR-015](../decisions/ADR-015-composition-primitive-and-phrase-tree.md) — the architecture contract.
- [ADR-004](../decisions/ADR-004-persistent-global-talker.md) · [ADR-014](../decisions/ADR-014-content-modules-and-three-tree-organisation.md) — talker buffer + three-tree model.
- [GLP dossier docs 3](../../2-research/gestalt-language-processing/03-glp-and-aac.md) / [6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md) / [7](../../2-research/gestalt-language-processing/07-container-organisation.md).
- Figma *Mo Speech — Finals* — Talker `3222:4983`, Phrase `3222:5809`.
