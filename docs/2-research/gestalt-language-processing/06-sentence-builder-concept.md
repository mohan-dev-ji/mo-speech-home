# 6 · The sentence builder — a concept emerging from GLP

*Captured 2026-06-23 from a brainstorm. Not a spec — a recording of a direction, so the thinking isn't lost to a chat log. The seed of a future feature under `docs/4-builds/features/`.*

---

## Where this came from

After reading the GLP dossier (docs 1–5), the connection to Mo Speech's **existing** architecture clicked. The app already has the raw pieces:

- **Sentences** — built from symbols, treated as fully-formed. Sometimes a single symbol acts as a whole phrase.
- **Search page** — find individual symbols, save them into categories.
- **Talker dropdown** — deliberately under-built. A "portable briefcase of symbols" whose exact job was never decided.
- **Little words** — a half-formed idea; the plan was to mine Proloquo for what repeats on every page.
- **Lists / sentences / categories / custom groups** — storage that has grown tangled and needs tidying.

The realisation: these aren't five separate systems that happen to coexist. Read through GLP, they're the **components of a single sentence builder** that lets a child move between whole chunks and individual words — in *both* directions. This doc records that synthesis.

## The core insight: mitigation as a UI

The most important idea is deceptively small:

> **Save a sentence, but keep its sections.** Don't flatten it to a string of text — store it as the ordered units it was built from, so the child (and instructor) can always see how it breaks down and builds up.

A saved sentence that remembers it is `[Let's go] + [to] + [the park]` is a record of a chunk *and* its parts, side by side. In GLP terms (see [doc 2](02-the-six-stages.md)) that is **Stage 2 mitigation** — the break-down-and-recombine pivot of the whole journey — turned into a persistent object the child can revisit and an instructor can model with.

## The bidirectional differentiator

Because the structure is never discarded, the same sentence object can be entered from **either end**:

- A **gestalt** learner travels *top-down* (the left arrow in the diagram below): tap a whole phrase, then break it open into its words.
- An **analytic** learner travels *bottom-up* (the right arrow): pick words, build them into a phrase, then a sentence.

```
        SENTENCE          [ phrase | word | phrase ]   ← saved with its breakdown
   break    ▲   build
   down     │   up           PHRASE     a chunk / gestalt (may be one symbol)
  (gestalt) │  (analytic)
   top-down │  bottom-up   WORD / SYMBOL   core words + category symbols

            The Talker builds either way · Save keeps every section
```

**Same mechanism, same decomposition view, both learner types.** Most AAC tools pick a side (PODD leans gestalt/phrase; LAMP leans analytic/core-word). Serving both with one mechanism is Mo Speech's sharpest potential differentiator — and a cleaner pitch to an SLP than any single feature on the original list of seven.

## The three-entity data model

The current tangle (sentences vs lists vs little-words vs categories vs custom groups) dissolves into three entities:

### Unit
The atom of the system. A **unit** is either a word/symbol *or* a phrase.

- **A phrase is just a unit that may carry a *decomposition*** — the ordered words inside it.
- The "one symbol = a whole phrase" case is **not an exception**: it's a phrase whose decomposition hasn't been filled in yet. **Mitigation is literally the act of filling it in.** This is an elegant fit — the data model mirrors the clinical process.
- A phrase also optionally carries:
  - **probable next-words** (the prediction set), and
  - a **navigation target** (the category to jump to).

### Sentence
An **ordered list of units that keeps its parts.** It never collapses to a flat text string. Because the structure survives, the build-up / break-down view costs nothing to render — the parts were always there.

### Container
**Categories and custom groups are the same kind of thing: containers.** A container can hold *any* unit — symbols, phrases, and saved sentences alike. The proposed "categories sentence folder" is simply a container that holds sentences.

> **The tidy-up this unlocks:** "lists," "sentences," and "little words" stop being three separate systems and become *what a container holds*. One organising model instead of three.

## The core / fringe vocabulary layer

The instinct to "mine Proloquo for what repeats on every page" has an established name, which saves the manual audit:

- **Core vocabulary** — ~200 high-frequency words usable almost everywhere (`want, go, more, stop, that, it, not, you, my, on`). Robust AAC pins these in **fixed positions on every page** for motor-planning stability.
- **Fringe vocabulary** — topic-specific words (`elephant, pizza, slide`), which live in categories.

The current "little words" are a half-formed core layer. The principle to adopt (not the grid to copy):

- **Dropdown Tab 1 = core** — always present, always in the same place.
- **Remaining dropdown tabs = phrase banks** — reusable gestalts that can be inserted into the Talker *and* trigger prediction / navigation. (These aren't alternative uses — a phrase in the dropdown does both.)
- **Category symbols = fringe** — navigated to, and surfaced via a phrase's prediction set.

## The construction loop

Putting it together, the intended flow:

1. **Navigate** via search and categories to find symbols.
2. **Construct** in the Talker, using the dropdown (core words + phrase banks) to assemble units.
3. A phrase can **trigger prediction** (probable next-words) and **auto-navigate** to the category holding the next word.
4. **Save** — the sentence is stored, but **retains every section**, so it can be revisited as a model of how language breaks down and builds up.
5. **File** the saved sentence into a container (category / custom group).

## The three hard decisions

These are the load-bearing calls — flagged now so they're made deliberately, not by default.

1. **Where does the prediction data come from?** "Phrases with most-probable next words" is a **dataset per language** — recurring *content* work, tied to the native-speaker reviewers already lined up. For launch, the realistic version is **curated** (instructor/author hand-sets a phrase's next-words), not statistical or ML. Be honest that "predictive" here means "authored," not "automatic." A Hindi phrase-and-prediction dataset is its own small project, distinct from the code.

2. **Auto-navigation vs motor planning.** Phrases that jump the user to a category are useful, but every auto-jump risks disorienting a user whose competence comes from *knowing where things live* (see [doc 3](03-glp-and-aac.md)). Two guardrails:
   - **Predictable** — the same phrase always lands in the same place.
   - **Return path** — always an obvious way back. Auto-nav should feel like a shortcut, never like the floor moving.

3. **Decomposition is for modelling, not testing.** "So the user can learn to break down and build up" is the right intent — but GLP (and the evidence caution in [doc 5](05-evidence-and-references.md)) is emphatic: **expose and model, never quiz.** The decomposition view exists for the child to *see* and the instructor to *model with*, not as a fill-in-the-blanks exercise. Guard this in the UX copy — "see how this was built," not "now build it yourself."

## The MVP cut

This is a v2 vision and a strong one — but it must not swallow the launch that's already on the home straight. The **smallest version that delivers the whole loop**:

- **Phrase** as a first-class unit, with an optional decomposition.
- **Sentence** that retains its parts + a **read-only** decomposition view.
- **Dropdown Tab 1** = a fixed core-word set.

That alone tells the complete GLP build-up / break-down story and is demo-able to the advising SLP. Everything else is gateable phase-two:

| Phase | Feature |
|---|---|
| **MVP (the spine)** | Phrase units · sentences that keep their parts · read-only decomposition view · core-word dropdown tab |
| **Phase 2 (the intelligence)** | Curated next-word prediction · auto-navigation · phrase banks in dropdown tabs |
| **Phase 2+ (per-language depth)** | Prediction/morphology datasets per language · richer phrase libraries |

Ship the spine; layer the intelligence later. Each phase-two piece is independently gateable, so none of it complicates the experience of a family who just wants a simple board.

## How this connects to the rest of the dossier

- The **morphology engine** ([doc 4](04-glp-in-mo-speech.md)) — hold-to-inflect for tense / plurals / comparatives — is the *unit-level* counterpart to this *sentence-level* builder. Both are "long-press a thing to reveal its related forms / parts." Worth keeping the gesture consistent across both.
- The **per-language dataset** need shows up twice — once for morphology (inflected forms) and once here (phrase predictions). They may share authoring tooling and the same native-speaker reviewers. Worth designing the content pipeline once.
- This stays firmly inside the **one-app** decision ([doc 4](04-glp-in-mo-speech.md)): the sentence builder is core communication depth, gated, serving home and (future) classroom learners alike.

---

**Status:** brainstorm captured. When a direction here firms up, graduate it into a feature spec under `docs/4-builds/features/` (start with the MVP spine) and, if it changes architecture, an ADR under `docs/4-builds/decisions/`.
