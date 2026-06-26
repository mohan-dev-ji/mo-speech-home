# ADR-014 — Content Modules & Three-Tree Organisation

Date: 2026-06-24
Status: Proposed

---

## Context

[ADR-010](./ADR-010-pack-storage-shift.md) moved resource-pack content to JSON files; [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) generalised that into a **plugin pattern** — content types are JSON modules (`convex/data/<type>/*.json`) with a thin `<type>Lifecycle` overlay, three admin functions, and an admin section. Three plugin types prove the pattern today: **packs, themes, languages.**

The catch sits inside that first type. A **pack** (`library_packs/<slug>.json`) is not one content type — it **bundles three**: `categories[]`, `lists[]`, `sentences[]` in a single file, installed as a unit.

The Gestalt Language Processing research dossier ([`docs/2-research/gestalt-language-processing/`](../../2-research/gestalt-language-processing/README.md)) reframed Mo Speech around *constructing* phrases and sentences, and that work surfaced two structural problems with the bundled pack:

1. **Three content types, three organising axes.** Symbols/categories are organised **semantically** (by topic), lists **procedurally** (by lesson/skill), sentences **pragmatically** (by communicative situation). One bundle forced onto one browse/organisation unit is the "stretch" that authoring kept hitting. (dossier [doc 7](../../2-research/gestalt-language-processing/07-container-organisation.md))
2. **Sentences want to be first-class.** The sentence builder needs sentences to be self-contained objects that *retain their decomposition* (the phrases and words they were built from) — not snapshot arrays nested inside a pack. (dossier [doc 6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md))

ADR-011's plugin pattern **already supports per-type modules** — themes and languages are each their own plugin type. This ADR completes that generalisation: **promote categories, lists, and sentences from sub-arrays of a pack to first-class content-module plugin types**, and define how they organise inside the app. It **supersedes the bundling decision in ADR-010** while keeping that ADR's JSON-source-of-truth + lifecycle-overlay model intact.

---

## Decision

### 1. Three content-module plugin types replace the bundled pack

Categories, lists, and sentences each become a first-class plugin type per the ADR-011 §1 pattern:

```
convex/data/categories/<slug>.json      + categoryLifecycle  overlay
convex/data/lists/<slug>.json           + listLifecycle      overlay
convex/data/sentences/<slug>.json       + sentenceLifecycle  overlay
```

Each exposes the three universal admin functions (`listAll<Type>ForAdmin`, `update<Type>Lifecycle`, `delete<Type>Lifecycle`) and an admin section, exactly as packs/themes/languages do. **Themes and languages are unchanged** — they were already separate plugin types. This is simply ADR-011's pattern applied two more times, and it **supersedes ADR-010's bundling** of the three into `library_packs/<slug>.json`.

### 2. Three organisation trees, one per type, on three axes

In-app, content lives in **three separate container trees**, each organised on its natural axis:

| Tree | Axis | Holds |
|---|---|---|
| **Categories** | Semantic (by topic) | category modules — the symbol grids |
| **Lists** | Procedural (by lesson / skill) | list modules — task analyses / sequences |
| **Sentences** | Pragmatic (by situation) | sentence modules — saved compositions |

**Shared folder primitive, separate trees.** One folder mechanism under the hood; three distinct trees on top. Each tree contains **default folders** (from installed modules) **and** the user's own **custom folders**. A *list* and a *sentence* are the same underlying data shape — an ordered composition of units that keeps its parts — differing only by *type* and which tree they file into.

### 3. Module → tree install is 1:1; the library is four tabs

The resource library presents **four tabs — Categories · Lists · Sentences · Themes** — one per module type. Installing a module materialises it into the **one** matching tree. There is nothing cross-cutting: the provenance-vs-organisation tension that a bundled pack created simply does not arise.

### 4. Self-contained sentences — structure frozen, text live

A sentence module **embeds its own symbol references / structural snapshot**, so deleting a category, group, or other module **never breaks a saved sentence**. This closes the sentence→symbol dependency the bundled model hid.

**But "self-contained" means *structurally* self-contained, not text-frozen.** A sentence's localised *labels* must still **resolve live** per [ADR-012 §7](./ADR-012-language-operations-console.md)'s pristine-field model — otherwise a newly-shipped language or translation fix would never reach a saved sentence, reintroducing the photocopy/staleness trap ADR-012 fought to escape. The rule:

> **Structure frozen (so it never breaks) · localised text live (so new languages flow in).**

The two properties coexist on the same object: the symbol *reference* is snapshotted; the symbol's *label/audio* resolves from the global `symbols` table (and module source) at render, exactly as ADR-012 §7 does for pristine pack-sourced fields.

### 5. Delete + reinstall, with a hard installed-vs-user line

Modules can be deleted and reinstalled (reload already exists). Two rules keep it safe:

- **Installed modules** are deletable, reinstallable, and replaceable. **User content** — the user's own custom folders and authored sentences — is **never** touched by a module delete.
- **Reinstall = fresh copy.** If a user customised an installed module then deleted it, reinstalling brings a clean copy; the delete action **warns** that customisations to that module will be lost. (A restorable user-edit overlay is a later refinement, not V1.)

### 6. Provenance is metadata, not a browse axis

Author, version, and licence live as **metadata on each module** (and its lifecycle row), used for crediting (freelance translators, partner SLPs), filtering, and updates — **never** as a folder or browse dimension. This is what lets the three trees stay clean.

### 7. Soft suggest-on-save links between rhyming folders

A "Food" category and a "Talking about food" sentences folder *rhyme* but are **not** the same object. The relationship is **behavioural, not structural**: saving a sentence while working *in* a category **defaults the save target** to the matching sentences folder; the user can override. Context suggests; the user decides. Never a forced mirror.

### 8. Collections / Programs are deferred (V1 = none)

Curation — an SLP assembling a coherent *program* (these categories + these lists + these sentences) — is real value, but it is **explicitly out of V1**. The launch-prep decision (dossier [doc 8](../../2-research/gestalt-language-processing/08-phasing-and-rollout.md)) is to ship **four clean module types, no bundles** — fewer concepts, and effort spent on one well-made set rather than thin content "for a pack's sake."

When it returns, a **Collection / Program** is a **non-owning manifest**: a named pointer-list that installs *N* modules into their respective trees, then **dissolves** — the modules live independently and are removed individually. Because it owns nothing, adding it later is purely additive and breaks nothing.

---

## Migration & reconciliation

This ADR touches four prior decisions; here is how each reconciles.

- **ADR-010 (pack storage).** `library_packs/<slug>.json` **splits** into per-type module files. A one-time migration walks existing packs (`_starter`, `religion_faith`, `fun`, …) and emits `categories/*`, `lists/*`, `sentences/*` modules, preserving content. The old `library_packs` directory + `packLifecycle` follow ADR-010's own deferred-cleanup pattern (kept inert through cutover, dropped once the split is proven). JSON-source-of-truth + lifecycle overlay are **unchanged** — only the granularity of the file changes.
- **ADR-012 §7 (dynamic resolution).** Resolution currently keys on `librarySourceId` = pack slug (+ `librarySourceCategoryKey`). It becomes `librarySourceId` = **module slug** (+ item key). **Same reference model, new address.** Structure stays a per-account snapshot (AAC stability); pristine localised text still resolves live. The §4 sentence rule is a direct application of this.
- **ADR-013 (translator staging).** The `pack-copy` translation target generalises to **per-type module copy** (or simply operates on whichever module JSON, regardless of type). The translator workbench's three tabs are unaffected in spirit — they now point at module files rather than pack files.
- **ADR-011 (plugin pattern).** This ADR is that pattern's fourth/fifth/sixth application. Nothing in ADR-011 changes; this is the "future plugin types become a recipe" promise being cashed in.

---

## Consequences

- **The pack concept dissolves into four clean module types.** Categories, lists, sentences, themes — each a tab in the library, each installing into one tree. Languages remain a plugin too (admin-side).
- **Sentences become first-class, self-contained, decomposition-retaining objects** — the precondition for the sentence builder (Phase 14 / dossier doc 6).
- **In-app organisation matches how each content type is actually used** — semantic / procedural / pragmatic trees, instead of one bundle playing three roles.
- **A migration is required** to split existing packs into modules and re-point `librarySourceId`. It reuses ADR-010's migration machinery and ADR-012 §7's reference model; it is a one-time job, after which the model is self-consistent.
- **ADR-010's bundling is superseded; its storage model is preserved.** This is a granularity change, not an architecture reversal.
- **Curation is paid down to a deferred, non-owning manifest** — no bundle re-enters the owning/organisation layer.

---

## Alternatives considered

- **Keep packs as bundles; add a "browse by type" view on top (soft split).** Rejected: keeps the pack concept and its three-axes-in-one-bundle awkwardness, and leaves sentences as nested snapshot arrays — blocking the sentence builder. The presentation layer would lie about the storage layer.
- **Leave everything as-is.** Rejected: blocks both the three-tree organisation (doc 7) and first-class sentences (doc 6) — the two things the GLP product direction depends on.
- **Build the Collection/Program manifest now.** Rejected for V1: more concepts at launch for value (curated bundles) that one well-made default set doesn't yet need. Deferred, and safe to defer because it owns nothing.
- **Make sentences fully reference their symbols live (no structural snapshot).** Rejected: an upstream restructure could shift a child's saved sentence under them — unacceptable for AAC. Structure is snapshotted; only localised *text* resolves live (§4).

## Out of scope

- **The Collection / Program manifest** — deferred (§8); a later additive layer.
- **The GLP dataset content type + its submission tooling** — the morphology/inflection forms, core-word sets, and phrase-prediction data are a *new content type* that ADR-013 does not cover. It warrants its **own ADR**, modelled on ADR-013's staging pattern. (Build-plan Phase 17.)
- **The morphology/inflection engine, prediction, and keyboard** — Phase-2 features that *consume* this model but are not defined here.
- **Prod-side authoring via GitHub API** — still the ADR-010 future hook; unchanged.

## References

- [ADR-010](./ADR-010-pack-storage-shift.md) — pack JSON storage + lifecycle overlay (bundling superseded here; storage model preserved).
- [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) — the plugin pattern this ADR applies two more times.
- [ADR-012 §7](./ADR-012-language-operations-console.md) — dynamic resolution + per-field "borrowed vs yours"; the basis for §4.
- [ADR-013](./ADR-013-translator-editing-and-staging-area.md) — translator staging; `pack-copy` target generalises to module copy.
- [GLP dossier doc 6](../../2-research/gestalt-language-processing/06-sentence-builder-concept.md) — sentence builder / three-entity model.
- [GLP dossier doc 7](../../2-research/gestalt-language-processing/07-container-organisation.md) — three-tree organisation + type-aligned modules.
- [GLP dossier doc 8](../../2-research/gestalt-language-processing/08-phasing-and-rollout.md) — phasing; the V1-no-collections decision.

---

## Addendum (2026-06-25) — §4 "text live" scope, clarified during Phase 13 planning

§4 mandates "structure frozen · localised text live" and describes sentences as
embedding "symbol references" whose labels resolve live. Phase-13 planning against
the actual code clarified what this means in practice, so we record it here rather
than over-build:

- **List and sentence *slots* do not carry symbol *labels*.** A sentence's spoken
  output comes from its whole-sentence `text` field (used to generate TTS audio);
  symbols inside a sentence are only used at authoring time to *compose* that text
  and audio. `profileSentences.slots[]` / `profileLists.items[]` store an
  `imagePath` (+ display/audio paths) — there is no per-slot symbol label to
  resolve at render. So **no slot-level live-label resolution is needed, and no
  symbol-reference field is added to slots in Phase 13.**
- **§4's "text live" guarantee is carried by category symbol labels**, which
  already resolve live: `profileCategories.getProfileSymbolsWithImages` returns
  the full `label: Record<lang,string>` from the global `symbols` table, rendered
  via `displayString`. A new language reaches every category board automatically.
- **List/sentence *copy* (folder/list/sentence name, item descriptions, sentence
  text) remains a per-account snapshot** — acceptable because that copy is
  generated/custom, not symbol-label-derived. Phase 13 re-points `librarySourceId`
  to module slugs so live-copy resolution *could* be added later if ever wanted,
  but builds no such machinery now.
- **"Structure frozen" still holds**: the slot's `imagePath` is the structural
  snapshot; deleting any category never breaks a saved sentence.

Net: §4 is satisfied with no new resolution code — the live half is the existing
category-symbol-label path; the frozen half is the existing slot snapshot.
