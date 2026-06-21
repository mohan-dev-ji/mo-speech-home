# 4 · GLP in Mo Speech — translating theory into product

*The doc that should change how you think about the build. Where GLP fits Mo Speech's existing architecture, the seven non-negotiables mapped to concrete features, and what it means for the "one app or two" crossroads.*

---

## The headline: you are already most of the way there

Mo Speech's central design bet — **instructors gate pages and functionality to make the app as simple or complex as each learner needs** — is, almost by accident, a near-perfect match for GLP. The whole NLA framework is about *meeting a child at their stage and revealing the next one when they're ready*. That is gating, expressed as pedagogy.

Where a robust competitor like Avaz exposes all six stages of capability at once (and overwhelms families), Mo Speech can expose **exactly the rung the child is on** and let the instructor unlock the next. Same depth, revealed gradually. This isn't a feature you need to bolt on — it's the thing you already built, viewed through a clinical lens.

So the work ahead is less "re-architect for GLP" and more "add a grammar/phrase layer, and make sure the gating maps cleanly onto the stages."

## A mental model: the "stage dial"

Imagine each student profile having an implicit (or explicit) **stage setting** that the instructor controls, shaping what the board emphasises:

- **Early (Stages 1–2):** Big, whole-phrase tiles. Rich custom audio. Few words visible. Predictive "mix" zone appears as the child starts modifying phrases.
- **Middle (Stages 3–4):** Phrases *and* words coexist. Hold-to-inflect (tense, plurals) switched on. Core-word grids unlock.
- **Late (Stages 5–6):** Full grammar tools, comparatives, connectors, WH-questions — and the **keyboard** becomes available for free composition.

You don't have to literally build a "stage dial" UI. But it's a useful spine for deciding *which gating toggles exist* and *what each one reveals*. It also gives instructors (and the SLPs you're courting) a vocabulary they already know.

## The seven non-negotiables, mapped

For each: what it is, how it fits GLP, rough effort, and how it lands in Mo Speech's existing pieces (themes, categories, the Symbol Editor, the language system, custom audio).

### 1. Retain English words in a Hindi board *(bilingual / code-switching)*
- **What:** Some symbols keep their English label/audio even when the board is set to Hindi.
- **GLP link:** Orthogonal to GLP — this is bilingualism. But it's real and standard: multilingual families code-switch, and forcing a single language is clinically wrong for them.
- **Effort:** **Low–medium.** You already have a per-symbol language system and a Symbol Editor. This is a per-symbol "language override" flag (label + audio) rather than a new subsystem.
- **Why do it first:** Smallest lift, delights the exact SLP who gave you the list, and validates the whole direction with her. Strong candidate for your first post-launch win.

### 2. Hold-to-inflect: past / present / future tense
- **What:** Long-press a verb symbol → tense options surface (go / went / going / will go).
- **GLP link:** **Stage 4.** This is where tense naturally emerges.
- **Effort:** **Medium, language-dependent.** English is regular-ish; **Hindi tense interacts with gender and aspect**, so the data model must hold inflected forms, not generate them naively. Needs a small morphology data design before coding (see the morphology note below).
- **Mo Speech fit:** A long-press affordance on a symbol tile, opening an inflection popover. The forms live as structured data on the symbol, each with its own audio.

### 3. Morphemes, adjectives, comparatives, superlatives
- **What:** big / bigger / biggest; happy / happier. Grammatical modification of words.
- **GLP link:** **Stage 5.**
- **Effort:** **Medium.** Same machinery as tense — it's all *morphological inflection*. Build the inflection system once; tense, plurals, and comparatives are all instances of it.
- **Mo Speech fit:** Same hold-to-inflect popover pattern, different axis.

### 4. Convey tone *(multiple audio versions)*
- **What:** The same word/phrase available in more than one intonation (excited, asking, calm).
- **GLP link:** **Stage 1 — the most clinically load-bearing of all.** Meaning lives in the melody. A flat voice strips an early gestalt of its content.
- **Effort:** **Medium–high, and a genuine prep gap** (you noted this yourself). Two possible paths:
  - **Pre-recorded variants** — instructor records the same phrase a few ways. Maximum fidelity, heavy authoring burden, storage cost (watch your Convex egress/storage budget).
  - **TTS prosody parameters** — modern TTS can vary pitch/rate/emphasis or take SSML/style hints. Far cheaper to author and store; lower fidelity than a human.
- **Recommendation:** Don't block launch on this. When you tackle it, prototype the **TTS-prosody** path first — it's cheaper and may be "good enough," and only fall back to recorded variants for the handful of phrases that truly need a human melody. Ties into your existing custom-audio pipeline.

### 5. GLP predictive navigation *(jump to a page where words pop up)*
- **What:** Tap/hold a phrase → a zone of suggested next-words / fragments appears so the child can mix and recombine.
- **GLP link:** **Stage 2 (mitigation) — the single most GLP-specific feature.** It's the bridge from "echo whole phrases" to "build my own."
- **Effort:** **Medium–high; needs design before code.** Key constraint from [doc 3](03-glp-and-aac.md): predictions go in a **dedicated zone** and must **not reshuffle anchor vocabulary** (motor planning). This is a navigation/IA problem more than an algorithm problem — start simple (curated next-words per phrase, set by the instructor) before anything "smart."
- **Mo Speech fit:** A new board region + a relationship in the data model linking a phrase to its likely fragments/next-words.

### 6. Plurals for nouns
- **What:** cat / cats; long-press a noun for its plural.
- **GLP link:** **Stage 4.**
- **Effort:** **Low–medium** — another instance of the shared inflection system (#2/#3). In Hindi, plural marking again interacts with gender/case, so it's data, not a rule.

### 7. Keyboard page to type and play
- **What:** A typeable text field with speak-aloud.
- **GLP link:** **Stage 6 — free composition**, but with a profound twist for *your* mission (below).
- **Effort:** **Medium, high value.** Self-contained; gateable; pairs beautifully with word prediction later.
- **Mo Speech fit:** A new gated "page type" alongside category pages.

## The morphology engine: build it once

Notice that #2 (tense), #3 (comparatives/morphemes), and #6 (plurals) are **the same capability**: take a base word, surface its inflected forms. Build **one inflection system** — a data model where a symbol can carry a small set of related forms, each with label + audio + a "form type" (tense/plural/comparative) — and all three non-negotiables fall out of it.

Two design rules for that engine, both from this research:
1. **Store forms as data, don't generate them.** Especially in Hindi, where inflection tangles with gender, case and aspect. Native-speaker review (you already have reviewers lined up) should produce the forms; the app just stores and surfaces them.
2. **Surface them via one consistent gesture** (long-press → popover). Consistency *is* motor planning. The child learns "hold a word to get its family" once, and it works everywhere.

This reframes the bulk of the SLP's list from "six features" into **one well-scoped engine + one custom-audio enhancement + one keyboard page + one bilingual flag.** Much more tractable.

## What this means for the "one app or two" crossroads

This research resolves the question you raised, fairly firmly:

**Keep it one app.** Every GLP feature above improves the *communication surface itself* and serves a non-verbal child at home as much as one in a classroom. None of them is a "school" feature. The thing that might *still* justify a separate "Mo Speech School" is purely the **management layer** — one teacher overseeing a roster of 30, caseload dashboards, IEP/goal tracking — which is Axis 2, a different decision, to be driven by real demand rather than pre-built on a guess.

And the deepest reason to keep it one app is the most human one:

> **A non-verbal beginner cannot tell you they're ready for the keyboard.**

You said this yourself, and GLP gives it teeth. The entire framework is the story of a child travelling from echoed chunks to self-generated language — *and you often can't see how far they can go until the tool lets them try.* A child gated to four phrase-tiles might be quietly ready for Stage 6. If "Home" and "School" are separate apps with separate capability ceilings, you risk capping a child by the *label on their account* rather than their actual potential. One app, with gating that *opens upward* as the child reveals readiness, is not just simpler engineering — it's the ethically correct shape for an AAC tool. Your architecture already embodies this. GLP is the clinical argument for why it's right.

## A sane sequencing (post-launch, non-binding)

1. **Bilingual word override (#1)** — cheap, delights your SLP, validates direction.
2. **Keyboard page (#7)** — self-contained, high value, directly serves the "what if they take to it" insight.
3. **The morphology engine (#2 + #3 + #6)** — one build, three features. Design doc first; native-speaker data second; UI third.
4. **Predictive mitigation navigation (#5)** — design-heavy; start with instructor-curated next-words.
5. **Tone / prosody (#4)** — last; prototype the TTS-prosody path before recording variants.

Each is gateable, so none of it complicates the experience of a family who just wants a simple board. That property — *depth that stays hidden until invited* — is your real moat against Avaz.

---

**Next:** [`05-evidence-and-references.md`](05-evidence-and-references.md) — the honest evidence picture and every source, before you cite any of this to a clinician or a funder.
