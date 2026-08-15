# ADR-021 — Origin affordances are gated on provenance, not language state

**Status:** Accepted · **Date:** 2026-08-15
**Extends:** ADR-016 (composed-content language variants), ADR-019 (list origin marker), ADR-020 (category/folder origin marker).
**Design:** [`2026-08-15-provenance-gated-origin-affordances-design.md`](../../superpowers/specs/2026-08-15-provenance-gated-origin-affordances-design.md)

## Context

ADR-016/019/020 gave content an origin marker (`authoredLanguage`) and origin-aware translate/revert, so a bilingual family can see where their own content's master lives, translate it onto another board, and revert a translation without losing the master. That machinery reads purely off language state — which keys a record holds relative to the board language — and renders unconditionally on any record with an `authoredLanguage`.

Those same affordances also render on **library-installed content**, where the non-board-language keys are *curated translations* shipped by the content pipeline, not user variants:

- **Revert is destructive there.** A library list on an ES board is `{en, es, hi}` — all curated. `listTranslateState` reads "board key present + other keys exist" → `translated` → offers Revert, which strips `es` and drops the user onto whichever key wins the fallback. ADR-019's guard only no-ops when the board language *is* the origin; it does not fire here, because the key being removed is a curated translation, not the origin key. The user loses good copy with no way back short of reinstalling the module.
- **"Made in EN" is noise on curated content.** Library modules ship complete in every supported language; where the content was first authored is an implementation detail of the curation pipeline, not something a family needs to know. It also crowds the tile grid — the badge was moved to its own `GroupTile` row in `f0d2c20` because it was crowding, and the tiles doing the crowding are the seeded default categories.
- **Translate is redundant.** There is nothing to translate; the board-language key is already there.

## Decision

Gate the origin affordances (badge, Translate, Revert) on **provenance** — whether the record carries a `librarySourceId` — not on language state. Library-sourced content: no badge, no Translate, no Revert, ever, regardless of which language keys it holds. User-authored content: unchanged ADR-019/020 behaviour. Display and fallback resolution (`displayString`, `resolvedLocale`) are untouched — provenance affects only the affordances, never which text is shown.

### Mechanism

- **Predicate:** `isLibraryContent(record: { librarySourceId?: string }): boolean` in `lib/languages/variants.ts`, returning `record.librarySourceId !== undefined`. `librarySourceId` is stamped only by `convex/lib/contentModuleInstall.ts`, so anything the user creates by hand — including a phrase made in the talker dropbar — is user content by construction.
- **Six surfaces collapse their state when `isLibraryContent` is true:**
  - `GroupTile` (`app/components/app/shared/ui/GroupTile.tsx`) gained an optional `isLibraryContent` prop; when true, `tileState` collapses to `'origin'`, which the component already treats as "no badge, no control." Passed from `CategoriesContent.tsx` and `GroupsView.tsx`, so it covers categories and every foldered tree (lists/sentences/phrases folders) in one change.
  - `ListsModeContent.tsx`'s `cardState` collapses to `'origin'` for library lists.
  - `ListDetailContent.tsx` / `ListDetailEdit.tsx` gate per-item controls on the **parent list's** provenance — items carry no `librarySourceId` of their own — threaded through `EditItemProps` / `EditContainerProps` into the three row components and three containers.
  - `SentencesModeContent.tsx` gates both `badgeLang` and `translateState` (this surface computes badge and control separately, unlike the shared tile).
  - `TalkerDropdown.tsx` gates `phraseState`; its badge was already guarded by that state, so gating the state alone removes both.
- **One backend field:** `convex/dropbar.ts`'s `getDropbarPhrases` projection gained `librarySourceId` — it previously dropped the field on the way out, so the dropdown had no provenance signal to gate on. This is the only backend change in the whole plan; no schema, mutation, publish, or install-path change.

## Consequences

1. **A freshly seeded account shows no origin affordances anywhere** — all its content is library-installed, so every tile, list, item, sentence, and phrase collapses to `'origin'`/`'none'`. This also caught the admin's own authoring account: `seedDefaultAccount` (`convex/profileCategories.ts:33`) installs the default modules into every account at signup, including the admin's, so the rows the admin edits and republishes as the app's default content carry `librarySourceId` too. The gate is therefore suppressed explicitly for admins in admin view (`viewMode === 'admin'`), restoring the badge and translate/revert on those rows so multilingual defaults can still be authored exactly as ADR-019/020 describe, while instructors and students continue to see none.
2. **Provenance is fixed at install.** Editing a library list (or any other library-sourced record) does not clear `librarySourceId` and does not restore its origin controls. Accepted: library content arrives fully translated, so a post-install edit is a preference tweak on finished content, not the start of a new authoring history.
3. **Dropbar containers vs. dropbar contents diverge by design.** The dropbar's core-words category and phrases folder carry sentinel `librarySourceId` values (`convex/dropbar.ts:70` / `:85`), so those *container* tiles lose their controls — matching every other library container. A phrase the user creates inside keeps its own badge and control, because the rule keys on the row being rendered, not its parent's provenance.
4. **Precondition for the next app language.** Installed content is a copy taken at install time; re-publishing a `libraryModules` source does not update rows already materialised in family accounts, and no reload path exists today — `contentModuleInstall.ts:6` documents one but only uninstall and dedup are implemented. The Translate button this ADR removes from library content was, unintentionally, the only user-facing recovery path for that gap (translate-then-keep against a stale board key). Before the next language is added to the app, ship a refresh mechanism: an admin backfill that patches installed rows' localised records from their `libraryModules` source, matched by `librarySourceId` and preserving user edits, or a user-facing per-module "update from library" action. Without it, families who installed a module before the new language shipped will see incomplete translations on the new board with no way to reach the curated copy.

## Supersedes

The same-day `authoredLanguage`-propagation design (`2026-08-15-library-module-authored-language-design.md`) was abandoned in favour of this approach. With the origin affordances gated on provenance, nothing in the app consumes a module-level `authoredLanguage` marker — propagating one would have solved a problem this ADR dissolves at the affordance layer instead.
