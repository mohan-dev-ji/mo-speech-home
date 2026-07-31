# ADR-017 — Personalization over enforced consistency

**Status:** Accepted · **Date:** 2026-07-18

## Context

Mo Speech's core value is that families personalize **every** aspect of their content — symbols, words, phrases, lists, sentences, casing, order, voice. The app exists to give non-verbal children and their carers *agency* over how they communicate.

A recurring class of idea pulls the other way: *"let's make it consistent / automatic."* It is always well-intentioned (cleaner data, a tidier app, less manual work) and always tempting. Two instances arose in one session:

1. **Enforced casing normalization** — a utility that would rewrite a user's capitalization on save to match a house style. Rejected (see the [translation style guide §1](../translation-style-guide.md); the `phase-15.9` plan was withdrawn).
2. **Cross-language phrase variant linking as a rigid model** — nearly torn down and replaced with a stricter, "more correct" scheme. Kept flexible instead (see [`2026-07-17-phrase-language-scoping-design.md`](../../superpowers/specs/2026-07-17-phrase-language-scoping-design.md), status REJECTED).

Both times, the enforced/consistent option was designed in full, then rejected once its cost to user autonomy was visible.

## Decision

**When user control and enforced consistency conflict, favor user control.**

Concretely:

- **Recommend; never silently override.** The app may supply good defaults, advisory guidance (e.g. the translation style guide), and *suggestions* — but it does not rewrite, lock, or normalize user-authored content behind their back. What the user typed sticks.
- **Consistency is a property of the platform's *own* default content**, authored to a house style by choice — not a rule imposed on user content.
- **Inconsistency across accounts is expected and accepted.** Parents and teachers are particular and have their own styles; that is a feature, not a defect, of an AAC personalization tool.
- **Prefer reversible, visible affordances** (an optional "tidy this" action the user invokes, an undo) over automatic, invisible transforms — if such help is built at all.

This is the default answer to any future *"let's standardize/normalize/auto-correct X"* proposal. It can be overridden, but the burden is on the proposal to justify why enforcement beats autonomy *for that specific case* — not the reverse.

## Consequences

- **Accepted cost:** user content will vary in style, casing, and structure across accounts. Data is "messier" than an enforced scheme would produce. This is the price of the product's core value, knowingly paid.
- **Guidance moves to advisory surfaces:** house style lives in the [translation style guide](../translation-style-guide.md) (advisory) and in well-authored defaults — not in enforcement layers.
- **Engineering rule of thumb:** before building a transform that touches user-authored content, ask "does the user get to keep what they chose?" If a change would silently override user intent, it needs an explicit exception to this ADR.
- **Guards against a real failure mode:** in an AAC tool, silently "correcting" a user reads as *broken* ("why won't my capitals stick?") and, worse, as the software overriding the family's agency — the exact opposite of what the product is for.

## Relates

- [translation-style-guide.md](../translation-style-guide.md) — reframed as advisory under this ADR.
- Withdrawn `phase-15.9-casing-normalization` plan — the triggering case.
- [ADR-016](ADR-016-composed-content-language-variants.md) — the flexible, user-owned variant model this ADR reinforces.
