# Provenance-gated origin affordances — translate/revert is a user-content feature (phase-23)

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-15
**Scopes:** ADR-016 / ADR-019 / ADR-020 — those remain correct, but only for **user-authored** content.
**Supersedes:** [`2026-08-15-library-module-authored-language-design.md`](2026-08-15-library-module-authored-language-design.md) (abandoned — see §1.2).
**Decision record:** ADR-021 ([`ADR-021-provenance-gated-origin-affordances.md`](../../4-builds/decisions/ADR-021-provenance-gated-origin-affordances.md)).

---

## 1. Problem

### 1.1 The affordances are on the wrong content

Origin markers exist so a bilingual family can see where their own content's master lives, translate it onto another board, and revert a translation without losing the master (ADR-016/019/020). That is a **user-authoring** feature and a strong one.

The same affordances currently render on **library-installed content**, where they are at best noise and at worst destructive:

- **Revert is a footgun.** A library list on an ES board is `{en, es, hi}` — all curated translations, no user variant. `listTranslateState` reads "board key present + other keys exist" → `translated` → offers **Revert**, which strips `es` and drops the user onto whichever key wins the fallback. ADR-019's guard only protects the *origin* key, so it doesn't fire here. The user loses good curated copy and has no way back short of reinstalling the module.
- **"Made in EN" is meaningless on curated content.** Library modules ship complete in every supported language. Where the content was first authored is an implementation detail of the curation pipeline, not something a family needs — or benefits from — knowing. It also crowds the tile grid: the badge was moved to its own `GroupTile` row in `f0d2c20` precisely because it was crowding, and the tiles doing the crowding are the seeded default categories.
- **Translate is redundant.** There is nothing to translate; the board-language key is already there.

### 1.2 Why the previous phase-23 design is abandoned

The superseded spec propagated `authoredLanguage` through publish → install so library content would carry a *correct* origin marker. Correct, but it makes the wrong content better at a feature it shouldn't have. If library content shows no badge and no controls, nothing consumes a module-level `authoredLanguage` and the whole publish/install propagation has no purpose. Abandoned in favour of removing the affordance rather than perfecting its input.

## 2. Decision

**Gate the origin affordances on provenance, not on language state.**

```
isLibraryContent(record) === record.librarySourceId !== undefined
```

- **Library-sourced content** → no "Made in" badge, no Translate, no Revert. Ever, regardless of which language keys the record holds. It is finished content: use it, or edit it to taste.
- **User-created content** (no `librarySourceId`) → unchanged. Exactly the ADR-019/020 behaviour as shipped.

`librarySourceId` is already stamped on every row `contentModuleInstall.ts` creates (`:150` folders, `:175` categories, `:249` lists, `:294` sentences, `:355` phrases), where it currently serves dedup and uninstall. This gives it a second consumer.

### 2.1 Acceptance criteria

1. A freshly seeded account, on any board language, shows **no** translate/revert control and **no** "Made in" badge anywhere in edit mode — its content is all library-installed.
2. Content the user creates (category, folder, list, sentence, phrase) behaves exactly as today: origin board clean; non-origin boards show "Made in \<origin\>" + Translate or Revert.
3. An installed library list/category/sentence/phrase cannot be reverted from the UI at all — the control is absent, not merely disabled.
4. The admin's authoring account is unaffected: source categories/folders/lists there have no `librarySourceId`, so the full kit stays available for building multilingual defaults.
5. Editing library content still works normally (rename writes the board-language key, per the existing edit paths) — the gate removes the translate/revert affordance only.

### 2.2 Explicitly unchanged

**Display resolution is untouched.** Names still resolve via `displayString(record, boardLang, authoredLanguage ?? DEFAULT_LOCALE)`. Library rows have no `authoredLanguage`, so they fall back to `en` — correct, since English is the curation master. Only the *affordances* are gated.

## 3. Design

### 3.1 The gate

Add to **`lib/languages/variants.ts`** (beside `listTranslateState`, the ADR-019 helper):

```ts
/**
 * ADR-021 — library-installed content is finished content: no origin badge, no
 * translate, no revert, whatever language keys it holds. Provenance beats
 * language state. User-authored rows (no `librarySourceId`) keep the full
 * ADR-019/020 behaviour.
 */
export function isLibraryContent(record: { librarySourceId?: string }): boolean {
  return record.librarySourceId !== undefined;
}
```

One rule, one home. Each surface calls it and collapses the control state to `'none'` / suppresses the badge.

### 3.2 Surfaces

Five of the six surfaces already have `librarySourceId` on the client: `getProfileCategories` / `getCoreWordCategories` (`profileCategories.ts:132`, `:154`) and `getProfileFolders` (`profileFolders.ts:24`) `.collect()` whole rows; the list, sentence and Phrases-page queries project it explicitly (`profileLists.ts:41`/`:64`, `profileSentences.ts:111`, `profilePhrases.ts:68`).

**One query change is needed.** The talker dropdown does *not* read phrases through `profilePhrases.ts` — it reads `dropbar.ts:getDropbarPhrases` (`:110`), which builds an explicit projection (`_id`, `name`, `words`, audio paths, `authoredLanguage`, `variantGroupId`) and drops every other field. Add `librarySourceId: p.librarySourceId` to that projection.

| Surface | File | Gate point |
|---|---|---|
| Categories + all folders | `app/components/app/shared/ui/GroupTile.tsx` | New `isLibraryContent?: boolean` prop; when true force `tileState = 'origin'` (`:165`). Kills the control (`:206`) **and** the badge (`:225`) in one edit — both already key off `tileState`. |
| ↳ callers | `CategoriesContent.tsx:298`, `GroupsView.tsx:253` | Pass `isLibraryContent={isLibraryContent(cat)}` / `(folder)`. |
| List card | `ListsModeContent.tsx` | Collapse `cardState` (`:151`) to `'origin'` for library lists → control (`:191`) and badge (`:227`) both vanish. |
| List items | `ListDetailContent.tsx` (`:317`, `:450`) | The per-item `controlState` passed into `ListDetailEdit`'s three layouts (`:108`, `:163`, `:218`) is computed here, where the parent `list` is in scope — gate on the **list's** provenance. |
| Sentences | `SentencesModeContent.tsx` | Gate `translateState` (`:568`) and `badgeLang` (`:556`) on `sentence.librarySourceId`. |
| Phrases (talker dropdown) | `TalkerDropdown.tsx` | Gate `phraseState` (`:671`) → control (`:699`) and `madeInLabel` (`:707`) both fall away. Needs the `getDropbarPhrases` projection fix above. |

No mutation, schema, publish or install changes anywhere — the only backend edit is the one added field in the `getDropbarPhrases` projection.

**A user-created dropbar phrase is user content.** `createPhrase` (`profilePhrases.ts:98`) stamps `accountId` / `folderId` / `authoredLanguage` and never `librarySourceId` — only `contentModuleInstall.ts` writes that field — so a phrase made in the dropbar keeps the full badge + translate/revert kit, exactly like one made on the Phrases page. Only its *container* folder is sentinel-marked (§3.3).

### 3.3 Edge cases

- **Dropbar sentinel containers.** `dropbar.ts:70`/`:85`/`:167` create the core-words category and phrases folder with sentinel `librarySourceId` values (`CORE_SLUG`, `PHRASES_SLUG`). Those *containers* therefore read as library content and lose their tile controls — correct, since their names are app-provided. Phrases the user creates **inside** that folder have no `librarySourceId` and keep the full kit: the rule keys on the row being rendered, never its parent. In practice the container holds user content only — installing a phrases module always creates its own folder (`contentModuleInstall.ts:141`), so a library phrase reaches the dropbar only if the user moves it there, where it keeps its provenance and correctly shows no controls beside their own phrases that do.
- **Provenance is fixed at install.** Editing a library list does not convert it to user content, so its controls never return. Accepted: library content arrives fully translated, so edits are preference tweaks rather than translation work. The alternative ("edited library content becomes user content") needs an edited-marker and is not worth the machinery today.
- **Sentence/phrase variant groups keep `authoredLanguage`.** It is already propagated through install and is used *structurally* by `planVariantGroups` (`lib/variantGroupPlan.ts:45`) to pick the source row of a variant group. That is data resolution, not UI, and must not be removed.

## 4. The dependency this creates

Installed content is a **copy**. Re-publishing a module updates the `libraryModules` row and therefore future installs; it does **not** touch rows already materialised in family accounts, and there is no reload path — `contentModuleInstall.ts:6` claims `librarySourceId` exists "so delete / reload / dedup can find them later", but only uninstall and dedup are implemented.

Today the (misplaced) Translate button is an accidental recovery path for that gap: an account that installed a module before a language shipped can hand-fill the missing language. Removing it closes the hole in the product and opens one in operations:

> **When the next app language is added, existing installed content will silently stay in its old languages, and families will have no in-app way to fix it.**

**Recorded in ADR-021 as a precondition for adding the next app language.** The fix is a *refresh* rather than a translate button — an admin-run backfill that patches installed rows' localised records from their `libraryModules` source, matched by `librarySourceId`, preserving user edits; or a user-facing per-module "update from library". Out of scope for this phase; must exist before the next language run.

## 5. Non-goals

- **Public library catalogue UI** — unchanged (no badge, no origin-aware fallback).
- **Symbol labels** — no board-level translate/revert exists; untouched.
- **Publish and install** — no changes at all. The abandoned `authoredLanguage` propagation is not revived in any form.
- **ADR-019/020 behaviour for user content** — unchanged, only scoped.
- **The refresh/backfill path of §4** — specced separately, before the next language.

## 6. Verification

- `npx tsc --noEmit`
- `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json` (covers the `getDropbarPhrases` projection change)
- eslint on the touched files
- No unit-test runner in this repo. Owner-run browser acceptance: on a fresh/seeded account confirm no badge or control on default categories, seeded lists, seeded sentences and dropbar phrases in edit mode; then create one of each by hand and confirm the badge + Translate/Revert behave exactly as before on a non-origin board.

**Deployment note:** near-client-only. The single `getDropbarPhrases` projection field is the one change that must reach Convex, so it takes effect when this lands on `main` (where `convex dev` runs) — never from a worktree.
