# Lists Live-Translation Badge System — Implementation Plan

> **Status:** ✅ SHIPPED (archived 2026-07-22). [ADR-016:222](../../decisions/ADR-016-composed-content-language-variants.md) marks this plan "Implemented by". **Superseded by [ADR-016 Addendum K](../../decisions/ADR-016-composed-content-language-variants.md#addendum-k--edit-mode-only-translation-affordances):** the view-mode "Made in" badge built here is edit-mode-only now (`TranslateRevertControl` + `MadeInLabel`); `TranslateBadge` has been deleted.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.
> **This is a self-contained plan for a fresh session** (Phase 15.5 continuation). All context is below.

**Goal:** Give order-free content (folder/group names, list titles, list item descriptions) a consistent, discoverable on-demand translation UX — a view-mode "Made in <lang>" badge that opens a shared modal to translate or edit manually — reusing the sentence/phrase flow.

**Architecture:** One `TranslateBadge` (shown when a localised record lacks the board-language key) + one generic `TranslateChoiceModal` (a mode-picker; the parent runs the work). Translation fills the missing board-language key(s) via the existing MT helpers and persists silently (no forced edit mode). Manual opens the field's edit affordance. Lists must first be made multi-language-safe so translations aren't clobbered on the next save.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Convex / next-intl / Tailwind 4 (theme tokens only). MT via existing `POST /api/translate-text` (Gemini/Vertex).

## Global Constraints (verbatim from project rules)
- **No hard-coded UI copy** — every string via `useTranslations`; add new keys to **`messages/en.json` only** (never hand-add to other locales — the pipeline treats present keys as already-translated).
- **Theme tokens only** — never hard-code colours/spacing/radii/font-sizes in AAC UI; use `bg-theme-*`, `text-theme-*`, `rounded-theme*`, `p-theme-*`, `gap-theme-*`, CSS vars `var(--theme-*)`.
- **No test harness.** Verify each task with: `npx tsc --noEmit` (ignore pre-existing `lib/stripe.ts` + `.next/types`) AND `npx tsc -p convex/tsconfig.json --noEmit`, plus manual on the running app (dev server already on :3001 — do NOT start it; do NOT run `npx convex dev`). Node 20 for any convex CLI: `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **Work on `main`, commit per task.** `convex dev` auto-pushes on `main`.
- **Pro-tier gated** — the list/folder mutations already call `requireProTier`; no change.

## Background / decisions (owner-approved in brainstorm)
- Lists are **order-free** (translate live per board language). A user-created list only has the keys it was authored with → on another board it falls back to English with no affordance. Default modules ship localised; user content doesn't.
- **View-mode badges** (like sentences/phrases), NOT edit-mode icons.
- **Folders join the same system** — replace the slice-3 edit-mode translate icon on `GroupTile` with the view-mode badge + modal.
- **Folder modal = translate NAME only** (2 options: translate name / manual). No module cascade.
- **List/item modal = 3 options:** whole list (title + all items) / just this one / manual.
- **Translate applies silently** (fills key + persists, no edit mode). **Manual** opens the field's edit.
- **Audio: no work** — list playback is voice-follows-text (`ListItemPlayModal` in `ListDetailDisplay.tsx:82-96` calls `playTts(item.description, voiceId)`, re-resolved from the board-language description). Human recordings keep their language (expected).

## Reuse map (existing code — DO NOT reinvent)
- `needsTranslation(record, boardLang)` → `lib/languages/variants.ts` — true when the record lacks a board-language entry (drives the badge).
- `resolvedLocale(record, lang, DEFAULT_LOCALE)` / `displayString(...)` → `lib/languages/displayValue.ts` — the language a record resolves to / its string.
- `makeRecordFiller(records, srcLang, targetLang)` → `lib/languages/translateClient.ts` — batch-translates the unique source values of records missing `targetLang`; returns a generic `fill(record)` that adds the key (used by sentence/phrase translate). `translateTexts(texts, targetLang)` for one-off strings.
- `DEFAULT_LOCALE` → `lib/languages/registry.ts`; `getLanguage(code)?.nativeLabel` for a language's label.
- `VariantAuthorModal` → `app/components/app/shared/modals/VariantAuthorModal.tsx` — the current sentence/phrase mode-picker (Dialog shell + busy/error + option buttons). **Leave as-is**; Task 2's new modal mirrors its shell.
- `Dialog*` → `app/components/app/shared/ui/Dialog.tsx`.
- Mutations: `api.profileFolders.renameFolder`; `api.profileLists.updateProfileListName` (arg `{profileListId, name: record}` — full replace, caller must merge); `api.profileLists.updateProfileListItems` (arg `{profileListId, items: [...]}` — full replace; each item `description` accepts `string | record` union, `convex/profileLists.ts:127-129`).

## File structure
- **New** `app/components/app/shared/ui/TranslateBadge.tsx` — the pill; renders iff `needsTranslation`.
- **New** `app/components/app/shared/modals/TranslateChoiceModal.tsx` — generic mode-picker (options array + `onChoose`).
- **Modify** `app/components/app/shared/ui/GroupTile.tsx` — swap slice-3 edit-icon for the view-mode badge + modal (name-only).
- **Modify** `app/components/app/lists/sections/ListsModeContent.tsx` — list-title badge + modal; fix rename to MERGE.
- **Modify** `app/components/app/lists/sections/ListDetailContent.tsx` — multi-language-safe item records; item badge + modal + whole-list translate.
- **Modify** `messages/en.json` — new `translate` namespace.
- **Untouched:** sentences/phrases + `VariantAuthorModal` stay as-is.
- **Modify** `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md` — addendum note.

---

### Task 0: Make lists multi-language-safe (prerequisite)

Fixes a latent data-loss bug (editing a multilingual list flattens all descriptions to one language) that would otherwise clobber translations.

**Files:** Modify `app/components/app/lists/sections/ListDetailContent.tsx`; Modify `app/components/app/lists/sections/ListsModeContent.tsx`.

- [ ] **Step 1 — ListDetailContent: carry the full description record.** In the `ListItem` type add `descriptionRecord?: Record<string,string>`. In the hydration effect (~`:93-104`, where `description` is set via `displayString(item.description, language, DEFAULT_LOCALE)`) ALSO set `descriptionRecord: typeof item.description === 'string' ? { [language]: item.description } : (item.description ?? {})`. (Keep the existing `description` display string.)
- [ ] **Step 2 — update on edit.** Where a description is edited (~`:166-169`, `next[index] = { ...next[index], description: value }`) ALSO set `descriptionRecord: { ...next[index].descriptionRecord, [language]: value }`.
- [ ] **Step 3 — persist the record.** In `persistItems` (~`:136-151`) change the sent `description` from `item.description` (string) to `item.descriptionRecord ?? { [language]: item.description }` so the localised record is saved (the mutation's union accepts it). Do this for the item-add path too if it builds items inline.
- [ ] **Step 4 — ListsModeContent rename MERGE.** In `handleEditNameSave` (~`:411-421`) change `name: { en: editingNameValue.trim() }` to `name: { ...(list?.name ?? {}), [language]: editingNameValue.trim() }` (get `list` for `editingNameId`; `language` is from `useProfile()`). Mirrors the detail-view `commitName` (`ListDetailContent.tsx:287-295`).
- [ ] **Step 5 — verify.** `npx tsc --noEmit` clean. Manual: on a HI board, edit a default module list's item + rename it, save, switch to EN → EN description/name still present (not flattened). Commit: `git commit -am "fix(phase15.5): lists multi-language-safe (preserve description records, merge rename)"`.

---

### Task 1: TranslateBadge + i18n

**Files:** Create `app/components/app/shared/ui/TranslateBadge.tsx`; Modify `messages/en.json`.

- [ ] **Step 1 — i18n keys** (en.json only), new namespace:
```json
"translate": {
  "madeInBadge": "Made in {lang}",
  "chooseTitle": "Translate to {lang}",
  "chooseDescription": "This is in {authoredLang}. Add a {lang} version.",
  "wholeList": "Translate whole list",
  "wholeListHint": "Title and every item, in one go.",
  "thisTitle": "Translate the title",
  "thisItem": "Translate this item",
  "thisName": "Translate this name",
  "one": "Translate just this one",
  "manual": "Type it myself",
  "manualHint": "Open editing to write it in {lang}.",
  "translating": "Translating…",
  "error": "Couldn't translate. Try again or type it."
}
```
- [ ] **Step 2 — TranslateBadge component:**
```tsx
"use client";
import { useTranslations } from 'next-intl';
import { needsTranslation } from '@/lib/languages/variants';
import { resolvedLocale } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';

/** View-mode "Made in <lang>" pill for order-free labels. Renders only when the
 *  record lacks the board-language key; tapping opens the translate modal. */
export function TranslateBadge({ record, language, onClick, className }: {
  record: Record<string, string> | undefined;
  language: string;
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations('translate');
  if (!needsTranslation(record, language)) return null;
  const loc = resolvedLocale(record, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={t('chooseTitle', { lang: language.toUpperCase() })}
      className={`shrink-0 self-center rounded-full text-theme-xs font-semibold px-3 py-1 whitespace-nowrap transition-opacity hover:opacity-80 cursor-pointer ${className ?? ''}`}
      style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
    >
      {t('madeInBadge', { lang: loc.toUpperCase() })}
    </button>
  );
}
```
- [ ] **Step 3 — verify** `npx tsc --noEmit` clean. Commit: `git commit -am "feat(phase15.5): TranslateBadge + translate i18n namespace"`.

---

### Task 2: TranslateChoiceModal (new, generic — for the new surfaces only)

**Files:** Create `app/components/app/shared/modals/TranslateChoiceModal.tsx`.
**Do NOT touch sentences/phrases** — `VariantAuthorModal` keeps working as-is (owner decision: don't refactor working code for dedup). The new modal is used only by folders/lists/items. A minor two-modal overlap is acceptable.

- [ ] **Step 1 — component** (shell mirrors VariantAuthorModal; options are data-driven):
```tsx
"use client";
import { useState } from 'react';
import { Pencil, Languages, List } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/app/shared/ui/Dialog';

export type TranslateOption = { mode: string; label: string; hint?: string; icon?: 'translate' | 'manual' | 'list'; primary?: boolean };

export function TranslateChoiceModal({ isOpen, onClose, title, description, options, onChoose }: {
  isOpen: boolean; onClose: () => void; title: string; description?: string;
  options: TranslateOption[];
  onChoose: (mode: string) => Promise<void>;   // parent does the work; reject → error
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function run(mode: string) {
    setBusy(mode); setError(false);
    try { await onChoose(mode); } catch { setError(true); setBusy(null); }
  }
  const Icon = { translate: Languages, manual: Pencil, list: List } as const;
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {options.map((o) => {
            const I = Icon[o.icon ?? 'translate'];
            return (
              <button key={o.mode} type="button" onClick={() => run(o.mode)} disabled={!!busy}
                className="flex items-start gap-3 w-full text-left p-theme-item rounded-theme-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={o.primary ? { background: 'var(--theme-primary)', color: 'var(--theme-alt-text)' } : { background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}>
                <I className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-theme-s font-semibold">{busy === o.mode ? '…' : o.label}</span>
                  {o.hint && <span className="text-theme-xs opacity-90">{o.hint}</span>}
                </span>
              </button>
            );
          })}
          {error && <p className="text-theme-xs font-medium" style={{ color: 'var(--theme-warning)' }}>Couldn't do that. Try again.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```
- [ ] **Step 2 — verify.** `npx tsc --noEmit` clean. (Sentences/phrases are untouched — nothing to regress.) Commit: `git commit -am "feat(phase15.5): generic TranslateChoiceModal for order-free labels"`.

---

### Task 3: Folder/group badge + modal (replace slice-3 icon)

**Files:** Modify `app/components/app/shared/ui/GroupTile.tsx`.

- [ ] **Step 1 — remove the slice-3 edit-mode translate icon** (`showTranslate`, `handleTranslateName`, the button next to the rename input, and `Languages` import if now unused). Keep `nameRecord` + `language` props.
- [ ] **Step 2 — add the view-mode badge.** In the non-editing title area, render `<TranslateBadge record={nameRecord} language={language} onClick={() => setTranslateOpen(true)} />` (add `const [translateOpen, setTranslateOpen] = useState(false)`). Only when `nameRecord` + `language` are provided.
- [ ] **Step 3 — modal + handler.** Render `TranslateChoiceModal` with options `[{mode:'translate', label:t('translate.thisName'), icon:'translate', primary:true}, {mode:'manual', label:t('translate.manual'), icon:'manual'}]`. `onChoose`: for `'translate'` → `const src = displayString(nameRecord, language, DEFAULT_LOCALE); const [tr] = await translateTexts([src], language); onRename?.(tr);` (onRename already merges at the parent — verify GroupsView `handleRename` merges `{...folder.name,[language]:v}`; it does). For `'manual'` → close modal + focus the rename input (set editing draft; simplest: call a new optional prop `onManualRename?.()` that the parent turns into entering the tile's rename, OR reuse the existing inline rename by setting a local editing flag). Then `setTranslateOpen(false)`.
- [ ] **Step 4 — verify.** tsc clean. Manual: HI board, a user folder with EN-only name shows the badge in view mode → tap → translate fills + persists (badge clears); default modules (all-language) show no badge. Commit: `git commit -am "feat(phase15.5): folder name badge+modal (unify slice 3)"`.

---

### Task 4: List-title badge + modal

**Files:** Modify `app/components/app/lists/sections/ListsModeContent.tsx`.

- [ ] **Step 1 — badge on the list tile.** In `SortableListRow`, near the name (view mode), render `<TranslateBadge record={list.name} language={language} onClick={() => onTranslateList(list._id)} />`. Thread an `onTranslateList(id)` prop from the parent (parent owns mutations + the full list).
- [ ] **Step 2 — parent state + modal.** In the parent, `const [translateTarget, setTranslateTarget] = useState<Id<'profileLists'>|null>(null)`. `onTranslateList={(id)=>setTranslateTarget(id)}`. Render `TranslateChoiceModal` when set, options `[{mode:'whole', label:t('translate.wholeList'), hint:t('translate.wholeListHint'), icon:'list', primary:true}, {mode:'title', label:t('translate.thisTitle'), icon:'translate'}, {mode:'manual', label:t('translate.manual'), icon:'manual'}]`.
- [ ] **Step 3 — handlers.** `title` → translate `list.name` → `renameList({profileListId:id, name:{...list.name,[language]:tr}})`. `whole` → **fetch the list's items** (the tile lacks them): use `const full = useQuery(api.profileLists.getProfileList, translateTarget ? {profileListId:translateTarget} : 'skip')` (confirm a by-id query exists in `convex/profileLists.ts`; if not, add `getProfileList`), then `const fill = await makeRecordFiller([full.name, ...full.items.map(i=>i.description-as-record)], srcLang, language)`; save `renameList` + `updateProfileListItems`. `manual` → navigate into the list edit / open the tile rename. Close modal after.
- [ ] **Step 4 — verify.** tsc clean. Manual: HI board, EN list tile shows badge → "Translate the title" fills title; "Translate whole list" fills title + all items (open the list to confirm); manual opens edit. Commit: `git commit -am "feat(phase15.5): list-title badge+modal (whole-list/title/manual)"`.

---

### Task 5: List-item badge + modal + whole-list

**Files:** Modify `app/components/app/lists/sections/ListDetailContent.tsx` (+ its display components if the badge renders inside `ListDetailDisplay.tsx`).

- [ ] **Step 1 — per-item badge.** In each item's view-mode render, show `<TranslateBadge record={item.descriptionRecord} language={language} onClick={() => setItemTranslate(index)} />`. Add `const [itemTranslate, setItemTranslate] = useState<number|null>(null)`.
- [ ] **Step 2 — modal.** `TranslateChoiceModal` when `itemTranslate !== null`, options `[{mode:'whole', label:t('translate.wholeList'), hint:t('translate.wholeListHint'), icon:'list', primary:true}, {mode:'one', label:t('translate.thisItem'), icon:'translate'}, {mode:'manual', label:t('translate.manual'), icon:'manual'}]`.
- [ ] **Step 3 — handlers** (`localItems` already loaded here). `one` → `const fill = await makeRecordFiller([localItems[i].descriptionRecord], srcLang, language)`; update that item's `descriptionRecord` (+ `description` display string for the board language) → `persistItems`. `whole` → `makeRecordFiller([list.name, ...localItems.map(i=>i.descriptionRecord)], srcLang, language)` → `renameList` (merge) + update every item's record + `persistItems`. `manual` → close + enter edit mode focused on that item. `srcLang = resolvedLocale(record, language, DEFAULT_LOCALE)`.
- [ ] **Step 4 — verify.** tsc clean. Manual: HI board, EN list items each show a badge → "Translate this item" fills one; "Translate whole list" fills title + all; translated items PLAY in Hindi (voice-follows-text); switch board away+back → filled translations retained. Commit: `git commit -am "feat(phase15.5): list-item badge+modal + whole-list translate"`.

---

### Task 6: Docs + final verify

- [ ] **Step 1 — ADR addendum** in `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`: note the unified live-translation badge system (TranslateBadge + TranslateChoiceModal) now covers folder names, list titles, and list item descriptions (order-free labels); folder edit-icon (slice 3) superseded by the view-mode badge; lists made multi-language-safe.
- [ ] **Step 2 — full verify.** `npx tsc --noEmit` (excl. known-stale) + `npx tsc -p convex/tsconfig.json --noEmit` both clean.
- [ ] **Step 3 — matrix walk (manual, running app).** Per board EN/ES/HI: folder name / list title / list item — badge shows when board-lang key absent, translate fills + persists + survives board switch, translated list items play in the board language, manual opens edit. Sentences/phrases untouched.
- [ ] **Step 4 — commit** docs.

## Self-review notes
- **Coverage:** badge (T1) · modal (T2) · folders (T3) · list title (T4) · items+whole (T5) · lists-safe prerequisite (T0) · docs (T6). All owner decisions mapped.
- **Types:** `TranslateOption.mode` is a free string; each parent's `onChoose` switches on its own mode set (`'translate'|'manual'` for sentences/phrases/folders; `'whole'|'title'|'one'|'manual'` for lists/items). Keep them consistent within each call site.
- **Open confirm during T4:** whether a by-id list query (`getProfileList`) exists; if not, add it (thin query returning `{name, items}`) — needed for whole-list translate from the tile.
- **Scope guard:** sentences/phrases + `VariantAuthorModal` are deliberately NOT touched (no refactor of working code). The new `TranslateChoiceModal` serves only folders/lists/items.
