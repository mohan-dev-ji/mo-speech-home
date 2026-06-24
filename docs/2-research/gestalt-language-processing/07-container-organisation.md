# 7 · Container organisation — trees, modules, and provenance

*Captured 2026-06-23 from a brainstorm. The current model for how Mo Speech organises its content and how the resource library installs into it. Supersedes the "packs as provenance tags" idea floated earlier in the same conversation.*

---

## The problem this solves

Mo Speech has three kinds of content — **symbols**, **lists** (task analyses / sequences), and **sentences** (saved compositions) — plus **themes**. The current build sorts symbols cleanly into category folders, but **packs** were grouped *as category items* even though a pack also contains lists and sentences. That felt like "a stretch," and it was. This doc works out why, and proposes a cleaner structure.

Two questions get answered:
1. How should the in-app folders be organised?
2. How should the resource library install content into them?

## Part 1 — Three trees, three axes

The reason cramming lists and sentences into the symbol categories feels wrong is that **the three content types are organised along three different axes:**

| Content type | Organising axis | Example folders |
|---|---|---|
| **Symbols** | **Semantic** — by topic / meaning | Food · Animals · Body |
| **Lists** | **Procedural** — by lesson / skill | Life skills · Lesson 01 · Morning routine |
| **Sentences** | **Pragmatic** — by communicative situation | Talking about food · Asking for help · At the shop |

This is a real AAC distinction, not a quirk of the app: PODD organises *pragmatically* (by what you're trying to do), Proloquo organises *semantically* (by topic). Mo Speech needs both logics at once — so they can't share one tree.

**Decision: three separate container trees, one per content type, each on its own axis.** Forcing one tree to serve three organising logics is the root of the "stretch."

### Shared mechanism, separate trees

This refines [doc 6](06-sentence-builder-concept.md), which said "categories and custom groups are the same kind of thing — a container can hold any unit." That is true at the **data layer** (a folder is a folder; the storage primitive is shared) but misleading at the **organisation layer**, where separation is correct. The precise statement:

- **One folder primitive under the hood; three distinct trees on top.**
- Each tree has **default folders** (installed content) *and* the user's own **custom folders**.
- A **list and a sentence are the same data shape** — an ordered composition of units that keeps its parts (doc 6's *Sentence* entity) — differing only by *type* (utterance vs task-analysis) and which tree they file into. Separate organisation, shared engine.

### Soft links, not forced mirrors

A "Food" symbol category and a "Talking about food" sentences folder *rhyme* but must not be the same object. Keep the relationship **soft and behavioural**:

> When a user saves a sentence while working *in* the Food category, default the save target to the matching sentences folder — but let them override.

Context *suggests*; the user *decides*. You get clustering without the rigidity of one-tree-mirrors-another.

## Part 2 — Type-aligned modules (kill the pack)

The original "pack" was a single installable bundle that spanned all three content types — which is exactly what forced it to be mapped awkwardly onto categories. The cleaner model:

**A module is the atomic installable unit. It is single-type and installs into exactly one tree.**

- A **Category module** → the Categories tree
- A **List module** → the Lists tree
- A **Sentence module** → the Sentences tree
- A **Theme module** → the theme picker

One module → one tree, 1:1. There is nothing cross-cutting left to reason about — the provenance-vs-organisation tension simply doesn't arise, because no installable thing spans trees.

### Why this is cleaner than packs

- **The library mirrors the app.** What you browse by type in the library is what lands in the matching tree.
- **Granular control, less bloat.** Take "Talking about food" sentences without being forced to install a whole Food category you've already customised.
- **Themes stop being special** — they become just another module type. The fact that they slot in trivially is a good signal the model is sound.

## Part 3 — Curation survives as a non-owning "Collection"

The one genuine value a pack carried was **curation**: an SLP or curriculum designer assembling a *coherent program* — these symbols + this task-analysis list + these sentences, meant to work together. Pure atomisation would lose the "install the whole toileting program in one tap" experience.

So don't delete bundling — **demote it to a manifest:**

> A **Collection / Program** is a named pointer-list: "install these N modules." One click installs them into their respective trees, then the collection **dissolves** — the modules live independently and are removed individually.

A collection **owns nothing**. It is a convenience and discovery layer, not a container. The library can offer *both* "browse by type" and "browse curated programs," where programs are just manifests over the same modules. This buys back curated discovery without re-introducing a container that spans trees — the same separation-of-concerns move applied one level up.

## Part 4 — The one real cost: cross-type dependencies

This is the trade-off to enter with eyes open. **Sentences are made of symbols, so a sentence module depends on its symbols existing.** The pack model solved this silently by bundling dependencies. Atomise by type and you can now install "Talking about food" sentences *without* the food symbols — and get broken references.

A dependency strategy must be chosen explicitly:

| Strategy | How it works | Trade-off |
|---|---|---|
| **Declare + prompt** | Sentence module lists required symbols; library nudges "also install Food category" | Cleanest UX, most work |
| **Self-contained** | Module embeds copies of the symbols it needs | Works standalone, duplicates symbols |
| **Graceful degradation** | Install anyway; missing symbols fall back to text/placeholder | Simplest, degraded look |
| **Lean on core vocab** | An always-present core word set resolves most sentences; only fringe nouns need handling | Depends on core layer existing (see doc 6) |

**Recommended:** *declare-and-prompt, backed by an always-present core set.* Critically — making this dependency **explicit is better than the pack model hiding it.** Hidden dependencies are how broken content ships later.

## Part 5 — Provenance becomes metadata

With modules, provenance (who authored this, which collection, version, licence) doesn't vanish — it stops being a **browse axis** and becomes **metadata on each module**. That's where it belongs: useful for crediting authors (your freelance translators, partner SLPs), filtering, and pushing updates — and invisible to the organisation the user actually navigates.

## Summary of decisions

1. **Three container trees**, one per content type, each on its natural axis (semantic / procedural / pragmatic). Shared folder primitive, separate trees.
2. **Each tree holds default folders + user custom folders.**
3. **Soft, behavioural links** between rhyming folders (suggest-on-save), never forced mirrors.
4. **Type-aligned modules** are the installable primitive: one module → one tree.
5. **Collections/Programs** are non-owning manifests for curated one-click installs.
6. **A dependency strategy is mandatory** for sentence→symbol references — recommend declare-and-prompt + core set.
7. **Provenance is metadata**, not organisation.

## Open decisions parked (not for MVP)

- **Nesting depth.** "Lesson 01" hints at eventual *Curriculum › Lesson* nesting in the Lists tree. Resist nesting for MVP — one level + metadata covers a lot.
- **Inter-list ordering.** Lists are the most curriculum-shaped type and may later want sequencing *between* lists (Lesson 01 → 02). Flag, don't build.
- **Collection updates.** If a collection's author ships v2, how do already-installed independent modules learn about it? A later concern, tied to provenance metadata.

---

**Relationship to the rest of the dossier:** this is the *organisation* layer; [doc 6](06-sentence-builder-concept.md) is the *unit/composition* layer; [doc 4](04-glp-in-mo-speech.md) is the *feature* layer (morphology engine, the seven non-negotiables). All three stay inside the one-app decision.

**⚠ Relationship to existing ADRs (read before building this).** The "kill packs → type-aligned modules" decision here is *directionally consistent* with the plugin pattern in [ADR-011](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md) (themes and languages are already their own plugin types) — but it is **not** a small refactor. Today `library_packs/<slug>.json` ([ADR-010](../../4-builds/decisions/ADR-010-pack-storage-shift.md)) bundles categories + lists + sentences in one file, and the live text resolution ([ADR-012 §7](../../4-builds/decisions/ADR-012-language-operations-console.md), keyed on `librarySourceId` = pack slug), the translation target ([ADR-013](../../4-builds/decisions/ADR-013-translator-editing-and-staging-area.md) `pack-copy`), and the lifecycle overlay all key on that pack. Splitting packs into per-type modules therefore **supersedes parts of ADR-010 and touches 011/012/013**, and warrants its **own ADR** rather than an inline change. See the reconciliation table in [doc 8](08-phasing-and-rollout.md#relationship-to-existing-adrs).
