# ADR-016 — Composed-Content Language Variants

**Date:** 2026-07-12
**Status:** Accepted

---

## Context

Phase 15 shipped the bilingual foundation: symbols/words translate live (order-free), and **structure-bound content** (phrases, block/sequence sentences) is tagged with `authoredLanguage` so it resolves its text + voice against the language it was authored in, never the board language ([`phase-15-language-design.md`](../plans/_done/phase-15-language-design.md)). A block sentence authored in English keeps English word order and English voice even on a Hindi board, and shows a **"Made in EN"** badge — a valid, permanent bilingual state, not an error.

What Phase 15 left deferred: an instructor can only author *one* composition per logical item. There is no way to author a **native Hindi version** of that English sentence — correct Hindi symbol order, Hindi text, Hindi audio — and have the app show it on a Hindi board while still showing the English version on an English board. Word order and morphology are language-specific; machine-translating a composition in place produces wrong order. The governing principle (unchanged since Phase 15):

> Order-free content (symbols/words) translates live. **Structure-bound content (phrases, all sentence types) is re-authored per language, never machine-translated in place.**

This ADR defines the data model, resolution, and authoring flow for **per-language variants** of composed content. It is the contract for Phase 15.5.

### Scope clarification (owner-decided, 2026-07-12)

A variant is fundamentally **a per-language authored symbol arrangement**. It exists for *every composed type*; playback mode is orthogonal:

| Type | Per-language variant? | Audio resolution |
|---|---|---|
| **Phrase** | yes (re-arranged symbols) | phrase clip / TTS |
| **Fluent sentence** | yes (re-arranged symbols) | one translated string, TTS'd whole, resolves live |
| **Block/sequence sentence** | yes (re-arranged symbols) | stepped per-unit clips |
| **List** | no — items + folder name translate live | per-item, live |

Fluent sentences were previously "one translated string, live" only. They now **also** get a per-language symbol arrangement: the instructor writes the sentence in the board language and re-arranges its symbols, while audio remains a single whole-utterance TTS of the translated string. Audio behaviour is unchanged and stays keyed off the existing `playback: "fluent" | "sequence"` field.

**Out of scope for 15.5:** MT-as-assist (auto-suggesting a machine-translated starting string inside the authoring flow). Deferred to a future ADR. Note: this excludes only the *auto-translate suggestion* — variant authoring retains the **full composition-builder audio pipeline** (write the new text in the board language, then **generate TTS or record** voice, exactly as normal authoring).

---

## Decision

### 1. Storage — `variantGroupId` sibling rows

A variant is **another `profileSentences` / `profilePhrases` row of the identical shape**, tagged with its own `authoredLanguage`, linked to its siblings by a shared `variantGroupId`. One new optional field per table:

```ts
// profileSentences AND profilePhrases
variantGroupId: v.optional(v.string()),
```

- **The group id IS the source row's `_id`.** The *source* variant is the first-authored one. Source row: `variantGroupId` unset **or** `variantGroupId === _id`. A sibling variant: `variantGroupId === sourceId`.
- **Lazy grouping, zero migration.** A normal new sentence/phrase has no `variantGroupId` — a singleton group of one, source = itself. A group only materialises when a *second* language is authored: patch the source (`variantGroupId = source._id`), then insert the sibling with `variantGroupId = source._id`. Every legacy row is already a valid singleton. No backfill, no migration.
- **Siblings copy the source's `folderId` and `order`** and stay in sync on reorder, so a group occupies one stable slot in the list regardless of which language is showing. Reordering a group reorders all its siblings together.

**Why sibling rows, not a parent-slot table or an embedded variants map:** the entire composition stack — render, edit, playback, audio — is already per-row and already language-tagged (`authoredLanguage`, Phase 15). Option A treats a variant as exactly what it is (a sibling composition), so a single variant renders/plays/edits through unchanged code. The new logic is confined to two narrow places: the list collapse and the authoring entry point. A parent-slot table would force rewriting every query/render/edit path to route through the slot; an embedded `variants` map would fight the per-row playback/edit/audio plumbing and grow the doc unbounded.

### 2. Resolution — client-side group collapse

The board `language` is client context, so resolution is client-side — the same mechanism live text translation already uses, and the same reactive re-render-on-language-change proven by the search page.

- The `useQuery` returns all rows as today (all siblings included).
- The client **collapses each group** by current `language`: show the sibling whose `authoredLanguage === boardLanguage`; else show the **source** row (`_id === variantGroupId`, or the singleton).
- Only the collapsed row renders; siblings for other languages are hidden.
- Switching language re-collapses instantly — **no Convex re-query**.

**Badge rule (uniform across all composed types):** show the **"Made in <lang>"** badge iff the shown row's `authoredLanguage !== boardLanguage` — i.e. we fell back to the source because no variant exists for the board language. This **supersedes** the Phase 15 `isSequenceRow`-only badge condition ([`SentencesModeContent.tsx:698`](../../../app/components/app/sentences/sections/SentencesModeContent.tsx)); fluent sentences and phrases now show the badge too.

| Board vs authored | Variant for board lang? | Shows |
|---|---|---|
| Board = authored | — | native text/order, native voice, **no badge** |
| Board ≠ authored | no | source composition + **"Made in <authoredLang>"** badge; text/audio still live-resolve meanwhile |
| Board ≠ authored | yes | the native variant (its own order/text/audio), **no badge** |

### 3. Authoring entry — badge → edit mode

The badge is the entry point to author a native variant.

- Tapping it opens the **existing composition-builder edit flow**, pre-seeded from the source composition (source shown as reference while the instructor re-arranges), with `authoredLanguage = boardLanguage`.
- The full audio pipeline is available: write the new text in the board language, then **generate TTS (in the board language) or record** — standard authoring, no MT.
- **On save:** create a sibling row with the shared `variantGroupId`, copied `folderId` / `order`. Reuses the `SentencesModeContent` and `PersistentTalker` save paths (both already stamp `authoredLanguage = language`). The new work is: set `variantGroupId` on save + seed the builder from the source.

### 4. Audio — unchanged, orthogonal

Audio resolution is untouched by this ADR and stays keyed off `playback`: `fluent` → whole translated string TTS; `sequence` → stepped per-unit clips. (The Phase 15-review persona-split defect in the sequence path is a separate bug, fixed independently.)

### 5. Delete semantics

- Deleting a variant removes **just that row**.
- If the **source** is deleted while siblings remain, **promote** the lowest-`order` sibling to source: patch its `variantGroupId = its own _id` and re-point the other siblings to it.
- A singleton delete is unchanged.

### 6. MT-as-assist — deferred

Out of scope for 15.5. A future ADR may add an optional (Pro+) machine-translated **starting suggestion** inside the authoring flow. MT never ships unreviewed — the instructor always arranges symbol order and confirms text. This exclusion does **not** touch the generate/record audio pipeline, which is in scope.

---

## Consequences

- **Bug #1 seam.** The Phase 15-review "Made in HI badge missing" bug has two halves: (a) *stamp `authoredLanguage` on every create path* — an independent bug fix; (b) *fluent sentences should also show the badge* — a decision of this ADR that lands with the §2 resolution work. Fix (a) in the standalone bug pass; do not also touch the badge scope there — it changes here.
- **Query cost.** Returning all siblings and collapsing client-side means the list query fetches (up to) 3× rows for fully-tri-lingual items. Acceptable at our scale; groups are small (≤ one row per supported language).
- **Order coupling.** Keeping siblings' `order`/`folderId` in sync on every reorder/move is required for stable positioning — the reorder mutation must fan out across the group.
- **No migration.** Legacy rows are singletons; the model is additive.

---

## Supersedes / relates

- Extends **ADR-015** (composition primitive) — variants are sibling compositions, same `units[]`/`words[]` shape.
- Builds on **Phase 15** `authoredLanguage` ([`_done/phase-15-language-design.md`](../plans/_done/phase-15-language-design.md)); broadens the badge rule beyond block/sequence.
- Implemented by [`phase-15.5-content-variants.md`](../plans/phase-15.5-content-variants.md).
