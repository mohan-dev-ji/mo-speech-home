# 4-builds

Technical record of what was built and why.

| Subfolder | What goes here |
|---|---|
| `changelog/` | What shipped and when. Format: `YYYY-MM-DD-feature-name.md`. |
| `decisions/` | Architecture Decision Records (ADRs). What was chosen, what was rejected, and why. Critical for AI agents making future changes. |
| `features/` | Feature specs: problem statement, acceptance criteria, edge cases. Written before building. |

**Rule:** Decisions folder is the most important. If you changed the stack, auth approach, data model, or API contract — document it here. Future you (or an AI agent) will thank you.

AI agents read `decisions/` before proposing code changes to avoid re-litigating settled choices.
