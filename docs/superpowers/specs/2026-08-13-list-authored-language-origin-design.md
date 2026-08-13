# Origin-aware list translation — `authoredLanguage` for lists

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-13
**Context:** discovered while testing multi-language boards for MOS-13 (rebuild defaults). Follows the create-keying fix (`c095735`) which stopped lists being keyed under `en` regardless of board.
**Decision record:** ADR-019 (a refinement of ADR-016's list-variant model).

---

## 1. Problem

A list is a **single localised record** (`name`, plus one `description` record per item) — a bag of language keys with **no notion of which language is the master/origin**. The label/translate/revert affordances are derived purely from *which keys the record holds* (`labelTranslateState`), so:

- **Revert on the origin board is destructive.** A list made in EN, then translated to ES, is `{en, es}`. On the EN board `labelTranslateState` sees "board key present + another key exists" → offers **Revert** → `revertProfileListLanguage` strips the `en` key → the English **master is deleted**, leaving `{es}`. (Observed: "the ES variant appears on the EN board.")
- **The "Made in" label vanishes once translated.** It only shows in the `untranslated` state, so after translating a non-origin board loses the signal of where the master lives.

Sentences and phrases don't have this problem — they carry `authoredLanguage` on their variant rows. Lists were built as single-record labels (ADR-016 Addendum E) to avoid variant rows, and that simplification is what leaves them unable to tell master from variant.

## 2. Decision

Give each list an **`authoredLanguage`** (its origin/master language, set at create = the board language it was authored on). Make the label/translate/revert logic **origin-aware** on both surfaces (the group-view list card and the per-item controls inside a list). Revert can then only ever remove a *non-origin* variant — never the master.

### 2.1 The behaviour matrix (the acceptance criteria)

| Board vs origin | Board-lang text present? | Label | Control |
|---|---|---|---|
| **On the origin board** | (always — it's the master) | none | **none** |
| **Non-origin, not yet translated** | no → master shows as fallback | **Made in \<origin\>** | **Translate** |
| **Non-origin, translated** | yes → the variant shows | **Made in \<origin\>** | **Revert** (removes this variant; master untouched) |

The badge always reads **`authoredLanguage`** (not `resolvedLocale`) and shows on *both* non-origin states.

## 3. Design

### 3.1 Schema + create (the origin marker)

- **`convex/schema.ts`** — add `authoredLanguage: v.optional(v.string())` to `profileLists`. Optional so existing rows validate unchanged.
- **`convex/profileLists.ts` `createProfileList`** — accept `authoredLanguage: v.optional(v.string())` and store it.
- **Both create callers** pass `authoredLanguage: language` (the active board language):
  - `app/components/app/lists/sections/ListsModeContent.tsx` (`handleCreate`)
  - `app/components/app/home/sections/HomeContent.tsx` (`handleCreateList`)
  - This mirrors `createProfileSentence`, which already does `{ name: { [language]: name }, authoredLanguage: language }`.

### 3.2 Legacy / default lists — runtime fallback, no migration

Existing lists (and `_starter` defaults) have no `authoredLanguage`. **Treat a missing value as `DEFAULT_LOCALE` (`en`)** at read time: `list.authoredLanguage ?? DEFAULT_LOCALE`. This is correct for them — before the create-keying fix every list was keyed under `en`, and defaults are authored in `en` — so they read as "Made in EN," which matches their data. No backfill migration is needed.

### 3.3 One origin-aware state function

Add to **`lib/languages/variants.ts`** (alongside `labelTranslateState`, which stays for any non-origin-aware callers):

```ts
/**
 * Origin-aware control state for a single localised record whose master language
 * is known (lists carry authoredLanguage). Unlike labelTranslateState, this can
 * distinguish the master board (no affordances) from a non-origin board.
 *   'origin'       — board IS the master language: no label, no control.
 *   'untranslated' — non-origin, board-lang key absent: "Made in <origin>" + Translate.
 *   'translated'   — non-origin, board-lang key present: "Made in <origin>" + Revert.
 */
export function listTranslateState(
  record: Record<string, string> | undefined,
  boardLang: string,
  authoredLanguage: string,
): 'origin' | 'untranslated' | 'translated' {
  if (boardLang === authoredLanguage) return 'origin';
  return needsTranslation(record, boardLang) ? 'untranslated' : 'translated';
}
```

`needsTranslation` is reused unchanged (board-lang key absent ⇒ untranslated).

### 3.4 List card (group view)

**`app/components/app/lists/sections/ListsModeContent.tsx`**, in the list-card render (currently `labelTranslateState(list.name, language)` at ~line 182 and the Made-in pill at ~line 215):

- Compute once: `const state = listTranslateState(list.name, language, list.authoredLanguage ?? DEFAULT_LOCALE);`
- **Control** (`TranslateRevertControl`): render only when `state !== 'origin'`; `untranslated` → translate glyph, `translated` → revert glyph. (`TranslateRevertControl` already renders nothing for the neutral state; `origin` is treated the same — render nothing / omit it.)
- **Made-in pill** (`MadeInLabel`): render when `state !== 'origin'` (both non-origin states, not just `untranslated`), with `lang={list.authoredLanguage ?? DEFAULT_LOCALE}` (was `resolvedLocale(...)`).

### 3.5 Item level (inside a list's detail view)

Items have no origin of their own — they inherit the **list's** `authoredLanguage`. Thread it down and use the same function.

- **`app/components/app/lists/sections/ListDetailContent.tsx`** — it holds `list`, so compute `const authoredLang = list.authoredLanguage ?? DEFAULT_LOCALE;` and pass it to `ListDetailEdit`. Gate the per-item translate/revert on it:
  - The `untranslated` filter (~line 317) and the item-translate entry use `listTranslateState(recordOf(it, srcLang), language, authoredLang)`.
  - `handleItemRevertConfirm` (~line 418): no-op when `language === authoredLang` (don't strip an item's master key on the origin board), in addition to not offering it.
- **`app/components/app/lists/sections/ListDetailEdit.tsx`** — accept an `authoredLanguage` prop; each per-item control (three variants: row/column/grid) uses `listTranslateState(item.descriptionRecord, language, authoredLanguage)` (replacing `labelTranslateState`), mapping `'origin' → 'none'` so no translate/revert glyph shows on the origin board. **Item level is control-only** — there is no existing per-item "Made in" pill, and none is added (the list-level badge already carries the origin signal). This keeps the item change to the destructive-revert fix.

### 3.6 Revert mutation guard (defense-in-depth)

**`convex/profileLists.ts` `revertProfileListLanguage`** — after loading the list, if `args.language === (list.authoredLanguage ?? DEFAULT_LOCALE)`, return early (never strip the master). This backs up the UI (which won't offer revert on the origin board) so a stray call can't delete the master. The existing last-key guard stays.

## 4. Components / interfaces touched

| File | Change |
|---|---|
| `convex/schema.ts` | `profileLists.authoredLanguage?: string` |
| `convex/profileLists.ts` | `createProfileList` stores `authoredLanguage`; `revertProfileListLanguage` guards the origin |
| `lib/languages/variants.ts` | new `listTranslateState(record, boardLang, authoredLanguage)` |
| `ListsModeContent.tsx` | create passes `authoredLanguage`; card uses `listTranslateState`; pill on both non-origin states, badge = authoredLanguage |
| `HomeContent.tsx` | create passes `authoredLanguage` |
| `ListDetailContent.tsx` | derive `authoredLang`, pass down, gate item revert on origin |
| `ListDetailEdit.tsx` | accept `authoredLanguage` prop; per-item control uses `listTranslateState` |
| `docs/4-builds/decisions/ADR-019-*.md` | record the decision |

## 5. Edge cases

- **Record missing the master key** (e.g. `{es}` with `authoredLanguage='en'` after some deletion): on a non-`en` board it reads as `translated`/`origin` per the keys present; revert is protected by the existing last-key guard (won't blank the record). Acceptable — the origin marker is authoritative for *affordances*; the last-key guard protects *data*.
- **`authoredLanguage` equals a language with no text yet**: still treated as origin on that board (no affordances). The master board shows whatever `displayString` resolves; not a regression.
- **Symmetry**: a list made in ES (`authoredLanguage='es'`), translated to EN → on EN board: "Made in ES" + revert (strips `en`, back to ES); on ES board: origin, nothing. Mirror of the EN-origin case.

## 6. Verification

No unit-test runner exists in this repo — verification is `tsc --noEmit` + `tsc -p convex/tsconfig.json` + ESLint, plus the **behavioural acceptance test**: create one list on the EN board and one on the ES board, then for each:
- On its **origin** board: no Made-in pill, no translate, no revert.
- On the **other** board before translating: "Made in \<origin\>" + Translate.
- Translate it, then on the other board: "Made in \<origin\>" + Revert; pressing Revert removes the variant and falls back to the master (master intact).
- Back on the **origin** board after translating: still clean (no destructive revert). ← the bug this fixes.
- Repeat one level down for an **item** inside a list.

## 7. Non-goals

- **No change to sentences/phrases** — they already carry `authoredLanguage` and variant rows.
- **No migration/backfill** of existing lists — the runtime `?? DEFAULT_LOCALE` fallback covers them.
- **Categories are out of scope.** The create-keying fix (`c095735`) already keys new category names under the board language, but categories have no `authoredLanguage` and their card affordances are not touched here. The same origin-awareness for categories is a possible follow-up, tracked separately.
- **No change to the translate pipeline** (the lowercase-item nudge shipped separately in `e1fd7ce`).
