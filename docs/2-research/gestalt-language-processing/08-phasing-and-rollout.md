# 8 · Phasing and rollout

*Captured 2026-06-23. The two-phase plan that turns the GLP dossier (docs 1–7) into a buildable sequence. Phase 1 prepares Mo Speech for launch with instant wins; Phase 2 is the longer, SLP-gated GLP surface. Plus the language-tiering reframe that resolves the "breadth vs depth" tension.*

---

## The split

| | Phase 1 — launch prep | Phase 2 — the GLP surface |
|---|---|---|
| **Goal** | Instant wins; ready Mo Speech for launch | Deep phrase/sentence construction within the GLP framework |
| **Timeline** | Doable now | Longer; needs careful planning + per-language SLP work |
| **Gated by** | Engineering effort | Native-SLP dataset construction |

Why this gives Mo Speech "a bit more scientific": Phase 2 grounds the app in a recognised clinical framework (GLP/NLA) — but only Phase 1 is needed to launch. **Don't let Phase 2 block the launch that's already on the home straight.**

---

## Phase 1 — instant wins (launch prep)

### Scope

| Item | What it is | Notes |
|---|---|---|
| **Pro & Max themes** | Build out the paid-tier themes | Straightforward; ties into existing theme system |
| **Bilingual symbols** | Per-symbol language override | Common case: board in Hindi, *some* symbols shown in English. The doc 4 feature #1 — cheapest win, delights the advising SLP |
| **Folder-tree refactor** | The three-tree IA from [doc 7](07-container-organisation.md) | Categories (semantic) · Lists (procedural) · Sentences (pragmatic) |
| **Soft link on save** | Saving a sentence from within a category suggests the matching sentences folder | Context suggests, user decides — never a forced mirror |
| **Sentence-builder spine** | Phrase units + sentences that keep their parts + read-only decomposition view | The MVP cut from [doc 6](06-sentence-builder-concept.md) |
| **Dropdown update** | Tab 1 = core words; further tabs = phrase banks | Replaces the half-formed "little words" idea |
| **Resource library = 4 tabs** | Categories · Lists · Sentences · Themes | Mirrors the install model — one tab per module type. **Note:** themes (and languages) are *already* their own plugin types per [ADR-011](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md), so this is half-built |
| **Translator QA interface** | The [ADR-013](../../4-builds/decisions/ADR-013-translator-editing-and-staging-area.md) freelancer workbench: scoped `translator` role reviews/corrects UI strings, pack copy & symbol words; you approve → it publishes | Pre-launch necessity ("languages native-checked before launch"). **Symbol-word approvals patch the `symbols` table directly**; JSON targets (UI strings, pack copy) need the deferred GitHub-App publish hook (ADR-010/012). Covers *translation* QA only — **not** the Phase-2 GLP dataset |

### Decisions locked for Phase 1

- **No collections/packs yet.** Focus on four distinct module types (categories, lists, sentences, themes) rather than curated bundles. Reasoning: fewer concepts is *less overwhelming* for users, and effort is better spent making **one well-thought-out set** than spreading content thin "for a pack's sake." Safe to defer because a collection *owns nothing* — adding it later is purely additive and breaks nothing.
- **Self-contained sentence modules.** Each sentence **embeds its own symbols**, so nothing disappears if the user deletes a related category or group. This is the deliberate choice of the "self-contained" strategy from [doc 7's dependency table](07-container-organisation.md) — it **closes the sentence→symbol dependency problem entirely.** Trade-off accepted: symbol duplication (a sentence keeps its own structural copy). Correct trade for the "nothing should disappear on the user" priority.
  - **⚠ Reconcile with [ADR-012 §7](../../4-builds/decisions/ADR-012-language-operations-console.md).** "Self-contained" must mean **structurally** self-contained — the sentence keeps its own symbol *references/snapshot* so it never breaks — **not text-frozen.** A sentence's localised *labels* must still **resolve live** per ADR-012 §7's pristine-field model, or we reintroduce the photocopy/staleness trap that ADR fought to escape (a newly-shipped language or translation fix must still flow into a saved sentence's display text). **Structure frozen, text live** — the two properties coexist.
- **Delete + reinstall is a supported flow.** Modules can be deleted and reinstalled (reload already exists). Two rules keep it safe:
  1. **Hard line between *installed modules* and *user content*.** Module-delete only ever removes installed modules — never the user's own folders or sentences.
  2. **Reinstall = fresh copy, warn on delete.** If a user customised an installed module then deletes it, reinstalling brings a clean copy; the delete action warns "your changes to this set will be lost." (Tracking user edits as a restorable overlay is a later refinement, not MVP.)
- **Life-skills lists are NOT a Phase 1 deliverable.** A complete life-skills lists library could take years and deserves its own release status — it is Tier-2 *content*, not a launch feature.

---

## Phase 2 — the GLP surface modifiers

The deep layer. Each item is gateable, so none of it complicates a family who just wants a simple board.

| Item | What it is | Status / note |
|---|---|---|
| **Inflection engine** | Hold-to-inflect: past/present/future tense, plurals, comparatives/superlatives, morphemes | One shared engine (doc 4) — store forms as data, don't generate |
| **Prediction text** | Probable-next-words surfaced from a dataset | Curated, not ML, for the first version |
| **TTS tone** | Multiple intonations of the same utterance | Prototype the TTS-prosody path before recording variants (doc 4 #4) |
| **Keyboard page** | Type-and-speak free composition | Self-contained, gateable (doc 4 #7) |
| **Auto-navigation** | Phrase jumps the user to the relevant category | **Deferred — likely too jarring.** Research how other AAC programs handle this before building. Motor-planning concerns from [doc 3](03-glp-and-aac.md) |

### The bottleneck: the per-language dataset

The most important and most time-consuming part of Phase 2 is **the dataset** — the inflected forms, core-word set, and phrase-and-prediction data that power the inflection engine and the sentence builder. It **must be constructed by a language-specific SLP**, not auto-generated, because morphology (especially in Hindi — gender, aspect, case) and natural phrase prediction are linguistic judgement calls.

- **English + Hindi first** — the advising SLP can build both.
- **The first dataset will be the hardest** — it sets the template and tooling for the rest.
- This is *content* work distinct from code, and it is the true pacing constraint on Phase 2.

---

## The language-tiering reframe

The dataset realisation has a big strategic consequence: **"a complete language" is no longer one thing.** It is three layers of completeness, each with a different cost and gatekeeper:

| Tier | What it means | Cost / gatekeeper | Reach |
|---|---|---|---|
| **Tier 0 · UI localized** | App interface translated | Automated translation pipeline | Many languages, fast |
| **Tier 1 · Vocabulary localized** | Symbol labels + audio, native-reviewed | Native-speaker reviewers | A usable board |
| **Tier 2 · GLP-complete** | SLP-built dataset: inflections, core words, predictions | Native SLP | Few languages, slow |

> **⚠ Naming reconciliation (important — don't invent parallel vocabulary).** These *completeness* tiers are a simplification of terms already in the ADRs:
> - They map onto the language **lifecycle** `machine-translated → beta → stable` ([ADR-009](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md)): Tier 0/1 ≈ machine-translated/beta, Tier 2 ≈ stable.
> - "Fully made" is precisely the **eight ingredients** defined in [ADR-012](../../4-builds/decisions/ADR-012-language-operations-console.md). So **Tier 2 = the eight ingredients *plus* the GLP dataset** — the dataset is effectively a **new ninth ingredient** the ADRs don't yet list.
> - They are **not** the user **entitlement** tiers. [ADR-011 §3 (amended)](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md) made language access a **boolean**: Free = 1 language, Pro/Max = all. **Completeness ≠ entitlement.**

**This resolves the "race to many languages vs depth per language" tension** — they're not competing, because they're different tiers, not the same finish line:

- **Breadth** still moves fast at **Tier 0/1** — a language can launch and be genuinely useful as a board while its Tier-2 dataset doesn't exist yet.
- **Depth** rolls out slowly at **Tier 2**, per-language, SLP-gated. English and Hindi are the first two.
- A language is never "blocked" — it ships at Tier 1 and *grows* to Tier 2 when an SLP builds its dataset.

**Implication for launch:** launch languages need **Tier 1** (usable boards) plus the **Phase 1 features**. Tier 2 / Phase 2 follows after launch, language by language. The earlier instinct to "translate as many languages as possible as fast as possible" is still valid — just re-scoped to *Tier 1 breadth*, with *Tier 2 depth* as a separate, slower track.

---

## What this means for launch

- **Launch = Phase 1 features + Tier-1 languages.** Nothing in Phase 2 is a launch blocker.
- **The advising SLP is the critical path for depth.** Keep her engaged — she is both the Tier-2 dataset builder (English + Hindi) and the clinical validator.
- **Each Phase 1 item can graduate independently** into a feature spec under `docs/4-builds/features/`; the IA/module model (doc 7) is architectural enough to warrant an ADR under `docs/4-builds/decisions/`.

## Suggested Phase 1 order (non-binding)

1. **Folder-tree refactor + 4-tab resource library** — the foundation everything else files into.
2. **Bilingual symbols** — cheap, high-delight, validates direction with the SLP.
3. **Sentence-builder spine + dropdown (core words / phrase banks)** — the demoable GLP story.
4. **Pro & Max themes** — parallel track, independent of the above.
5. **Delete/reinstall polish** — once the module/tree model is in place.

---

## Relationship to existing ADRs

This dossier was written from the GLP/product angle; a chunk of the infrastructure it assumes is *already decided* in `docs/4-builds/decisions/`. Reconciliation map, so nothing here contradicts a locked decision unknowingly:

| Dossier idea | Existing ADR | Status of fit |
|---|---|---|
| Freelancer translation/correction interface | [ADR-013](../../4-builds/decisions/ADR-013-translator-editing-and-staging-area.md) — translator editing & staging | **Already specified.** `translationSuggestions` staging table, scoped `translator` role, suggest→approve→publish. Symbol words patch the table directly; JSON targets need the deferred GitHub-App hook |
| Admin approval / review queue | [ADR-012 §1b](../../4-builds/decisions/ADR-012-language-operations-console.md) | Already a stage on the per-language ops console |
| Three trees / type-aligned modules / "kill packs" | [ADR-010](../../4-builds/decisions/ADR-010-pack-storage-shift.md) (pack JSON), [ADR-011](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md) (plugin pattern) | **Needs a new ADR.** The plugin pattern *supports* per-type modules (themes & languages already are), but `library_packs` currently bundles categories+lists+sentences, and resolution/translation/lifecycle key on the pack slug. Splitting is a **supersede** of parts of ADR-010, touching 011/012/013 |
| Self-contained sentences | [ADR-012 §7](../../4-builds/decisions/ADR-012-language-operations-console.md) (dynamic resolution) | **Tension to resolve.** Structure self-contained = fine; text must still resolve live (see Phase 1 decisions above) |
| Completeness tiers | [ADR-009](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md) lifecycle + [ADR-012](../../4-builds/decisions/ADR-012-language-operations-console.md) eight ingredients | Reconciled above — map onto lifecycle; GLP dataset = a ninth ingredient |
| GLP dataset submission tooling | *(none yet)* | ADR-013 covers *translation* QA only. The Phase-2 morphology/prediction dataset needs **its own submission tooling**, best modelled on ADR-013's staging pattern — a future ADR |

**Two ADRs to write when this leaves brainstorm:** (1) the **module + three-tree model** (supersedes ADR-010's pack bundling); (2) the **GLP dataset content type + its submission/approval tooling** (extends the ADR-013 pattern to a new, non-translation content type).

---

**Dossier map:** [doc 4](04-glp-in-mo-speech.md) = features · [doc 6](06-sentence-builder-concept.md) = unit/sentence structure · [doc 7](07-container-organisation.md) = organisation/install · **doc 8 (this) = phasing + language tiers.** When Phase 1 starts, graduate items into `docs/4-builds/`.
