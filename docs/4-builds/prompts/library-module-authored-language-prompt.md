# New-session prompt — `authoredLanguage` for library modules (phase-23)

Start a fresh Claude Code session **from the worktree**, then paste the block below:

```bash
cd /Users/mohanveraitch/Projects/mo-speech-home/.claude/worktrees/phase-23-library-module-authored-language
```

The worktree already exists on branch `worktree-phase-23-library-module-authored-language` (branched from `origin/main` @ 663f789) with `npm install` done. It runs in parallel with phase-20 (another worktree) and MOS-13 (on `main`) — hence the worktree instead of the usual work-on-main convention.

---

Spec and build **origin-marker propagation for library modules**, then implement it via the brainstorming → writing-plans → subagent-driven-development workflow (same as phases 19/21/22). This is a small, well-bounded extension of an already-shipped model.

**Background (already shipped, do not redo):**
- ADR-019 gave **lists** an `authoredLanguage` (origin/master language) so their name badge/translate/revert and text fallback are origin-aware. ADR-020 did the same for **categories** and **folders** (via the shared `GroupTile`). Sentences and phrases already had `authoredLanguage` from ADR-016.
- The runtime rule everywhere: origin = `record.authoredLanguage ?? DEFAULT_LOCALE`. Content with no marker reads as `en`-origin.

**The gap this task closes:**
Content **installed from a library module** (the default manifest that seeds new accounts, plus any published pack) does NOT carry an origin marker for categories/lists/folders, so it falls back to `en`. Specifically:
- `convex/lib/contentModuleInstall.ts` already propagates `authoredLanguage` for **sentences** (~lines 287-288) and **phrases** (~lines 350-351), but creates **profileFolders** (~line 144), **profileCategories** (~line 170), and **profileLists** (~line 233) with just `name: <module>.name` and **no `authoredLanguage`**.
- The `libraryModules` table (`convex/schema.ts:983`) has `name: localisedString` but **no module-level `authoredLanguage`** — so even the publish step can't preserve a non-English origin.
- Consequence: a module authored in a non-English language (e.g. a `hi`-authored category) loses its origin on publish→install and reads as "Made in EN". (EN-authored default modules are already correct via the `en` fallback — this task is for non-EN modules + consistency with sentences/phrases.)

**What to build (the shape — confirm in brainstorming, don't assume):**
1. Add `authoredLanguage: v.optional(v.string())` to the `libraryModules` table for the module-level name.
2. **Publish** flow (category/list/folder → `libraryModules`): capture the source profile record's `authoredLanguage` onto the module. Find the publish mutations (grep `libraryModules` + `insert`/`publish` in `convex/profileCategories.ts`, `convex/profileFolders.ts`, `convex/profileLists.ts`, and `convex/contentModules/*`).
3. **Install** flow (`convex/lib/contentModuleInstall.ts`): set `authoredLanguage` on the created `profileFolders`/`profileCategories`/`profileLists` from the module's value, using the same conditional-spread pattern already used there for sentences/phrases.
4. Runtime fallback `?? DEFAULT_LOCALE` for legacy modules (no migration). Optionally note a first-key backfill for existing library modules, as ADR-019/020 did.
5. Record as an ADR (extends ADR-019/020). **Use ADR-022** — it is reserved for you. Phase-20 Stage 5 is running in parallel and has been told to take 023, so do not renumber. Verify with `tsc --noEmit` + `tsc -p convex/tsconfig.json` + eslint; no unit-test runner exists (browser acceptance test is owner-run).

**Environment — read this before running anything. Three streams of work are live at once, so these are hard constraints, not preferences:**

- **Stay in this worktree.** Do NOT create another worktree, do NOT `git checkout main`, do NOT push or merge to `main`. Commit to `worktree-phase-23-library-module-authored-language` and hand back — the owner merges.
- **Never run `npx convex dev`.** The owner runs it on `main`, and it is the single writer to the shared dev deployment. Running it here would spin up an anonymous local backend and rewrite `.env.local`.
- **Never run `npm run dev`.** Two dev servers are already up (main + the phase-20 worktree). A third would not help: this worktree cannot deploy the schema change, so it could not exercise it anyway.
- **This worktree has no `.env.local` and needs none.** Nothing in this task runs a script or hits a backend.
- **Do not touch `scripts/` or `lib/audio/`** — phase-20 (`docs/4-builds/plans/phase-20-en-gb-news-m-reseed-plan.md`) is mid-flight in a sibling worktree and owns those paths.
- `convex/_generated/` is committed, so type-checks work without a deploy. This task edits existing mutations and adds no new Convex functions, so `_generated` should not drift — if you find yourself needing to regenerate it, stop and flag it.

**Verification (the whole toolbox — there is no test runner):**

```bash
npx tsc --noEmit
npx tsc -p convex/tsconfig.json
npx eslint <files you changed>
```

Baseline recorded on a clean checkout of this worktree: `npx tsc --noEmit` emits exactly one pre-existing, unrelated error — `lib/stripe.ts(8,3): error TS2322` (Stripe API-version literal). That is the baseline, not your regression. `npx tsc -p convex/tsconfig.json` is **clean** — keep it clean. Node is already 20.17.0 here; if a shell reports otherwise, prefix with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.

**Browser acceptance is deferred and owner-run.** It cannot happen in this worktree — the schema field only reaches the backend once the branch merges to `main`, where `convex dev` pushes it. Finish at "type-checks clean + committed", and say plainly in your handoff that runtime behaviour is unverified.

**Other constraints:** save the plan to `docs/4-builds/plans/phase-23-*.md`. Read `docs/4-builds/decisions/ADR-019-list-authored-language.md` and `ADR-020-category-folder-authored-language.md` first for the model.

**Non-goals:** symbol labels (no board-level revert; out of scope, same as ADR-020); re-doing lists/categories/folders/sentences/phrases (all shipped); any change to the interactive create paths (already set `authoredLanguage`).
