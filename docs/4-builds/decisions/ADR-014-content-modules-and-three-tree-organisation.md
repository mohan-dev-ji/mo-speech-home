# ADR-014 — Content Modules & Three-Tree Organisation

Date: 2026-06-24
Status: Accepted

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

---

## Addendum (2026-06-27) — module content lives in Convex, not committed JSON

§1 inherited ADR-010/011's storage model: module content as committed JSON files
(`convex/data/<tree>/<slug>.json`), bundled at deploy, with a Convex `*Lifecycle`
overlay for publish-window + tier. During Phase 13.4 (curation pipeline) the owner
and Claude re-examined this and decided to **make Convex the single source of
truth for curated/default module content.** This supersedes the *storage
substrate* of §1 for the module system; it does **not** change the conceptual
model — modules, three trees, 1:1 install, lifecycle visibility, delete/reinstall
all stand. Only *where the template lives and how it is published* changes.

### Why
The JSON-as-source approach has two real benefits — git-versioned content and a
zero-cost bundled catalogue — but both are weak at module scale and outweighed by
its costs:

- **Publish is dev-only.** Writing a committed JSON file requires the dev server
  running on the author's own machine plus a git commit + deploy per change. It
  cannot be done in production or by a non-technical curator — a hard blocker for
  the ADR-013 SLP-contributor direction.
- **Scale.** A growing catalogue inflates the deploy bundle and is loaded into
  function memory; more languages ship in every file always. A Convex table is
  indexed, paginated, and can project a single locale. The four scale axes that
  track growth — catalogue size, languages, contributor throughput, live updates
  — all favour the database. JSON wins only on read-cost (cacheable; the catalogue
  query is already SSR-cached) and reproducibility (recovered below).
- **Live updates.** A content fix in Convex is live on reload; in JSON it needs a
  redeploy.

The "git-reviewable translation diffs" benefit is preserved another way (below),
and the genuinely irreplaceable translated asset — the global `symbols` table
(52k rows) — already lives in Convex with its own git-committed `.jsonl` backup,
unaffected by this decision.

### The decision, three parts
1. **Convex is the live source of truth for curated/default module content.** A
   table (working name `libraryModules`) holds each module as a row in the
   `ContentModule` shape (`convex/data/_shared/types.ts`) with the lifecycle
   fields merged in (`publishedAt`, `expiresAt`, `tierOverride`/`defaultTier`,
   `featured`, `provenance`, `tree`, `slug`). Catalogue / detail / install reads
   query this table; **publish is an admin mutation** that upserts a row — works
   in production, by any admin, no commit, no deploy.
2. **Translations are surgical and idempotent**, so a re-run can never silently
   rewrite everything (the failure mode that would also destroy JSON's diff
   value). Each translatable string is keyed by a hash of its English source; a
   run only (re)translates a locale value that is *missing* or whose source hash
   changed, and never overwrites a good existing translation. This mirrors the
   UI-string pipeline rule (translate only keys absent from a locale) and is the
   property that makes database storage safe for translated content.
3. **Periodic export to committed JSON** preserves the audit trail and
   reproducibility without coupling content to deploys — the same snapshot-to-git
   discipline already used for `symbols` (`scripts/backup-symbols.mjs`). A small
   exporter dumps `libraryModules` to `convex/data/<tree>/<slug>.json` (stable
   key order) on demand / at milestones; these files become a *backup + review
   artifact*, not the live source.

### Scope — what changes, what stays
- **Changes (module content layer only):** the readers in
  `convex/lib/contentModules.ts` (bundled-map lookups → Convex table reads, so
  they take `ctx` and become async; all callers are inside Convex functions and
  can pass it); the per-type public catalogue + `getModuleDetail` queries (query
  the table + visibility filter); the install mutations (`getModuleBySlug` → table
  read); the themed-pack conversion + `publishConvertedPackModules` (replaced by a
  one-time seed of the existing 17 converted modules + the new `core` categories
  module into the table); and curation publish (FS-write route →
  upsert mutation).
- **Unchanged:** install/materialise into per-account `profile*` rows, the
  three-tree UI, the four-tab library, delete/reinstall + R2 orphan cleanup,
  breadcrumbs, the `_defaults` manifest concept (now a small table or committed
  list of `{tree, slug}` refs; `seedDefaultAccount` iterates it →
  `installContentModule`). These copy from a *template* and are indifferent to
  whether the template is a file or a row.
- **Themes are the principled exception — not moved.** Theme *tokens* are design
  assets, not translatable curated content: no AI translation, no per-account
  materialise, a small designer-authored set, and they must be **bundled
  client-side** so `ThemeContext` applies CSS variables instantly with no
  round-trip/flash. Their visibility (`themeLifecycle`) is already in Convex. The
  built-in theme tokens stay in the bundled registry (`lib/themes/registry`);
  only future *user-created* themes would live per-account in Convex.
- **Legacy `library_packs/` JSON stays inert** as ADR-014 already planned — not
  migrated, dropped in a later cleanup.

### Consequences
- Gain: production publishing, contributor-ready curation, live content updates,
  a catalogue that scales in size + languages, and the deletion of the only
  genuinely unusual part of the design (dev-only file writes).
- Cost: module-content changes are no longer a git diff *by default* — recovered
  via part 3 (periodic export) for the rare moments review/rollback is wanted.
  Curated content now lives in the Convex deployment, so it must be covered by the
  backup discipline (`npx convex export`) — already standard practice here.
- This is contained to the module storage layer; it does not touch the
  per-account content model or any shipped UI.
