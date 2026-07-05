# plans

Implementation plans — Claude Code's step-by-step for building one phase or slice.
This is the home for what used to scatter into the global `~/.claude/plans/` autosave.

## What belongs here

A **build plan**: concrete, ordered steps to implement something. File tasks, schema
changes, migration order, verify commands. It is written *before* building and is
**disposable** — once the work ships, the plan is history, not reference.

If the file describes a *capability* (problem / acceptance / edge cases) rather than
*steps*, it is a **feature spec** → it belongs in `../features/`, not here.

| Question | Answer → folder |
|---|---|
| Describes steps, phases, migration order? | plan → `plans/` |
| Describes a capability the product should have? | spec → `../features/` |
| Records a chosen architecture + rejected options? | ADR → `../decisions/` |
| Explains how already-shipped code works? | explainer → `../code-explained/` |

The filename usually tells you: `*-plan`, `*-continuation-prompt`, `stage-N-*`,
`phase-NN-*` are plans.

## Naming

`phase-NN-slug.md` — phase-numbered so the folder reads in build order, the same way
`decisions/` reads chronologically by `ADR-NNN`. Examples:

```
phase-13-content-module-refactor.md
phase-13.4-curation-and-seeding.md
phase-14-dropdown-edit-modes.md
```

Non-phased one-offs (a page or component plan) may use a plain slug:
`home-page.md`, `settings-page.md`.

## Lifecycle

1. **Draft** — write the plan here (or approve one in plan mode, then save it here).
2. **Commit it with the work** — the plan lands in the same PR/commits as the code.
   Never leave the only copy in `~/.claude/plans/` — that autosave is scratch.
3. **Ship** — when the phase is done, move the file to `plans/_done/`. It stays in git
   history as the record of *how* a phase was built; `decisions/` records *why*.

## Boundary with the roadmap

`docs/00-roadmap.md` (the build plan) is the **spine** — the ordered list of phases and
their status. A file in `plans/` is the **detail** for one of those phases. The roadmap
links out to the plan; the plan does not duplicate the roadmap.
