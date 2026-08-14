# New-session prompt — `authoredLanguage` for library modules (phase-23)

Paste the block below into a fresh Claude Code session.

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
5. Record as an ADR (extends ADR-019/020). Verify with `tsc --noEmit` + `tsc -p convex/tsconfig.json` + eslint; no unit-test runner exists (browser acceptance test is owner-run).

**Constraints (this repo):** work on `main` (no worktree); no `npm run dev` (owner runs the dev server); no `npx convex dev` — type-check Convex with `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`. Save the plan to `docs/4-builds/plans/phase-23-*.md`. Read `docs/4-builds/decisions/ADR-019-list-authored-language.md` and `ADR-020-category-folder-authored-language.md` first for the model.

**Non-goals:** symbol labels (no board-level revert; out of scope, same as ADR-020); re-doing lists/categories/folders/sentences/phrases (all shipped); any change to the interactive create paths (already set `authoredLanguage`).
