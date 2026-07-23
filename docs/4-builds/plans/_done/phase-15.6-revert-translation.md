# Revert Translation — Implementation Plan

> **Status:** SUPERSEDED, never executed — archived 2026-07-22 for history only.
>
> ⚠️ **SUPERSEDED (2026-07-18).** This standalone revert plan is absorbed into the
> **Language Variant Lifecycle** model — see [`docs/superpowers/specs/2026-07-18-language-variant-lifecycle-design.md`](../../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md). Revert becomes **Stage 3** there, and its affordance changed from a badge-triggered scope modal to an **edit-toolbar icon** (owner decision). Do NOT execute this plan as-is; the helpers/i18n groundwork below are still reused. Kept for history.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.
> **Self-contained plan for a fresh session** (Phase 15.6). Full context below.
> **Design spec:** [`docs/superpowers/specs/2026-07-16-revert-translation-design.md`](../../../superpowers/specs/2026-07-16-revert-translation-design.md).

**Goal:** Add a **Revert** control — the mirror of Phase 15.5's translate badge — that removes the *active board's* version of an order-free label or composed-content variant, restoring the origin-language fallback and making the "Made in <lang>" badge reappear. **Edit mode only.**

**Architecture:** One presentational `RevertBadge` pill (rendered by callers when a board version exists and a fallback survives) + the existing generic `TranslateChoiceModal` reused as the always-confirm scope-picker. Two data operations under one concept: **labels** (folder/list/item) delete the board-language **key** from the localised record; **composed content** (sentence/phrase variants) delete the board-language **sibling row**. Nothing writes to origin or other languages.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Convex / next-intl / Tailwind 4 (theme tokens only). No MT calls (revert only removes).

## Global Constraints (verbatim from project rules)
- **No hard-coded UI copy** — every string via `useTranslations`; add new keys to **`messages/en.json` only** (never hand-add to other locales — the pipeline treats present keys as already-translated).
- **Theme tokens only** — never hard-code colours/spacing/radii/font-sizes in AAC UI; use `bg-theme-*`, `text-theme-*`, `rounded-theme*`, `p-theme-*`, `gap-theme-*`, CSS vars `var(--theme-*)`.
- **No test harness.** Verify each task with: `npx tsc --noEmit` (ignore pre-existing `lib/stripe.ts` + `.next/dev/types` generated staleness) AND `npx tsc -p convex/tsconfig.json --noEmit`, plus manual on the running app (dev server managed by the owner — do NOT start it; do NOT run `npx convex dev`). Node 20 for any convex CLI: `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **Commit per task.**
- **Pro-tier gated** — revert lives in edit mode, which is already Pro-gated on lists/sentences/phrases; no new gating.

## Background / decisions (owner-approved in brainstorm)
- **Revert is the inverse of translate.** A field is either *Untranslated* (no board version → view-mode "Made in <origin>" badge, Phase 15.5, unchanged) or *Translated* (board version exists → **edit-mode** "Revert to <origin>" badge). Never both at once.
- **Always confirm:** the badge opens `TranslateChoiceModal`; choosing a destructive option in the modal *is* the confirmation (no second dialog).
- **Scopes match translate:** list title/item → "revert whole list" (title + every item, **board key only**) + "revert just this one"; folder name → single "revert this name"; sentence/phrase → single "revert this one".
- **Guardrails:** never leave a field empty (labels need ≥1 non-board key; variants need a surviving source); no revert on the origin board; active board only.
- **Composed content** (sentences/phrases) revert deletes the board-language sibling ROW; source + other siblings survive; the group falls back. No "delete across all languages" action.

## Reuse map (existing code — DO NOT reinvent)
- `needsTranslation(record, boardLang)` → `lib/languages/variants.ts` — drives the Phase 15.5 "Made in" badge (untranslated state).
- `resolvedLocale(record, lang, DEFAULT_LOCALE)` / `displayString(...)` → `lib/languages/displayValue.ts`.
- `variantGroupKey(row)` / `collapseVariants(rows, lang)` → `lib/languages/variants.ts` — composed-content collapse; a row is the SOURCE when `variantGroupKey(row) === row._id`.
- `TranslateChoiceModal` → `app/components/app/shared/modals/TranslateChoiceModal.tsx` — generic mode-picker: `options: {mode,label,hint?,icon?,primary?}[]`, `onChoose(mode) => Promise<void>` (reject → error). Icon union currently `'translate'|'manual'|'list'`.
- `TranslateBadge` → `app/components/app/shared/ui/TranslateBadge.tsx` — Phase 15.5 view-mode pill (reference for styling; leave as-is).
- `DEFAULT_LOCALE` → `lib/languages/registry.ts`.
- Mutations (labels — full-replace records, caller prunes): `api.profileFolders.renameFolder`, `api.profileCategories.updateCategoryMeta`, `api.profileLists.updateProfileListName`, `api.profileLists.updateProfileListItems`. Query for whole-list items from the grid: `api.profileLists.getProfileListWithItems` (returns `{name, items}`; item `description` is `string | Record<string,string>`).
- Mutations (variants — delete a row): `api.profileSentences.deleteProfileSentence` (`convex/profileSentences.ts:309`), `api.profilePhrases.deleteProfilePhrase`.

## File structure
- **New** `app/components/app/shared/ui/RevertBadge.tsx` — presentational edit-mode pill.
- **Modify** `lib/languages/variants.ts` — add `stripLocaleKey` + `canRevertLabel` pure helpers.
- **Modify** `app/components/app/shared/modals/TranslateChoiceModal.tsx` — add `'revert'` icon.
- **Modify** `messages/en.json` — revert keys in the `translate` namespace.
- **Modify** `app/components/app/shared/ui/GroupTile.tsx` (+ `GroupsView.tsx`, `CategoriesContent.tsx`) — folder/category name revert.
- **Modify** `app/components/app/lists/sections/ListsModeContent.tsx` — list-title revert.
- **Modify** `app/components/app/lists/sections/ListDetailContent.tsx` + `ListDetailEdit.tsx` — list-item revert.
- **Modify** `app/components/app/sentences/sections/SentencesModeContent.tsx` — sentence-variant revert.
- **Modify** `app/components/app/shared/ui/TalkerDropdown.tsx` — phrase-variant revert.
- **Modify** `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md` — Addendum F.

---

### Task 1: Shared primitives — RevertBadge, helpers, TranslateChoiceModal icon, i18n

**Files:** Create `app/components/app/shared/ui/RevertBadge.tsx`; Modify `lib/languages/variants.ts`, `app/components/app/shared/modals/TranslateChoiceModal.tsx`, `messages/en.json`.

**Interfaces produced (used by every later task):**
- `RevertBadge({ originLang, onClick, className? }: { originLang: string; onClick: () => void; className?: string })` — always renders when mounted; the caller gates visibility.
- `stripLocaleKey(record: Record<string,string> | undefined, lang: string): Record<string,string>` — new record without `lang`.
- `originLocale(record: Record<string,string> | undefined, defaultLocale?: string): string | undefined` — the record's base/authored language (en-privileged, else first key). `undefined` for empty/absent.
- `canRevertLabel(record: Record<string,string> | undefined, lang: string): boolean` — `true` iff `record` has `lang` AND `lang` is NOT the record's origin (so revert removes a *translation* and always falls back to the origin — never deletes the base text).

**Origin model (important):** labels have no stored `authoredLanguage`, so origin is defined exactly as the existing `resolvedLocale` fallback chain treats it — **`DEFAULT_LOCALE` (`en`) if present, else the first key**. This matches Phase 15.5's "Made in <origin>" (which privileges `en` via `resolvedLocale` tier 2). Consequence: revert only ever removes a **non-origin** board key and always falls back to that origin. On the origin board, `canRevertLabel` is `false`, so no badge appears (you can't delete the base). Content whose only base is the board language is likewise not revertable — correct, there's nothing to fall back to.

- [ ] **Step 1 — helpers** in `lib/languages/variants.ts` (append near `needsTranslation`):
```ts
import { DEFAULT_LOCALE } from "./registry"; // already imported at top of variants.ts

/** A new record with `lang` removed. Never mutates the input. */
export function stripLocaleKey(
  record: Record<string, string> | undefined,
  lang: string,
): Record<string, string> {
  if (!record) return {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [lang]: _removed, ...rest } = record;
  return rest;
}

/** The record's base/authored language: DEFAULT_LOCALE if present (the fallback
 *  chain privileges it), else the first key. `undefined` when empty/absent.
 *  Matches how `resolvedLocale` picks the origin for the "Made in" badge. */
export function originLocale(
  record: Record<string, string> | undefined,
  defaultLocale: string = DEFAULT_LOCALE,
): string | undefined {
  if (!record) return undefined;
  const keys = Object.keys(record);
  if (keys.length === 0) return undefined;
  return defaultLocale in record ? defaultLocale : keys[0];
}

/** Whether a localised label can be reverted for `lang`: it has a `lang` entry
 *  and `lang` is NOT the record's origin — so revert removes a translation and
 *  falls back to the origin, never deleting the base text (and never on the
 *  origin board). */
export function canRevertLabel(
  record: Record<string, string> | undefined,
  lang: string,
): boolean {
  if (!record || !(lang in record)) return false;
  const origin = originLocale(record);
  return origin !== undefined && origin !== lang;
}
```
(Note: `variants.ts` already imports `DEFAULT_LOCALE` from `./registry` — reuse it, don't re-add the import.)
- [ ] **Step 2 — i18n keys** (`messages/en.json`, inside the existing `"translate"` namespace — en.json ONLY):
```json
"revertBadge": "Revert to {lang}",
"revertTitle": "Revert to {lang}",
"revertChooseDescription": "Remove the {lang} version and fall back to {origin}.",
"revertWholeList": "Revert whole list",
"revertWholeListHint": "Title and every item back to {origin}.",
"revertThisTitle": "Revert the title",
"revertThisItem": "Revert this item",
"revertThisName": "Revert this name",
"revertThisOne": "Revert this one"
```
- [ ] **Step 3 — RevertBadge component** (`app/components/app/shared/ui/RevertBadge.tsx`). Presentational only — visually distinct from the brand-primary "Made in" pill (outline/muted), edit-mode management action:
```tsx
"use client";

import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';

/** Edit-mode "Revert to <origin>" pill (Phase 15.6). Presentational: the caller
 *  decides when to mount it (field is translated for the board AND a fallback
 *  survives). Tapping opens the revert modal. Mirror of TranslateBadge. */
export function RevertBadge({ originLang, onClick, className }: {
  originLang: string;
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations('translate');
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={t('revertTitle', { lang: originLang.toUpperCase() })}
      className={`shrink-0 self-center inline-flex items-center gap-1 rounded-full text-theme-xs font-semibold px-3 py-1 whitespace-nowrap transition-opacity hover:opacity-80 cursor-pointer ${className ?? ''}`}
      style={{ background: 'transparent', color: 'var(--theme-text-primary)', border: '1px solid var(--theme-enter-mode)' }}
    >
      <RotateCcw className="w-3.5 h-3.5" />
      {t('revertBadge', { lang: originLang.toUpperCase() })}
    </button>
  );
}
```
- [ ] **Step 4 — add `'revert'` icon** to `TranslateChoiceModal.tsx`: extend the `TranslateOption.icon` union to `'translate' | 'manual' | 'list' | 'revert'`, import `RotateCcw`, and add `revert: RotateCcw` to the `Icon` map.
- [ ] **Step 5 — verify.** `npx tsc --noEmit` clean (no `app/`|`lib/`|`convex/` errors). Commit: `git commit -am "feat(phase15.6): RevertBadge + revert helpers + i18n"`.

---

### Task 2: Folder / category / group name revert (GroupTile)

`GroupTile` is shared by list groups, sentence groups (`GroupsView`) and categories (`CategoriesContent`) — all pass `nameRecord` + `language` + `onRename`. Add an edit-mode revert badge + a parent-driven prune.

**Files:** Modify `app/components/app/shared/ui/GroupTile.tsx`, `app/components/app/shared/sections/GroupsView.tsx`, `app/components/app/categories/sections/CategoriesContent.tsx`.

**Interfaces:** GroupTile gains `onRevert?: () => void` (parent prunes the board key). Consumes `RevertBadge`, `canRevertLabel`, `stripLocaleKey`, `TranslateChoiceModal`.

- [ ] **Step 1 — GroupTile state + imports.** Import `RevertBadge`; import `canRevertLabel`, `originLocale` from `@/lib/languages/variants`. Add `onRevert?: () => void` to `Props` and destructure it. Replace the single `translateOpen` boolean with a modal enum: `const [modal, setModal] = useState<'translate' | 'revert' | null>(null)` (update the existing translate open/close calls to `setModal('translate')` / `setModal(null)`).
- [ ] **Step 2 — edit-mode badge.** In the `isEditing` title branch (next to the rename input, inside the existing flex/`<input>` area), render the revert pill when the name is translated for the board:
```tsx
{isEditing && language && canRevertLabel(nameRecord, language) && (
  <RevertBadge
    originLang={originLocale(nameRecord) ?? DEFAULT_LOCALE}
    onClick={() => setModal('revert')}
  />
)}
```
(Wrap the `<input>` + badge in a `flex items-center gap-1` container, mirroring the pre-15.5 layout. `DEFAULT_LOCALE` is already imported in GroupTile.)
- [ ] **Step 3 — revert modal + handler.** Render a second `TranslateChoiceModal` (or reuse one, branching options on `modal`) when `modal === 'revert'`:
```tsx
{language && nameRecord && (
  <TranslateChoiceModal
    isOpen={modal === 'revert'}
    onClose={() => setModal(null)}
    title={tTranslate('revertTitle', { lang: language.toUpperCase() })}
    description={tTranslate('revertChooseDescription', {
      lang: language.toUpperCase(),
      origin: (originLocale(nameRecord) ?? DEFAULT_LOCALE).toUpperCase(),
    })}
    options={[{ mode: 'revert', label: tTranslate('revertThisName'), icon: 'revert', primary: true }]}
    onChoose={async () => { onRevert?.(); setModal(null); }}
  />
)}
```
- [ ] **Step 4 — parents prune the board key.** In `GroupsView.tsx` add to each `<GroupTile>`: `onRevert={() => renameFolder({ folderId: folder._id, name: stripLocaleKey(folder.name, language) })}` (import `stripLocaleKey`). In `CategoriesContent.tsx` add: `onRevert={() => updateCategoryMeta({ profileCategoryId: cat._id, name: stripLocaleKey(cat.name, language) })}` (import `stripLocaleKey`).
- [ ] **Step 5 — verify.** tsc clean. Manual: on an ES board, a folder/category translated to ES shows (in edit mode) "Revert to EN"; tap → confirm → name falls back to EN and the view-mode "Made in EN" badge returns; other languages retained; no badge on the EN board. Commit: `git commit -am "feat(phase15.6): folder/category/group name revert"`.

---

### Task 3: List-title revert (ListsModeContent)

**Files:** Modify `app/components/app/lists/sections/ListsModeContent.tsx`.

**Interfaces:** `SortableListRow` gains `onRevertList: (id) => void`; parent gains a `revertTarget` state + modal + handlers (reuses `getProfileListWithItems`, `renameList`, `updateListItems`).

- [ ] **Step 1 — badge on the row (edit mode).** In `SortableListRow`, import `RevertBadge`; import `canRevertLabel`, `originLocale`, `stripLocaleKey` from `@/lib/languages/variants`. Add prop `onRevertList: (id: Id<'profileLists'>) => void`. In the name area, when `isEditing && canRevertLabel(list.name, language)`, render:
```tsx
<RevertBadge
  originLang={originLocale(list.name) ?? DEFAULT_LOCALE}
  onClick={() => onRevertList(list._id)}
/>
```
(`DEFAULT_LOCALE` is already imported in this file from Phase 15.5.)
- [ ] **Step 2 — parent state + query.** Add `const [revertTarget, setRevertTarget] = useState<Id<'profileLists'> | null>(null)` and `const revertFullList = useQuery(api.profileLists.getProfileListWithItems, revertTarget ? { profileListId: revertTarget } : 'skip')`. Pass `onRevertList={(id) => setRevertTarget(id)}` to `SortableListRow`.
- [ ] **Step 3 — modal + handlers.** Render `TranslateChoiceModal` when `revertTarget`:
```tsx
{revertTarget && (() => {
  const name = listMap[revertTarget]?.name ?? {};
  const origin = (originLocale(name) ?? DEFAULT_LOCALE).toUpperCase();
  return (
    <TranslateChoiceModal
      isOpen
      onClose={() => setRevertTarget(null)}
      title={tTranslate('revertTitle', { lang: language.toUpperCase() })}
      description={tTranslate('revertChooseDescription', { lang: language.toUpperCase(), origin })}
      options={[
        { mode: 'whole', label: tTranslate('revertWholeList'), hint: tTranslate('revertWholeListHint', { origin }), icon: 'list', primary: true },
        { mode: 'title', label: tTranslate('revertThisTitle'), icon: 'revert' },
      ]}
      onChoose={handleRevertChoice}
    />
  );
})()}
```
Handler (prunes the BOARD key only):
```tsx
async function handleRevertChoice(mode: string) {
  if (!revertTarget) return;
  const name = listMap[revertTarget]?.name ?? revertFullList?.name ?? {};
  if (mode === 'title') {
    await renameList({ profileListId: revertTarget, name: stripLocaleKey(name, language) });
    setRevertTarget(null);
    return;
  }
  // 'whole' — title + every item, board key only.
  if (!revertFullList) throw new Error('list not loaded');
  await renameList({ profileListId: revertTarget, name: stripLocaleKey(revertFullList.name, language) });
  await updateListItems({
    profileListId: revertTarget,
    items: revertFullList.items.map((it, i) => ({
      imagePath: it.imagePath,
      order: i,
      description:
        it.description === undefined ? undefined
        : typeof it.description === 'string' ? it.description
        : stripLocaleKey(it.description, language),
      audioPath: it.audioPath,
      activeAudioSource: it.activeAudioSource,
      defaultAudioPath: it.defaultAudioPath,
      generatedAudioPath: it.generatedAudioPath,
      recordedAudioPath: it.recordedAudioPath,
      imageSourceType: it.imageSourceType,
    })),
  });
  setRevertTarget(null);
}
```
- [ ] **Step 4 — verify.** tsc clean. Manual: ES board, a list translated to ES → edit mode shows "Revert to EN" on the tile → "Revert the title" drops ES from the title only; "Revert whole list" drops ES from title + all items (open list to confirm items fell back + their "Made in" badges returned). Commit: `git commit -am "feat(phase15.6): list-title revert (whole/title)"`.

---

### Task 4: List-item revert (ListDetailContent + ListDetailEdit)

**Files:** Modify `app/components/app/lists/sections/ListDetailEdit.tsx`, `app/components/app/lists/sections/ListDetailContent.tsx`.

**Interfaces:** `EditItemProps` + `EditContainerProps` gain `language: string` and `onRevert: (index) => void`; `ListDetailContent` gains `itemRevert` state + modal + handlers (reuses `localItems`, `persistItems`, `renameList`).

- [ ] **Step 1 — thread props (ListDetailEdit).** Import `RevertBadge`; import `canRevertLabel`, `originLocale` from `@/lib/languages/variants`; import `DEFAULT_LOCALE`. Add `language: string` and `onRevert: () => void` to `EditItemProps`, and `language: string` + `onRevert: (index: number) => void` to `EditContainerProps`. Pass `language={language}` and `onRevert={() => onRevert(idx)}` from `EditRows`/`EditColumns`/`EditGrid` to each `SortableEditRow`/`SortableEditColumn`/`SortableEditGrid`.
- [ ] **Step 2 — badge in each edit item.** In `SortableEditRow`, `SortableEditColumn`, `SortableEditGrid`, after the `<input>`, render:
```tsx
{canRevertLabel(item.descriptionRecord, language) && (
  <RevertBadge
    originLang={originLocale(item.descriptionRecord) ?? DEFAULT_LOCALE}
    onClick={onRevert}
  />
)}
```
- [ ] **Step 3 — ListDetailContent: pass props + state.** Add `language` + `onRevert: (index) => setItemRevert(index)` to `editProps`. Add `const [itemRevert, setItemRevert] = useState<number | null>(null)`.
- [ ] **Step 4 — modal + handlers** (mirror the item-translate handler; prune instead of fill):
```tsx
{itemRevert !== null && (() => {
  const origin = (originLocale(localItems[itemRevert]?.descriptionRecord) ?? DEFAULT_LOCALE).toUpperCase();
  return (
    <TranslateChoiceModal
      isOpen
      onClose={() => setItemRevert(null)}
      title={tTranslate('revertTitle', { lang: language.toUpperCase() })}
      description={tTranslate('revertChooseDescription', { lang: language.toUpperCase(), origin })}
      options={[
        { mode: 'whole', label: tTranslate('revertWholeList'), hint: tTranslate('revertWholeListHint', { origin }), icon: 'list', primary: true },
        { mode: 'one', label: tTranslate('revertThisItem'), icon: 'revert' },
      ]}
      onChoose={handleItemRevertChoice}
    />
  );
})()}
```
```tsx
async function handleItemRevertChoice(mode: string) {
  if (itemRevert === null || !list) return;
  const i = itemRevert;
  const prune = (rec: Record<string, string> | undefined) => stripLocaleKey(rec, language);
  if (mode === 'one') {
    const next = localItems.map((it, idx) => {
      if (idx !== i) return it;
      const rec = prune(it.descriptionRecord);
      return { ...it, descriptionRecord: rec, description: displayString(rec, language, DEFAULT_LOCALE) };
    });
    setLocalItems(next);
    await persistItems(next);
    setItemRevert(null);
    return;
  }
  // 'whole' — title + every item, board key only.
  await renameList({ profileListId: listId, name: stripLocaleKey(list.name, language) });
  const next = localItems.map((it) => {
    const rec = prune(it.descriptionRecord);
    return { ...it, descriptionRecord: rec, description: displayString(rec, language, DEFAULT_LOCALE) };
  });
  setLocalItems(next);
  await persistItems(next);
  setItemRevert(null);
}
```
(`displayString`, `DEFAULT_LOCALE` already imported in ListDetailContent from Phase 15.5; add `stripLocaleKey`, `originLocale`. `persistItems` already saves `descriptionRecord`.)
- [ ] **Step 5 — verify.** tsc clean. Manual: ES board, list detail in edit mode → translated items show "Revert to EN" → "Revert this item" drops ES from one; "Revert whole list" drops ES from title + all. Exit edit → reverted items show "Made in EN" and play in EN (voice-follows-text). Commit: `git commit -am "feat(phase15.6): list-item revert (whole/one)"`.

---

### Task 5: Sentence-variant revert (SentencesModeContent)

A collapsed sentence row is a **revertable board variant** when it is NOT the source and is authored in the board language: `variantGroupKey(sentence) !== sentence._id && (sentence.authoredLanguage ?? DEFAULT_LOCALE) === language`. Reverting deletes that row; the group falls back to source.

**Files:** Modify `app/components/app/sentences/sections/SentencesModeContent.tsx`.

- [ ] **Step 1 — origin lookup + badge (edit mode).** Import `RevertBadge`; import `variantGroupKey` from `@/lib/languages/variants` (`collapseVariants`/`needsTranslation` already imported; `deleteSentence` mutation already bound). In the parent, build an origin-language lookup from the uncollapsed list: `const sourceLangById = new Map(allSentences?.map(s => [s._id, s.authoredLanguage ?? DEFAULT_LOCALE]) ?? [])`. Pass to each `SentenceRow` a prop `revertOriginLang={sourceLangById.get(variantGroupKey(sentence)) ?? DEFAULT_LOCALE}` and `onRevert={() => setRevertTarget(sentence)}`.
- [ ] **Step 2 — SentenceRow badge.** Add props `revertOriginLang: string` and `onRevert: () => void`. In the `isEditing` branch (near the existing edit controls / where the `!isEditing && badgeLang` badge is), render when revertable:
```tsx
{isEditing
  && variantGroupKey(sentence) !== sentence._id
  && (sentence.authoredLanguage ?? DEFAULT_LOCALE) === language && (
  <RevertBadge originLang={revertOriginLang} onClick={onRevert} />
)}
```
- [ ] **Step 3 — parent modal + handler.** Add `const [revertTarget, setRevertTarget] = useState<Doc<'profileSentences'> | null>(null)`. Render:
```tsx
{revertTarget && (
  <TranslateChoiceModal
    isOpen
    onClose={() => setRevertTarget(null)}
    title={tTranslate('revertTitle', { lang: language.toUpperCase() })}
    description={tTranslate('revertChooseDescription', {
      lang: language.toUpperCase(),
      origin: (sourceLangById.get(variantGroupKey(revertTarget)) ?? DEFAULT_LOCALE).toUpperCase(),
    })}
    options={[{ mode: 'revert', label: tTranslate('revertThisOne'), icon: 'revert', primary: true }]}
    onChoose={async () => { await deleteSentence({ profileSentenceId: revertTarget._id }); setRevertTarget(null); }}
  />
)}
```
(Add a `const tTranslate = useTranslations('translate')` alongside the existing `t`.)
- [ ] **Step 4 — verify.** tsc clean. Manual: ES board with a sentence that has an ES variant → edit mode shows "Revert to EN" on that row → confirm → the ES variant row is deleted, the row collapses to the EN source and shows "Made in EN" in view mode; other-language variants untouched. Commit: `git commit -am "feat(phase15.6): sentence-variant revert"`.

---

### Task 6: Phrase-variant revert (TalkerDropdown)

Phrases mirror sentences: sibling variant rows, `collapseVariants`, `deleteProfilePhrase`. Same revert condition, keyed on `p.name` + `authoredLanguage`.

**Files:** Modify `app/components/app/shared/ui/TalkerDropdown.tsx`.

- [ ] **Step 1 — locate the phrase edit-mode flag + row render.** In `TalkerDropdown`, find the phrase list render (uses `phraseList = collapseVariants(phrases, language)` ~`:307` and the `needsTranslation(p.name, language)` "Made in" badge ~`:622`) and the component's edit-mode boolean (grep `isEditing`/`editMode` in this file). The revert badge goes in that render, edit-mode branch.
- [ ] **Step 2 — origin lookup + badge.** Build `const phraseSourceLang = new Map(phrases?.map(p => [p._id, p.authoredLanguage ?? DEFAULT_LOCALE]) ?? [])`. Where each collapsed phrase `p` renders, in edit mode add:
```tsx
{isEditing
  && variantGroupKey(p) !== p._id
  && (p.authoredLanguage ?? DEFAULT_LOCALE) === language && (
  <RevertBadge
    originLang={(phraseSourceLang.get(variantGroupKey(p)) ?? DEFAULT_LOCALE)}
    onClick={() => setPhraseRevertTarget(p)}
  />
)}
```
(Import `RevertBadge`, `variantGroupKey`; `collapseVariants`/`needsTranslation` already imported. Use the file's actual edit-mode flag name from Step 1.)
- [ ] **Step 3 — modal + handler.** Add `const [phraseRevertTarget, setPhraseRevertTarget] = useState<Doc<'profilePhrases'> | null>(null)` and a `const tTranslate = useTranslations('translate')`. Render:
```tsx
{phraseRevertTarget && (
  <TranslateChoiceModal
    isOpen
    onClose={() => setPhraseRevertTarget(null)}
    title={tTranslate('revertTitle', { lang: language.toUpperCase() })}
    description={tTranslate('revertChooseDescription', {
      lang: language.toUpperCase(),
      origin: (phraseSourceLang.get(variantGroupKey(phraseRevertTarget)) ?? DEFAULT_LOCALE).toUpperCase(),
    })}
    options={[{ mode: 'revert', label: tTranslate('revertThisOne'), icon: 'revert', primary: true }]}
    onChoose={async () => { await deleteProfilePhrase({ profilePhraseId: phraseRevertTarget._id }); setPhraseRevertTarget(null); }}
  />
)}
```
- [ ] **Step 4 — verify.** tsc clean. Manual: ES board, a phrase with an ES variant → talker edit mode shows "Revert to EN" → confirm → ES phrase variant deleted, collapses to EN source + "Made in EN". Commit: `git commit -am "feat(phase15.6): phrase-variant revert"`.

---

### Task 7: Docs + final verify

- [ ] **Step 1 — ADR addendum** in `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`: **Addendum F** — Revert is the mirror of the Phase 15.5 translate badge; edit-mode only; two-model semantics (label board-key delete vs variant board-row delete); guardrails (never empty, no revert on origin board, active-board only); reuses `TranslateChoiceModal` as the always-confirm scope-picker.
- [ ] **Step 2 — full verify.** `npx tsc --noEmit` (excl. known-stale `.next/dev/types` + `lib/stripe.ts`) + `npx tsc -p convex/tsconfig.json --noEmit` both clean.
- [ ] **Step 3 — matrix walk (manual, running app).** Per board EN/ES/HI, for folder name / category name / list title / list item / sentence variant / phrase variant:
  1. Translated field: edit mode shows "Revert to <origin>"; view mode shows no badge.
  2. Single revert → confirm → falls back to origin; "Made in <origin>" returns; other languages unchanged.
  3. "Revert whole list" → title + every item fall back for the BOARD language only.
  4. Origin board → no Revert badge.
  5. Field with only the board version → no Revert badge.
  6. Sentence/phrase: revert deletes the board variant row; source + other siblings survive.
  7. Translate ↔ Revert round-trips and survives a board switch.
- [ ] **Step 4 — commit** docs: `git commit -am "docs(phase15.6): ADR-016 Addendum F — revert translation"`.

## Self-review notes
- **Coverage vs spec:** RevertBadge + helpers + modal icon (T1) · folder/category/group (T2) · list title (T3) · list items (T4) · sentence variants (T5) · phrase variants (T6) · docs + matrix (T7). Guardrails (`canRevertLabel`, source-survives, origin-board) enforced at each badge's mount condition.
- **Type consistency:** `stripLocaleKey`/`canRevertLabel`/`RevertBadge` signatures are fixed in T1 and consumed unchanged in T2–T6. Modal `onChoose(mode)` returns `Promise<void>` and rejects → the modal shows its error; revert handlers `setX(null)` on success.
- **No new mutations/schema:** labels reuse `updateProfileListName`/`updateProfileListItems`/`renameFolder`/`updateCategoryMeta` with pruned records; variants reuse `deleteProfileSentence`/`deleteProfilePhrase`.
- **Scope guard:** translate flow (Phase 15.5) and `VariantAuthorModal` are untouched. No view-mode revert. No "delete across all languages".
- **Open confirm during T6:** the exact edit-mode flag name + phrase row render location in `TalkerDropdown` (Step 1 locates it before editing).
```
