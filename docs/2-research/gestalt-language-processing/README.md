# Gestalt Language Processing (GLP) — research dossier

*Created 2026-06-21. Prompted by feedback from an Indian SLP who reviewed an early Mo Speech build and called a set of AAC features "non-negotiable." This folder unpacks the most load-bearing of those: Gestalt Language Processing.*

## Why this folder exists

An experienced speech-language pathologist (SLP) — the same clinician who first suggested trying the Devanagari script — reviewed Mo Speech and listed seven things she considers non-negotiable for a serious AAC app:

1. Retain some English words even when the board is in Hindi (bilingual / code-switching).
2. Hold down on a word to get its past / present / future tense.
3. Morphemes, adjectives, comparatives and superlatives.
4. A way for users to convey **tone** (implies multiple audio versions of the same word).
5. **GLP** — jump to a page where suggestive / predictive words pop up.
6. Plurals for nouns.
7. A keyboard page to type words and play them aloud.

The single most important insight from this research: **points 4, 5, and parts of 2/3/6 are not separate features — they are all consequences of one framework, GLP.** Understanding GLP collapses a scattered wishlist into one coherent design direction.

## What did we find, and what does it mean for Mo Speech?

- GLP is a mainstream, clinically beloved framework for how many (especially autistic) children acquire language: **whole memorised chunks first, broken down into flexible grammar later.**
- Most AAC apps are secretly built for the *opposite* learner (single words combined upward). This is a genuine market gap — and the source of the "cluttered Avaz" complaint, because retrofitting GLP onto a word-based grid is messy.
- Mo Speech's **gating architecture** (instructors reveal complexity gradually) is unusually well-suited to GLP, which is fundamentally about meeting a learner at their stage and revealing the next one.
- The framework is *practice-led, not yet strongly evidence-based*. There is a real academic critique. We should build for it (clinicians want it) but never market it as settled science.

## Reading order

| # | File | What it covers | Best for |
|---|---|---|---|
| 1 | [`01-glp-introduction.md`](01-glp-introduction.md) | Beginner's intro + short history. The "what is this" doc. | First read, bedtime |
| 2 | [`02-the-six-stages.md`](02-the-six-stages.md) | Deep dive on Blanc's six NLA stages with examples. | Understanding the journey |
| 3 | [`03-glp-and-aac.md`](03-glp-and-aac.md) | How robust AAC is actually built for gestalt processors. | The bridge to product |
| 4 | [`04-glp-in-mo-speech.md`](04-glp-in-mo-speech.md) | Translating all of it into Mo Speech features + the 7 non-negotiables mapped. | Decisions about the build |
| 5 | [`05-evidence-and-references.md`](05-evidence-and-references.md) | The honest evidence picture + every source, summarised. | Before you cite or pitch |
| 6 | [`06-sentence-builder-concept.md`](06-sentence-builder-concept.md) | Brainstorm synthesis: the GLP-driven sentence builder, three-entity model, MVP cut. | Turning theory into Mo Speech architecture |
| 7 | [`07-container-organisation.md`](07-container-organisation.md) | How content is organised + installed: three trees, type-aligned modules, collections, provenance. | Information architecture decisions |
| 8 | [`08-phasing-and-rollout.md`](08-phasing-and-rollout.md) | The two-phase plan (launch prep vs GLP surface) + the language-completeness tiers. | Sequencing the build & localization |

## How to use this dossier

These are **reading documents**, not specs. They are written to be consumed slowly and to change how you think about the app — not to be executed. When a decision crystallises, it should graduate into a proper feature spec under `docs/4-builds/features/` or an ADR under `docs/4-builds/decisions/`.
