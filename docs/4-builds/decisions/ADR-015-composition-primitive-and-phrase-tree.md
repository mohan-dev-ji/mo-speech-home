# ADR-015 — Composition Primitive, Phrase Tree & Talker Renovation

**Date:** 2026-06-29
**Status:** Accepted

---

## Context

Phase 14 ([build plan](../../00-roadmap.md)) turns Mo Speech from a symbol-exposure app into a surface for *constructing* phrases and sentences — the Gestalt Language Processing (GLP) "build-up / break-down" loop made real ([dossier doc 6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md)). The advising SLP's framing: students should learn that **phrases can be reused to make other sentences**. Today the app does the opposite — a "sentence" can be one symbol carrying whole-utterance audio. Phase 14 brings multiple symbols *together* into a named, reusable, prosodic chunk.

Three structural facts about the current build force an architecture decision:

1. **There is no "phrase" concept.** The data model has `profileSymbols`, `profileLists`, `profileSentences`. A phrase — a reusable chunk that is itself made of symbols, carries its own name + audio, and can be inserted into many sentences — does not exist.

2. **Sentence slots cannot retain a decomposition.** [ADR-014's 2026-06-25 addendum](./ADR-014-content-modules-and-three-tree-organisation.md) deliberately decided that `profileSentences.slots[]` store an `imagePath` + `displayProps` snapshot only — **no symbol reference, no unit type** — because Phase 13 sentences only needed to render images and play one whole-utterance audio clip. Phase 14's entire premise ("save **retains the decomposition** — the phrases/words it was built from, never flattened") requires exactly the structure that addendum optimised away.

3. **The talker buffer is flat.** `TalkerContext.talkerSymbols: TalkerSymbolItem[]` ([`app/contexts/TalkerContext.tsx`](../../../app/contexts/TalkerContext.tsx)) is a flat list of single symbols, played symbol-by-symbol ([`PersistentTalker.tsx`](../../../app/components/app/shared/sections/PersistentTalker.tsx)). It has no notion of a multi-symbol unit, and its save button is unconfigured.

The Figma "Talker" component (file *Mo Speech — Finals*, node `3222:4983`) has three variants — Default, **Core-words**, **Phases** — plus a **Symbol/variant=Phrase** (`3222:5809`): a **zinc** box wrapping N white symbol chips with a name pill. The dropdown becomes Tab 1 = *Core words* (a grid of core-word modules, with Numbers/Letters folded in) and Tabs 2–6 = *phrase banks*. The talker bar holds a **mix** of white single-symbol chips and zinc phrase boxes, in sequence.

This ADR is the contract for Phase 14. It **supersedes ADR-014's 2026-06-25 addendum** (slots gain unit structure after all) while preserving ADR-014's three-tree model, its "structure frozen · text live" rule (§4), and the ADR-012 §7 resolution model.

---

## Decision

### 1. One composition primitive, two roles via `kind`

A **phrase** and a **sentence** are the *same data shape* — an ordered list of units that keeps its parts, with a name and its own audio. They differ only by **role**, captured in a `kind` field. This is [dossier doc 7](../../2-research/gestalt-language-processing/07-container-organisation.md)'s existing principle ("a list and a sentence are the same data shape, differing only by type and which tree they file into") extended to phrases.

| | `kind: "phrase"` | `kind: "sentence"` |
|---|---|---|
| **Role** | reusable building block (gestalt) | top-level utterance |
| **Files into** | a phrase bank (**Phrases tree**) | the **Sentences tree** |
| **Renders as** | zinc box + name pill (the marker) | normal utterance |
| **May contain** | word-units **only** (one level deep) | word-units **and** phrase-units |
| **Surfaced in** | talker dropdown tabs 2–6 (banks) | sentences page + talker save |

**Nesting is one level only:** a phrase decomposes into words; a sentence decomposes into words and phrases. A phrase **never** contains another phrase. This bounds the data model and the decomposition view to two levels — a deliberate V1 constraint.

### 2. Slots become `units[]`

`profileSentences.slots[]` evolves into `units[]`, where each unit is a discriminated union:

```ts
type CompositionUnit =
  | { kind: "word";   order: number; imagePath?: string; audioPath?: string;
      label: LocalisedString; displayProps?: SlotDisplayProps; }
  | { kind: "phrase"; order: number; name: LocalisedString; audioPath?: string;
      recordedAudioPath?: string;
      words: Array<{ order: number; imagePath?: string; audioPath?: string;
                     label: LocalisedString; displayProps?: SlotDisplayProps; }>; }
```

- A **word-unit** is today's slot plus an explicit `kind` and label (so the talker chip and the decomposition view can render text).
- A **phrase-unit** is the **snapshot** of a phrase at insert time: its name, its own audio, and its ordered words. It is *not* a live reference to a phrase-bank entry (see §3).

The existing `profileSentences` table gains a `kind` field (`"sentence"` default for migrated rows) and the `units[]` array. Phrase-bank entries are stored in a **new `profilePhrases` table** of the same shape with `kind: "phrase"` and `words[]` (never `units[]` — phrases hold words only).

### 3. Snapshot at insert — structure frozen, text live

A phrase inserted into a sentence is **copied** (snapshotted), not referenced. Rationale (inherits [ADR-014 §4](./ADR-014-content-modules-and-three-tree-organisation.md) / [ADR-012 §7](./ADR-012-language-operations-console.md)):

- **Structure frozen** — an instructor editing a phrase-bank entry must never retroactively reshape a child's already-saved sentence. AAC stability outranks edit-propagation convenience. "Reusable" means *authoring* reuse (insert the same phrase into many sentences), **not** live linkage.
- **Text live** — localised labels/names still resolve live from the global `symbols` table and module source at render, so a newly-shipped language or translation fix reaches saved compositions. The snapshot freezes *which units and which symbols*, not their *text*.

### 4. Phrases get their own tree, tab, and lifecycle

Phrases are a **new content-module plugin type** per the [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) / ADR-014 pattern:

- A **fourth content tree** — Categories (semantic) · Lists (procedural) · Sentences (pragmatic) · **Phrases (reusable chunks)**.
- A `phraseLifecycle` overlay + the universal lifecycle admin functions (`listAllPhraseModulesForAdmin`, `updatePhraseLifecycle`, `deletePhraseLifecycle`), exactly as the other module types.
- Per the [ADR-014 2026-06-27 addendum](./ADR-014-content-modules-and-three-tree-organisation.md), curated/default phrase modules live in Convex (`libraryModules`, `tree: "phrases"`) — not committed JSON.

The phrase banks shown as dropdown tabs 2–6 are **views into the Phrases tree** — its folders surfaced in the talker. No parallel talker-only storage.

> **Amended 2026-06-30 — no public library tab.** Unlike the other three content
> trees, phrases are **not** surfaced as a public library browse tab. A phrase is
> an incomplete *part* of a sentence; shown as a standalone library card it reads
> as a broken half-sentence and invites the wrong mental model. Default phrase
> banks reach an account via `seedDefaultAccount` (the `isDefault` modules
> auto-install); from there **instructors develop them in the talker dropdown**.
> The backend tree, install, CRUD, lifecycle, and seed all stand — only the public
> browse/install surface is dropped.

### 5. Two authoring surfaces, one entity — the "two sentences" reconciliation

There are **not** two types of sentence. There is one `kind: "sentence"` entity with **two authoring surfaces**:

- **The sentences page builder** *is* the composition builder. It authors both `kind` values — save-as-phrase files into a phrase bank; save-as-sentence files into the Sentences tree. It gains the ability to drop phrase-units into a sentence.
- **The talker** is a second surface that composes a sentence live from core words + phrase banks; its **save button** writes a `kind: "sentence"` that **retains which units were phrases**. The sentences page can then re-open and edit it.

A talker-saved sentence and a page-built sentence are the **same row, same shape** — only the entry point differs.

### 6. Core words become modules — full parity with top-level group modules

Tab 1 "Core words" is a grid of **core-word modules** (General, Pronouns, Joining words, Position Words, Time, **Numbers**, **Letters** — Numbers/Letters fold in from their old dedicated tabs). These are **the same kind of module as the existing top-level group/category modules**, on the same `libraryModules` machinery — **no special-cased path**:

- **Admin-editable defaults + republish** — an admin edits the default core-word modules in admin view and republishes via the same upsert mutation (ADR-014 2026-06-27), no deploy.
- **User reload-defaults** — a user reloads the default core-word set into their profile via the existing `reloadFromLibrary` flow (Phase 6).
- **User custom edits** — a user customises core-word modules in their own profile exactly as they customise any category module.
- Tier/lifecycle-governed like every other module.

**The one exception: no colour swatch.** Core-word modules have **no per-module colour picker** — their colour is **fixed to zinc-500** (see §7). Everything else (symbols, labels, audio, reorder, reload, republish) is identical to a top-level group module.

The hardcoded `LITTLE_WORDS_GROUPS` in [`convex/data/defaultCategorySymbols.ts`](../../../convex/data/defaultCategorySymbols.ts) — the one content path that bypasses the module system — is **retired** and reseeded as core-word modules.

### 7. Zinc is the structural-layer colour — phrases *and* core words

Zinc (`{ c100, c500, c700 }` already in [`app/lib/categoryColours.ts`](../../../app/lib/categoryColours.ts)) marks the **structural layer** of the language, deliberately offset from the colourful **semantic** categories:

- **Phrase wrapper** uses zinc, so "this is a phrase" reads at a glance. Inner symbol chips keep their own (white / category) colour. The zinc wrapper + name pill persist identically in the dropdown bank **and** in the talker bar.
- **Core-word modules** are also **locked to zinc-500** and have **no colour swatch** (§6) — core words are the structural glue (the, and, want, go) that phrases are largely built from, so unifying them in zinc is coherent, not arbitrary.

The rule: **zinc = structural (core words + phrase wrappers); colour swatch = semantic fringe categories.** Only semantic category modules expose `ColourSwatchPicker`.

### 8. Talker shuffle-editing — reorder + remove, touch-first

The talker bar gains **drag-to-reorder** and **remove**, reusing the MVP's proven UX (corner X-button to remove; opacity-on-drag + highlight-drop-target feedback) but with a **touch-capable engine** — the MVP's native-HTML5 drag was mouse-only, unacceptable for a tablet-first AAC device.

- **Engine: `dnd-kit` — already a project dependency** (`@dnd-kit/core`, `/sortable`, `/utilities`), already used for folder reorder (`GroupTile`) and sentence-slot reorder (`SlotStrip` in `SentencesModeContent`). The talker reuses that exact pattern — pointer/touch sensors, a long-press **activation delay** so a tap still plays the symbol (the tile is both draggable *and* a play target), and keyboard + ARIA reordering for accessibility. **No new dependency.**
- **The drag unit is a talker unit.** A phrase box reorders and removes as one whole zinc block; a word chip moves as a chip. Reorder rewrites `units[].order`; remove splices one unit out. The state logic ports verbatim from the MVP (`reorderUnits(from,to)` = splice; `removeUnit(i)` = filter).
- **Reordering the talker bar does not violate motor planning.** [Dossier doc 3](../../2-research/gestalt-language-processing/03-glp-and-aac.md) #4's "never reshuffle the board" governs the *fixed dropdown/board*; the talker bar is the composition surface, where reordering the sentence under construction is expected.

### 9. Audio — two playback modes on the same `units[]` entity

A `playback: "sequence" | "fluent"` flag on the composition picks how it speaks. Both modes keep the full `units[]` decomposition.

- **Unit-built sentences (talker-saved) → `playback: "sequence"` (default for talker saves).** Persisted and played as a **staggered sequence of the true unit clips** — the phrase's own clip for a phrase-unit (one chunk), the symbol clip for a word-unit, with deliberate gaps. Mechanical and less fluent **on purpose**: a beginner hears which audio maps to which word/phrase, reinforcing the build-up/break-down structure. **No whole-sentence TTS is generated for a talker save** — the stored unit clips *are* the audio.
- **Sentences-page sentences → `playback: "fluent"` (default for page authoring).** A fluent whole-utterance **TTS** clip (Chirp 3 HD / recorded), exactly as sentences do today. Tone / intonation variants arrive in **Phase 15** on this fluent path.
- **A phrase as a unit** contributes its own phrase clip (recorded / TTS) — one chunk in the sequence; prosody is clinically load-bearing for GLP ([dossier doc 3](../../2-research/gestalt-language-processing/03-glp-and-aac.md) #3).
- The decomposition is for **seeing and modelling, not testing** ([dossier doc 6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md) hard-decision #3): "see how this was built," never "now build it yourself."

---

## Migration & reconciliation

- **ADR-014 (2026-06-25 addendum) — superseded.** Slots *do* gain unit structure (`kind`, label, and for phrase-units a `words[]` snapshot). The rest of ADR-014 — three trees, 1:1 install, lifecycle visibility, delete/reinstall, the 2026-06-27 "content in Convex" addendum — stands; this adds a fourth tree and a unit-bearing slot shape.
- **`profileSentences` migration.** A one-time migration sets `kind: "sentence"` on existing rows and maps each `slots[]` entry to a `{ kind: "word", … }` unit (label backfilled from the source symbol where available; pure-image slots keep `imagePath` only). Back-compat read path tolerates legacy `slots[]` until migrated. Back up first (`npx convex export`, per CLAUDE.md).
- **ADR-012 §7 (resolution).** Unchanged model: structure is a per-account snapshot; localised text resolves live. The new phrase-unit snapshot is a direct application.
- **ADR-004 (persistent global talker).** Unchanged: the buffer stays in `TalkerContext`, survives navigation, renders in the layout shell. Its item type widens from `TalkerSymbolItem` to a `word | phrase` union, and it gains `reorderUnits` / `removeUnit`.

---

## Consequences

- A new `profilePhrases` table, a `phraseLifecycle` overlay, and a fourth tree — all following the existing module recipe, so additive rather than novel. (No public library tab — phrases are developed in the dropdown; see §4 amendment.)
- `profileSentences` gains `kind` + `units[]`; a migration is required on a table that just shipped in Phase 13.
- `TalkerContext` item type becomes a union; `TalkerBar` renders zinc phrase boxes inline; talker reorder reuses the existing `dnd-kit` setup (no new dependency).
- The sentences-page editor generalises into a composition builder (authors phrases *and* sentences; can insert phrase-units). The talker save button is finally wired.
- `LITTLE_WORDS_GROUPS` is retired in favour of core-word modules — one fewer content path, consistent lifecycle/translation.
- The build-up / break-down GLP story becomes demonstrable to the SLP with a read-only decomposition view.

---

## Alternatives considered

- **Phrases as a `kind`-flavour inside the Sentences tree (no fourth tree).** Rejected: phrases surface in a distinct place (dropdown banks), serve a different role (building block vs end product), and have their own lifecycle. The owner's instinct ("phrases get their own container type") matches the cleaner separation; data-model they remain one primitive, organisation-layer they separate — the both-and docs 6 and 7 endorse.
- **Live reference from sentence to phrase-bank entry.** Rejected: an instructor edit could reshape a child's saved sentence — unacceptable for AAC (§3).
- **Keep `slots[]` flat; store decomposition in a side field.** Rejected: the talker bar and decomposition view both need the unit structure at render; a parallel side field would drift from the rendered order.
- **Port the MVP's native-HTML5 drag as-is.** Rejected: mouse-only; reorder would silently fail on tablets, the primary AAC device (§8).
- **Hand-rolled Pointer Events drag (no library).** Rejected for V1: long-press activation, autoscroll, and accessibility are exactly what `dnd-kit` already solves; not worth re-deriving.

## Out of scope (deferred — gateable Phase-2 per dossier doc 6)

- **Curated next-word prediction** and **auto-navigation** — the "intelligence" layer; explicitly out of the Phase 14 spine.
- **Editing a phrase's membership inside the talker bar** (dragging a symbol into/out of a zinc box). Breaking a phrase open / editing contents stays in the composition builder, not the live bar.
- **Phrase-in-phrase nesting** — one level only (§1).
- **The morphology/inflection engine, keyboard page** — Phase 18; consume this model but not defined here.
- **GLP prediction/morphology datasets** — a separate content type + its own ADR (build-plan Phase 17).

## References

- [ADR-004](./ADR-004-persistent-global-talker.md) — persistent global talker (buffer model, unchanged).
- [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) — plugin pattern; phrases are its next application.
- [ADR-012 §7](./ADR-012-language-operations-console.md) — dynamic resolution; basis for §3.
- [ADR-014](./ADR-014-content-modules-and-three-tree-organisation.md) — three-tree model; its 2026-06-25 addendum is superseded here.
- [GLP dossier doc 3](../../2-research/gestalt-language-processing/03-glp-and-aac.md) — core/fringe, prosody, motor planning.
- [GLP dossier doc 6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md) — the sentence-builder concept + the three hard decisions.
- [GLP dossier doc 7](../../2-research/gestalt-language-processing/07-container-organisation.md) — three (now four) trees, shared shape.
- Figma *Mo Speech — Finals* — Talker component `3222:4983` (Default / Core-words / Phases), Symbol/variant=Phrase `3222:5809`.
