# Origin-aware categories & folders — `authoredLanguage` (phase-22)

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-14
**Extends:** ADR-019 (origin-aware list translation) to the category and folder name records.
**Decision record:** ADR-020.

---

## 1. Problem

Category names (`profileCategories.name`) and folder names (`profileFolders.name`) have the **same fragility lists had before ADR-019**: no origin/master marker. Both render via `displayString(name, language, DEFAULT_LOCALE)` (fallback chain `boardLang → en → first-key`) and revert via a client-side `stripLocaleKey` with only a last-key guard. So on a board where the name has no board-language key (a fallback, *including right after a revert*), the text lands on `en`/first-key rather than the language the content was authored in — and reverting a translation can display a *different* translation instead of the origin.

It happens to work today only when the origin is the language that wins the fallback (e.g. a category made in `es` where `es` is the first key). It is not robust — a category/folder authored in a language that doesn't win the fallback reverts to the wrong language, exactly like the list bug (`c095735`-era) that ADR-019 fixed.

Both surfaces share the tile component `GroupTile`, which computes its translate/revert control from the **non-origin-aware** `labelTranslateState(nameRecord, language)` and shows **no "Made in" badge** — so it can't tell the master board from a translated one, and offers a (destructive-if-not-guarded) revert on the origin board.

## 2. Decision

Give **categories and folders** an `authoredLanguage` origin marker (set at create = board language) and make their name display + translate/revert **origin-aware**, exactly as ADR-019 did for lists. Because both surfaces render through `GroupTile`, one origin-aware `GroupTile` fixes categories **and** every foldered tree (lists/sentences/phrases folders).

### 2.1 Behaviour matrix (acceptance criteria)

| Board vs origin | Board-lang text present? | Label | Control |
|---|---|---|---|
| On the origin board | (always — it's the master) | none | none |
| Non-origin, not yet translated | no → master shows as fallback | **Made in \<origin\>** | Translate |
| Non-origin, translated | yes → the variant shows | **Made in \<origin\>** | Revert (removes this variant; master untouched) |

Badge reads **`authoredLanguage`**, shown on both non-origin states. Display text falls back to the origin, so it matches the badge.

## 3. Design

### 3.1 Schema + create

- **`convex/schema.ts`** — add `authoredLanguage: v.optional(v.string())` to `profileCategories` (~line 543) and `profileFolders` (~line 839). Optional → existing rows validate unchanged, no migration.
- **`convex/profileCategories.ts` `createProfileCategory`** (~line 318) and **`convex/profileFolders.ts` `createFolder`** (~line 54) — accept `authoredLanguage: v.optional(v.string())` and store it (conditional spread, like `folderId` on lists).
- **Create callers pass `authoredLanguage: language`:**
  - `app/lib/categories/useCreateCategory.ts:27`
  - `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx:82`
  - `app/components/app/shared/sections/GroupsView.tsx:152` (folder create)
  - *(Names already key under `{[language]:name}` — no create-keying bug to fix, unlike lists.)*
- **Read queries return `authoredLanguage`:** the category-list query (`getProfileCategories`) and the folder query used by `GroupsView`. The implementer confirms exact names by grep and adds `authoredLanguage: <doc>.authoredLanguage` to each returned/projected shape (so the client type carries it).

### 3.2 Runtime fallback (no migration)

Every read site uses `record.authoredLanguage ?? DEFAULT_LOCALE`. Legacy categories/folders (no field) read as origin `en`. **No migration by default.**

*Optional backfill (offered, not default):* unlike lists, categories/folders never had the en-hardcode create bug — they always keyed under the board language — so the first key of `name` **is** the origin. A one-shot `authoredLanguage = Object.keys(name)[0]` for records lacking the field would recover origins reliably. Default is no-backfill (Mo is rebuilding the default categories for MOS-13, which sets `authoredLanguage` correctly on recreation).

### 3.3 Origin-aware `GroupTile` (shared by categories + folders)

**`app/components/app/shared/ui/GroupTile.tsx`** (control state ~lines 190-198):
- Add an `authoredLanguage: string` prop.
- Replace `labelTranslateState(nameRecord, language)` with `listTranslateState(nameRecord, language, authoredLanguage)` (the ADR-019 helper in `lib/languages/variants.ts`), mapping `'origin' → 'none'` for `TranslateRevertControl` (renders nothing → no control on the origin board).
- Add a `MadeInLabel lang={authoredLanguage}` rendered in edit mode when the state is not `'origin'` (both non-origin states). `GroupTile` shows no badge today — this **adds** one. (Vetoable at review if it crowds the grid tile; the bug fix does not strictly require the badge, only the origin-aware state + display + guard.)

Callers pass `authoredLanguage={record.authoredLanguage ?? DEFAULT_LOCALE}` alongside the existing `nameRecord`/`language` props:
- `CategoriesContent.tsx` (~lines 309-310) → `cat.authoredLanguage ?? DEFAULT_LOCALE`
- `GroupsView.tsx` (~line 266) → `folder.authoredLanguage ?? DEFAULT_LOCALE`

### 3.4 Origin-aware display fallback

- `CategoriesContent.tsx:294` → `displayString(cat.name, language, cat.authoredLanguage ?? DEFAULT_LOCALE)`
- `GroupsView.tsx:251` → `displayString(folder.name, language, folder.authoredLanguage ?? DEFAULT_LOCALE)`

### 3.5 Revert guard

The revert is a client-side strip (categories reuse `updateCategoryMeta`; folders reuse `renameFolder` — there is no dedicated revert mutation to guard server-side, and those generic renames legitimately write the origin key, so they must NOT be guarded). Guard at the client handler instead:

- `CategoriesContent.tsx` (~lines 313-317): before stripping, `if (language === (cat.authoredLanguage ?? DEFAULT_LOCALE)) return;`
- `GroupsView.tsx` (~lines 270-274): `if (language === (folder.authoredLanguage ?? DEFAULT_LOCALE)) return;`

Combined with the origin-aware `GroupTile` (which shows no revert control on the origin board) and the existing last-key guard, the master can't be stripped. *This is one notch less defense-in-depth than lists (no server mutation guard), because the revert path is a generic rename — documented as an accepted difference.*

## 4. Components / interfaces touched

| File | Change |
|---|---|
| `convex/schema.ts` | `authoredLanguage?` on `profileCategories` + `profileFolders` |
| `convex/profileCategories.ts` | `createProfileCategory` stores it; category-list query returns it |
| `convex/profileFolders.ts` | `createFolder` stores it; folder query returns it |
| `app/lib/categories/useCreateCategory.ts` | pass `authoredLanguage: language` |
| `PropertiesPanel.tsx` | pass `authoredLanguage: language` (category-create) |
| `GroupsView.tsx` | folder create passes it; display fallback; revert guard; pass `authoredLanguage` to `GroupTile` |
| `CategoriesContent.tsx` | display fallback; revert guard; pass `authoredLanguage` to `GroupTile` |
| `GroupTile.tsx` | `authoredLanguage` prop; `listTranslateState`; `MadeInLabel` |
| `docs/4-builds/decisions/ADR-020-*.md` | record the decision |

## 5. Edge cases

- **Record missing the origin key** (origin text deleted): display falls to first-key (last resort); revert protected by the last-key guard. Affordances follow the origin marker.
- **Legacy non-en category on its true origin board** (no `authoredLanguage` → read as `en`): shows a cosmetic "Made in EN" + a revert that safely no-ops (last-key guard). Closed by recreation or the optional backfill. Same transition edge documented for lists in ADR-019.
- **Folders across trees:** the `GroupTile` change makes lists/sentences/phrases folders origin-aware too — intended and consistent (folders are one entity).

## 6. Verification

No unit-test runner — verification is `tsc --noEmit` + `tsc -p convex/tsconfig.json` + ESLint + a browser acceptance test (owner-run): create a category on a non-`en` board and a folder on a non-`en` board; for each — origin board shows no badge/no control; other board shows "Made in \<origin\>" + Translate; translate, confirm badge persists + Revert; revert and confirm it falls back to the **origin** (not a prior translation); back on the origin board, still clean.

## 7. Non-goals

- **Symbol labels** — out of scope. Symbols have no board-level translate/revert control (only the Symbol Editor + reset-to-SymbolStix-word), so they have no revert-on-origin bug; adding origin-aware symbol affordances would be net-new UI. Symbols keep their existing `pinnedLanguage` + editor flow.
- **No change to lists/sentences/phrases content** (only their *folders*, via `GroupTile`).
- **No migration** (runtime fallback; optional backfill offered).
- **No new revert mutation** — categories/folders keep reverting via the generic rename path, guarded client-side.
