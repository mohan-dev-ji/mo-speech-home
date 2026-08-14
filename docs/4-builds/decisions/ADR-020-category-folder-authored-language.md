# ADR-020 — Categories & folders carry an `authoredLanguage` (origin marker)

**Status:** Accepted · **Date:** 2026-08-14
**Extends:** ADR-019 (origin-aware list translation) to the category and folder name records.
**Design:** [`2026-08-14-category-folder-authored-language-design.md`](../../superpowers/specs/2026-08-14-category-folder-authored-language-design.md)

## Context

Category names (`profileCategories.name`) and folder names (`profileFolders.name`) had the **same fragility lists had before ADR-019**: no origin/master marker. Both render via `displayString(name, language, DEFAULT_LOCALE)` (fallback `boardLang → en → first-key`) and revert via a client-side `stripLocaleKey` with only a last-key guard. On a board with no board-language key — a fallback, *including right after a revert* — the text lands on `en`/first-key rather than the language the content was authored in, and reverting a translation can display a *different* translation instead of the origin.

It happened to work when the origin was the language that won the fallback (a category made in `es` where `es` is the first key), but it was not robust — a category/folder authored in a language that didn't win the fallback reverted to the wrong language, exactly like the list bug ADR-019 fixed. Both surfaces render through the shared tile `GroupTile`, which computed its control from the non-origin-aware `labelTranslateState` and showed no "Made in" badge.

## Decision

Give **categories and folders** an `authoredLanguage` origin marker (set at create = board language) and make their name display + translate/revert **origin-aware**, exactly as ADR-019 did for lists. Because both surfaces render through `GroupTile`, one origin-aware `GroupTile` fixes categories **and** every foldered tree (lists/sentences/phrases folders).

**Behaviour matrix:** on the origin board — no badge, no control; non-origin & untranslated — "Made in \<origin\>" + Translate; non-origin & translated — "Made in \<origin\>" + Revert (removes the variant, master untouched). Badge reads `authoredLanguage`; display text falls back to the origin so it matches the badge.

### Mechanism

- **Schema:** `authoredLanguage: v.optional(v.string())` on `profileCategories` and `profileFolders`, stored at create by `createProfileCategory` / `createFolder`. Both list queries return raw `.collect()`'d docs, so the field reaches the client with **no query change**. Create callers (`useCreateCategory`, `PropertiesPanel`, `GroupsView` folder-create) already keyed the name under the board language and now also pass `authoredLanguage: language`.
- **Runtime fallback:** every read uses `record.authoredLanguage ?? DEFAULT_LOCALE`. Legacy rows read as origin `en`. **No migration.** (Categories/folders never had the en-hardcode create bug, so a one-shot `authoredLanguage = firstKey(name)` backfill would recover origins reliably — offered, not applied; Mo is rebuilding the default categories for MOS-13, which sets the field on recreation.)
- **Shared `GroupTile`:** uses `listTranslateState(nameRecord, language, authoredLanguage ?? DEFAULT_LOCALE)` (the ADR-019 helper), maps `'origin' → 'none'` (no control on the master board), and renders a `MadeInLabel` on both non-origin states. The `authoredLanguage` prop is optional — callers that don't pass it keep the legacy `en`-origin behaviour.
- **Display fallback:** `CategoriesContent` / `GroupsView` resolve names against `authoredLanguage ?? DEFAULT_LOCALE`.
- **Revert guard:** the client-side strip in both callers no-ops when `language === (authoredLanguage ?? DEFAULT_LOCALE)`.

## Consequences

- **Categories and folders are robust to key order** — they revert to the made-in language regardless of which language was authored first; the master can't be stripped (client guard + last-key backstop + origin-hidden control).
- **All foldered trees benefit** — the shared-tile change makes lists/sentences/phrases folders origin-aware too. Intended and consistent (folders are one entity).
- **One accepted difference from lists:** categories/folders revert via the generic `updateCategoryMeta` / `renameFolder` mutations (there is no dedicated revert mutation to guard, and those renames legitimately write the origin key), so the guard is **client-side only** + the last-key backstop — one notch less defense-in-depth than lists' server-side mutation guard. Accepted.
- **Transition edge** (same as ADR-019): a legacy non-`en` category/folder on its true origin board reads as "Made in EN" with a safe no-op revert until recreated (or backfilled).
- **Symbols out of scope** — symbol labels have no board-level translate/revert control (only the Symbol Editor + reset-to-SymbolStix-word), so no revert-on-origin bug; adding origin-aware symbol affordances would be net-new UI. Symbols keep their orthogonal `pinnedLanguage`.
