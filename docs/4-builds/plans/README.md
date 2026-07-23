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
   While you're there, refresh the plan's own status header (and any `⏳` markers left
   in its body) so the archived copy doesn't contradict its status ledger.
4. **Repair the links** — moving into `_done/` breaks relative links in **both**
   directions, and it is silent. Always run the check below afterwards.

### Link repair (step 4)

Two breakages, every time:

- **Inbound** — `docs/00-roadmap.md`, ADRs and specs point at `…/plans/<file>.md`;
  those become `…/plans/_done/<file>.md`. Relative depth differs per linking file
  (`4-builds/plans/_done/…` from the roadmap, `../plans/_done/…` from `decisions/`) —
  don't blanket-replace.
- **Outbound (the one that gets missed)** — links *inside* the moved file break because
  it dropped a directory level: `../decisions/…` → `../../decisions/…`, and
  `../../superpowers/…` → `../../../superpowers/…`. A sibling already in `_done/` is
  just a bare filename.

Verify with this — it resolves every relative `.md` link under `docs/` and prints only
the broken ones:

```bash
python3 - <<'PY'
import os,re,glob
bad=[];n=0
for f in glob.glob('docs/**/*.md',recursive=True):
    d=os.path.dirname(f)
    for m in re.finditer(r'\]\((?!https?:|#)([^)#]+\.md)(?:#[^)]*)?\)', open(f,encoding='utf-8').read()):
        n+=1
        if not os.path.exists(os.path.normpath(os.path.join(d,m.group(1)))):
            bad.append(f"{f} -> {m.group(1)}")
print(f"checked {n} links"); print("\n".join(bad) if bad else "all resolve")
PY
```

## Boundary with the roadmap

`docs/00-roadmap.md` (the build plan) is the **spine** — the ordered list of phases and
their status. A file in `plans/` is the **detail** for one of those phases. The roadmap
links out to the plan; the plan does not duplicate the roadmap.
