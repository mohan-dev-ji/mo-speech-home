# Origin markers survive publish → install — `authoredLanguage` for library modules (phase-23)

> **⛔ SUPERSEDED — 2026-08-15, never implemented.** Replaced by
> [`2026-08-15-provenance-gated-origin-affordances-design.md`](2026-08-15-provenance-gated-origin-affordances-design.md).
>
> This design propagates a *correct* origin marker onto library-installed content. The owner's
> call, the same day: library content shouldn't carry the affordance at all. Modules ship complete
> in every supported language, so "Made in EN" is noise and Revert is destructive (it strips a
> curated translation, not a user variant). Translate/revert is a **user-authoring** feature.
> With the badge and controls gated on provenance, nothing consumes a module-level
> `authoredLanguage` and this propagation has no purpose. Kept for the record only — do not build.

**Status:** superseded (never implemented) · **Owner:** Mo · **Written:** 2026-08-15
**Extends:** ADR-019 (lists) + ADR-020 (categories & folders) across the module publish/install boundary.
**Decision record:** ADR-021 (to be written with the implementation).

---

## 1. Problem

ADR-016 gave sentences and phrases an `authoredLanguage`; ADR-019 gave it to lists; ADR-020 gave it to categories and folders. The runtime rule everywhere is `record.authoredLanguage ?? DEFAULT_LOCALE` — content with no marker reads as `en`-origin.

The marker is stamped by the **interactive create paths** only. It does not survive the **library-module round trip**:

- `convex/lib/contentModuleInstall.ts` propagates `authoredLanguage` for sentences (:287) and phrases (:350), but creates `profileFolders` (:141), `profileCategories` (:168) and `profileLists` (:231) with just `name: <module>.name` and **no marker**.
- The `libraryModules` table (`convex/schema.ts:983`) has `name: localisedString` but **no module-level `authoredLanguage`**, and the `libraryModuleCategoryItems` (:148) / `libraryModuleListItems` (:177) validators carry none per item — so the publish step has nowhere to record a non-English origin even if it wanted to.

Consequence: a category or list authored in a non-English language loses its origin on publish → install and renders "Made in EN", with the display fallback and revert guard resolving against the wrong master. EN-authored modules (everything shipped today) are already correct via the `en` fallback — this closes the gap for non-EN content and makes categories/lists consistent with sentences/phrases.

## 2. Decision

Carry `authoredLanguage` through the module boundary at **two levels**:

- **Module level** — the origin of the module's own `name`, which becomes the installed **folder** name.
- **Item level** — the origin of each serialised **category** or **list** name, copied from the source row, exactly as sentence and phrase items already do.

Item value wins at install; the module value is the fallback; absent stays absent (`?? DEFAULT_LOCALE` at read time). No migration, no stamping of `en`.

### 2.1 Acceptance criteria

1. Publishing a folder whose lists were authored on different boards (e.g. one `en`, one `es`, one `hi`) produces a module whose items carry those three distinct origins.
2. Installing that module into another account creates `profileLists` rows with those origins intact — each list badges "Made in \<its own origin\>" and reverts to its own master, per ADR-019.
3. Publishing a `hi`-authored category produces a module with `authoredLanguage: "hi"` at both levels; installing it creates a `profileCategories` row that badges "Made in HI" via `GroupTile`, per ADR-020.
4. A published lists/sentences/phrases folder authored in `hi` installs a `profileFolders` row marked `hi`.
5. Existing modules (no marker) install exactly as they do today — `en`-origin, no badge on an EN board.
6. The git export artifact round-trips the marker.

## 3. Design

### 3.1 Schema + types

**`convex/schema.ts`**
- `libraryModules` (:983) — add `authoredLanguage: v.optional(v.string())`, documented as the origin of the module-level `name` (→ the installed folder).
- `libraryModuleCategoryItems` (:148) — add `authoredLanguage: v.optional(v.string())` to the item object.
- `libraryModuleListItems` (:177) — same.
- Sentence (:259) and phrase (:309) item validators already carry it — untouched.

**`convex/data/_shared/types.ts`**
- `ContentModuleBase` — `authoredLanguage?: string`.
- `LibraryPackCategory` — `authoredLanguage?: string`.
- `LibraryPackList` — `authoredLanguage?: string`.

All optional → existing rows and bundled JSONs validate unchanged. No migration.

### 3.2 Publish

**`convex/contentModules/publish.ts` · `publishFolderAsModule`**
- Lists item map (:87-95) — add `...(l.authoredLanguage ? { authoredLanguage: l.authoredLanguage } : {})`. This is the per-list fidelity that makes acceptance criteria 1–2 work; sentence (:113) and phrase (:136) maps already do it.
- Module row — carry `folder.authoredLanguage`.

**`convex/contentModules/publish.ts` · `publishCategoryAsModule`**
- Items array (:346) — add the same conditional spread from `cat.authoredLanguage`.
- Module row — carry `cat.authoredLanguage`.

**Insert vs patch.** Both mutations have an insert branch and a re-publish patch branch. Insert uses the file's conditional-spread idiom (`...(x ? { x } : {})`). On the **patch** branch, write `authoredLanguage: folder.authoredLanguage` (resp. `cat.authoredLanguage`) **unconditionally**, so a re-publish *mirrors* the source: in Convex, patching a field to `undefined` removes it, which clears a stale marker when an EN-origin source is re-published over a slug that was previously non-EN.

*Implementer:* confirm the `undefined`-clears-the-field semantic against `convex/_generated/ai/guidelines.md` before relying on it. If it does not hold, fall back to conditional-spread on both branches and record the stale-marker edge case in the ADR's Consequences.

### 3.3 Install

**`convex/lib/contentModuleInstall.ts`** — three conditional spreads, same idiom as the sentence/phrase inserts:

| Insert | Source of origin |
|---|---|
| `profileFolders` (:141) | `module.authoredLanguage` |
| `profileCategories` (:168) | `cat.authoredLanguage ?? module.authoredLanguage` |
| `profileLists` (:231) | `list.authoredLanguage ?? module.authoredLanguage` |

Absent stays absent — nothing is stamped `en`, matching ADR-019/020. **No client-side changes at all:** the installed rows flow straight into the existing origin-aware machinery (`GroupTile`, `listTranslateState`, `MadeInLabel`, the display fallbacks in `CategoriesContent` / `GroupsView` / `ListsModeContent`), which already reads `authoredLanguage ?? DEFAULT_LOCALE` off each record.

### 3.4 Round trip

- **`convex/contentModules/exportModules.ts` `dumpAllModules`** — emit the module-level field after `name` (`...(m.authoredLanguage ? { authoredLanguage: m.authoredLanguage } : {})`). Item-level values ride along inside `items`, which is dumped whole. Keeps the committed artifact a faithful backup.
- **`convex/migrations.ts` `seedLibraryModulesFromJSON`** (:515 insert) — propagate `mod.authoredLanguage` with the same conditional spread. The bundled JSONs carry none, so today's seed behaviour is byte-identical.
- **`seedCoreWordModules`** (:288) — no change; those modules are EN-authored by construction.

### 3.5 Migration

**None.** Existing `libraryModules` rows have no marker and read as `en`-origin, which is correct for every module published to date.

*Optional backfill (offered, not applied — same call as ADR-019/020):* a one-shot `authoredLanguage = Object.keys(name)[0]` over rows lacking the field would recover origins for any non-EN module published before this ships. Not run by default; there are none.

## 4. Scope boundaries

**Out of scope, by decision:**
- **Public library catalogue UI.** Module cards in `app/[locale]/(public)/library/…` gain no "Made in" badge and no origin-aware name fallback. Every module today is EN-authored, so a badge would render nothing; revisit when non-EN modules are actually published.
- **Symbol labels** — no board-level translate/revert control exists, so there is no revert-on-origin bug (ADR-020 §Consequences).
- **Sentences, phrases, and the interactive create paths** — already correct.

**Known limitation, documented not fixed:** `/api/admin/translate-modules` is English-master. It skips any localised record with no `en` key (`route.ts:215` — `if (!en) continue`). A module (or list/category item) authored in `hi` therefore keeps its origin through publish → install and badges correctly, but will not receive machine-translated copy from the module pipeline. This is pre-existing behaviour, identical for sentences and phrases; making the translator origin-aware is a separate, larger change to the route and its `translationSnapshot` bookkeeping.

**Transition-window caveat (inherited, worth stating for testing):** a list created *before* ADR-019's create path shipped has no `authoredLanguage` even if its name is keyed under a non-English language. Such a list publishes and installs as `en`-origin regardless of this work. Verify the source rows carry the field before reading a test result as a failure.

## 5. Verification

- `npx tsc --noEmit`
- `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
- eslint on the touched files
- No unit-test runner in this repo; the browser acceptance pass (publish a mixed-origin folder → install → check badges and revert) is owner-run.

**Deployment note:** the schema change reaches the live deployment only when this lands on `main` — `convex dev` runs there, never in a worktree.
