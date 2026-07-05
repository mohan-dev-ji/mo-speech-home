# 4-builds

Technical record of what was built and why.

| Subfolder | What goes here | Ages how |
|---|---|---|
| `decisions/` | ADRs — what was chosen, what was rejected, and why. `ADR-NNN-slug.md`, immutable. | Append-only; never edited |
| `features/` | **Feature specs** — problem, acceptance criteria, edge cases. Describe a *capability*. Feed `docs/5-prd/`. | Evergreen; track shipped product |
| `plans/` | **Build plans** — Claude Code's step-by-step for one phase/slice. Describe *steps*. `phase-NN-slug.md`. | Disposable; move to `plans/_done/` when shipped |
| `code-explained/` | Explainers for how shipped code works (slides, scripts, traces). | Update on architecture pivots |
| `changelog/` | What shipped and when. `YYYY-MM-DD-feature-name.md`. | Append-only |

**The features-vs-plans line is the one that matters most.** A *spec* says what the product
should do (evergreen); a *plan* says how to build it next (disposable). Filenames ending
`-plan`, `-continuation-prompt`, or `stage-N-…` are plans → `plans/`. See `plans/README.md`.

**Rule:** `decisions/` is the most important. If you changed the stack, auth approach, data
model, or API contract — document it there. Future you (or an AI agent) will thank you.
AI agents read `decisions/` before proposing code changes to avoid re-litigating settled choices.
