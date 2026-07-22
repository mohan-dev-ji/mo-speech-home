# Translate/Revert Control — edit-mode-only translation affordances — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Design spec:** [`docs/superpowers/specs/2026-07-21-translate-revert-control-design.md`](../../superpowers/specs/2026-07-21-translate-revert-control-design.md).
> **Figma:** `Mo Speech — Finals` — GroupTile `3017-2352`; list-strip / block-sentence `3025-2324`.
> **Execute on `main`.**

**Goal:** Make every translation affordance edit-mode-only (hiding them from students) and replace the tappable "Made in" badge with one reusable state-swapping `TranslateRevertControl` plus a non-actionable `MadeInLabel`.

**Architecture:** Two new presentational components plus a shared "Use original" confirm dialog. The control renders one of three states derived from existing language helpers, and fires a **surface-supplied verb** — machine-translation for label content, variant-authoring for composed content. On strips/rows the control slots into the existing edit toolbar (where the shipped ↩ already lives, so it upgrades in place); on `GroupTile` it sits inline right of the title.

**Tech Stack:** React 19, TypeScript, next-intl (ICU), lucide-react, Radix Dialog, Tailwind CSS 4 theme tokens.

## Global Constraints

- **No unit-test runner exists.** Verify each task with `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"` (must print nothing) plus the named Claude-in-Chrome checks. Never invent a test framework.
- **UI copy → `messages/en.json` ONLY** (real English). Never add keys to `hi.json`/`es.json`/etc. — `i18n/request.ts` merges each locale over `en.json`, and the translation pipeline only fills keys ABSENT from a locale.
- **Theme tokens only** — never hard-code a colour, radius, spacing or font size. Use `var(--theme-*)` / `bg-theme-*` / `rounded-theme-*`.
- **Nothing translation-related may render outside edit mode.** Every control/label added or kept in this plan must be behind an edit-mode gate. This is the point of the feature.
- **Composed content must NEVER be machine-translated** (ADR-016): for sentences/phrases the control's translate state opens the variant-authoring flow. Never call `translateTexts()` for a sentence or phrase.
- **No new Convex mutations.** Every verb reuses an existing mutation/route. If one seems necessary, STOP and escalate.
- **Components live in `app/components/app/{domain}/{type}/`** — new shared atoms go in `app/components/app/shared/ui/`.

---

## File Structure

**Create (3 files):**
- `app/components/app/shared/ui/TranslateRevertControl.tsx` — the state-swapping icon button.
- `app/components/app/shared/ui/MadeInLabel.tsx` — non-actionable origin pill.
- `app/components/app/shared/ui/UseOriginalConfirmDialog.tsx` — shared "Use original" confirm.

**Modify:** `lib/languages/variants.ts` (one state helper) · `GroupTile.tsx` · `GroupsView.tsx` · `CategoriesContent.tsx` · `ListsModeContent.tsx` · `ListDetailDisplay.tsx` · `ListDetailContent.tsx` · `SentencesModeContent.tsx` · `TalkerDropdown.tsx` · `messages/en.json` · ADR-016.

---

### Task 1 (Stage A): Gate every existing badge on edit mode

Ships alone. Closes the student-permissions leak before any component work.

**Files (modify):**
- `app/components/app/shared/ui/GroupTile.tsx:256`
- `app/components/app/lists/sections/ListsModeContent.tsx:249`
- `app/components/app/lists/sections/ListDetailDisplay.tsx:185,234,263`
- `app/components/app/sentences/sections/SentencesModeContent.tsx:731-745`
- `app/components/app/shared/ui/TalkerDropdown.tsx:677-679`

- [ ] **Step 1: GroupTile — invert the gate.** At `:256` the badge renders when `!isEditing`. Change the condition to `isEditing` so it renders only in edit mode:
```tsx
      {isEditing && language && nameRecord && (
        <TranslateBadge
          record={nameRecord}
          language={language}
          onClick={() => setTranslateOpen(true)}
          className="absolute top-2 right-2 z-10"
        />
      )}
```
(Task 3 replaces this block entirely; Stage A must not depend on Stage B.)

- [ ] **Step 2: List row — gate on the row's edit mode.** At `ListsModeContent.tsx:249` the `<TranslateBadge …/>` renders in the `else` of `isEditingThisName`, with no edit-mode gate. Wrap it so it only renders when the list UI is in edit mode: find the prop the row already receives for edit mode (the same one guarding the row's `EditPanel`) and add it to the condition, e.g. `{isEditing && <TranslateBadge … />}`. Read the surrounding component to use the exact prop name in scope.

- [ ] **Step 3: List detail items — remove the three view-only badges.** `DisplayRows`/`DisplayColumns`/`DisplayGrid` render only when `!isEditing` (`ListDetailContent.tsx:526`), i.e. they are the student-facing renderers. Delete the `{item.description && <TranslateBadge … />}` line at `ListDetailDisplay.tsx:185`, `:234` and `:263`. Remove the now-unused `onTranslate` from the item components' props/types and from the `displayProps` object in `ListDetailContent.tsx` **only if** TypeScript reports it unused; otherwise leave the prop threaded (Task 6 does not need it). Keep the `TranslateBadge` import only if still used.

- [ ] **Step 4: Sentence row — already gated, verify only.** `SentencesModeContent.tsx:731-745` renders on `!isEditing && badgeLang`. Change to `isEditing && badgeLang` so it is edit-mode only.

- [ ] **Step 5: Phrase card — gate the label.** `TalkerDropdown.tsx:677-679` computes `madeInLabel` for `PhraseDropdownCard`, which is the NON-edit "tap to insert" card. Pass `madeInLabel={undefined}` when not editing so no badge shows on the student surface — i.e. gate the existing expression on the card's editing flag. Read the surrounding render to find the in-scope editing boolean and use it.

- [ ] **Step 6: Verify tsc.** Run the app typecheck from Global Constraints. Expected: no output.

- [ ] **Step 7: Verify in Chrome (student surface is clean).** On `http://localhost:3000`, on a non-origin board in **view** mode, visit sentences, a sentence folder, lists, a list detail, categories and a group folder. Assert **zero** "Made in" elements render. Use:
```js
Array.from(document.querySelectorAll('button,span')).filter(el => /Made in/i.test(el.textContent||'')).length
```
Expected: `0` in view mode, and `> 0` after entering edit mode on a surface that has an untranslated item.

- [ ] **Step 8: Commit.**
```bash
git add app/components/app/shared/ui/GroupTile.tsx app/components/app/lists/sections/ListsModeContent.tsx app/components/app/lists/sections/ListDetailDisplay.tsx app/components/app/lists/sections/ListDetailContent.tsx app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/shared/ui/TalkerDropdown.tsx
git commit -m "fix(i18n-ux): gate all translate/Made-in affordances behind edit mode (hide from students)"
```

---

### Task 2 (Stage B): Build the three shared components + copy

Component-only task — nothing adopts them yet, so it is verified by tsc alone.

**Files:**
- Create: `app/components/app/shared/ui/TranslateRevertControl.tsx`, `app/components/app/shared/ui/MadeInLabel.tsx`, `app/components/app/shared/ui/UseOriginalConfirmDialog.tsx`
- Modify: `lib/languages/variants.ts`, `messages/en.json`

**Interfaces (Produces — later tasks depend on these EXACT names):**
- `type TranslateRevertState = 'untranslated' | 'translated' | 'none'`
- `<TranslateRevertControl state onTranslate onRevert translateLabel revertLabel size? className? />`
- `<MadeInLabel lang className? />`
- `<UseOriginalConfirmDialog open onOpenChange name onConfirm isPending? />`
- `labelTranslateState(record, boardLang): TranslateRevertState`

**Consumes:** `IconButton` (`{ variant, size:'sm'|'md', icon, label }`), `needsTranslation`, `DEFAULT_LOCALE`, Radix `Dialog` primitives (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`).

- [ ] **Step 1: Add the label-content state helper** to `lib/languages/variants.ts` (next to `needsTranslation`):
```ts
/** Control state for LABEL content (a single record with per-language keys). */
export function labelTranslateState(
  record: Record<string, string> | undefined,
  boardLang: string,
): 'untranslated' | 'translated' | 'none' {
  if (needsTranslation(record, boardLang)) return 'untranslated';
  // A board-language key exists; it is only revertable if an origin survives.
  const keys = record ? Object.keys(record) : [];
  return keys.some((k) => k !== boardLang) ? 'translated' : 'none';
}
```

- [ ] **Step 2: Create `TranslateRevertControl.tsx`:**
```tsx
"use client";

import { Languages, RotateCcw } from 'lucide-react';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';

export type TranslateRevertState = 'untranslated' | 'translated' | 'none';

/**
 * Edit-mode-only control for per-language content. One slot, two meanings:
 *  - `untranslated` → translate glyph; fires `onTranslate`
 *  - `translated`   → ↺; fires `onRevert` (caller opens the "Use original" confirm)
 *  - `none`         → renders nothing (single-language item)
 *
 * Deliberately dumb: it renders state and fires callbacks. The VERB is
 * surface-specific — machine-translation for labels, but variant AUTHORING for
 * sentences/phrases, which must never be machine-translated (ADR-016).
 */
export function TranslateRevertControl({
  state, onTranslate, onRevert, translateLabel, revertLabel, size = 'sm', className,
}: {
  state: TranslateRevertState;
  onTranslate: () => void;
  onRevert: () => void;
  translateLabel: string;
  revertLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (state === 'none') return null;
  const isTranslate = state === 'untranslated';
  return (
    <IconButton
      size={size}
      variant="neutral"
      className={className}
      icon={isTranslate ? <Languages /> : <RotateCcw />}
      label={isTranslate ? translateLabel : revertLabel}
      onClick={(e) => { e.stopPropagation(); (isTranslate ? onTranslate : onRevert)(); }}
    />
  );
}
```

- [ ] **Step 3: Create `MadeInLabel.tsx`** (same pill styling as the existing `TranslateBadge`, but a non-interactive `<span>`):
```tsx
"use client";

import { useTranslations } from 'next-intl';

/**
 * Non-actionable "Made in <LANG>" origin label. Edit-mode only, and rendered
 * only alongside a TranslateRevertControl in its `untranslated` state — that is
 * exactly when a fallback origin exists to name. `lang` is the RESOLVED origin
 * locale (callers compute it with `resolvedLocale`).
 */
export function MadeInLabel({ lang, className }: { lang: string; className?: string }) {
  const t = useTranslations('translate');
  return (
    <span
      className={`shrink-0 self-center rounded-full text-theme-xs font-semibold px-3 py-1 whitespace-nowrap ${className ?? ''}`}
      style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
    >
      {t('madeInBadge', { lang: lang.toUpperCase() })}
    </span>
  );
}
```

- [ ] **Step 4: Create `UseOriginalConfirmDialog.tsx`.** Open `SentencesModeContent.tsx` at the existing revert confirm Dialog (`open={pendingRevert !== null}`, around `:1419-1446`) and **copy its JSX verbatim** into this component so the two are visually identical, parameterising `open` / `onOpenChange` / `name` / `onConfirm` / `isPending` and sourcing copy from the `translate` namespace:
```tsx
"use client";

import { useTranslations } from 'next-intl';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/app/components/app/shared/ui/Dialog';

/** Shared light confirm for reverting one board's version back to the original. */
export function UseOriginalConfirmDialog({
  open, onOpenChange, name, onConfirm, isPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  const t = useTranslations('translate');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('useOriginalTitle')}</DialogTitle>
          <DialogDescription>{t('useOriginalBody', { name })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
              style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
            >
              {t('deleteCancel')}
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
          >
            {isPending ? t('deleting') : t('useOriginalTitle')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
Add `DialogClose` to the import from `Dialog`. Use `t('useOriginalCancel')` for the cancel label and `t('useOriginalPending')` for the busy label (both added in Step 5) — do NOT reuse the surface-specific `deleteCancel`/`deleting`, which live in other namespaces.

> **Note on the cancel button's `rgba(0,0,0,0.08)`:** this value is copied verbatim from the existing revert/delete dialogs (`SentencesModeContent.tsx:1434`; same value at `TalkerDropdown.tsx:848,920,947`), so the extracted dialog stays visually identical to every neighbouring confirm. It does sit in tension with the "theme tokens only" Global Constraint.
>
> **Decision (owner, 2026-07-21): the rgba governs here.** The constraint means *no NEW hard-coded colours*; this is a faithful extraction of shipped UI, kept so the dialog matches its neighbours. Converting all confirm dialogs to a token is a separate, repo-wide change. A reviewer raising it should be told this decision, not blocked by it.

- [ ] **Step 5: Add copy to `messages/en.json`** under the existing `translate` namespace (en.json ONLY):
```jsonc
"controlTranslateLabel": "Translate this to {lang}",
"controlRevertLabel": "Use original",
"useOriginalTitle": "Use original",
"useOriginalBody": "Show the original version of \"{name}\" here instead? You can re-author it anytime.",
"useOriginalCancel": "Cancel",
"useOriginalPending": "Reverting…"
```
(`madeInBadge` already exists in this namespace — reuse it, do not duplicate.) In the dialog markup use `t('useOriginalCancel')` and `t('useOriginalPending')` for the cancel/busy labels rather than the surface-specific `deleteCancel`/`deleting`, so the shared component owns all its copy.

- [ ] **Step 6: Verify.** Run the app typecheck (expected: no output) and `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));console.log('ok')"` (expected: `ok`).

- [ ] **Step 7: Commit.**
```bash
git add app/components/app/shared/ui/TranslateRevertControl.tsx app/components/app/shared/ui/MadeInLabel.tsx app/components/app/shared/ui/UseOriginalConfirmDialog.tsx lib/languages/variants.ts messages/en.json
git commit -m "feat(i18n-ux): TranslateRevertControl + MadeInLabel + UseOriginalConfirmDialog"
```

---

### Task 3 (Stage B): Adopt in GroupTile (+ folder and category parents)

**Files (modify):** `app/components/app/shared/ui/GroupTile.tsx`, `app/components/app/shared/sections/GroupsView.tsx`, `app/components/app/categories/sections/CategoriesContent.tsx`

**Consumes:** `TranslateRevertControl`, `labelTranslateState`, `UseOriginalConfirmDialog`, `stripLocaleKey`.
**Produces:** a new `GroupTile` prop `onRevert?: () => void`.

Per Figma `3017-2352`: view mode is title + cover only; edit mode shows the dashed title input with the control **inline, immediately right of it**. **No `MadeInLabel` on a tile** (no room — the pill is the clunkiness being removed).

- [ ] **Step 1: Add the `onRevert` prop** to `GroupTile`'s props type and destructuring (alongside `onRename`, `onManualRename`). Today's `onRename(value: string)` cannot express key removal, which is why revert needs its own callback:
```ts
  /** Strip the board-language key from the name record (parent owns the mutation). */
  onRevert?: () => void;
```

- [ ] **Step 2: Render the control inline, right of the title.** Wrap the existing title block (`:164-185`) in a flex row so the control sits beside the input, and render it only in edit mode:
```tsx
        {/* Title (+ edit-mode translate/revert control, inline right — Figma 3017-2352) */}
        {isEditing ? (
          <div className="w-full flex items-center gap-theme-gap" onClick={(e) => e.stopPropagation()}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
              }}
              aria-label={t('rename')}
              className="flex-1 min-w-0 text-center text-theme-alt-text font-normal leading-tight rounded-theme-sm px-2 py-1 outline-none"
              style={{ fontSize, background: 'transparent', border: '2px dashed var(--theme-enter-mode)' }}
            />
            {language && nameRecord && (
              <TranslateRevertControl
                state={labelTranslateState(nameRecord, language)}
                onTranslate={() => void handleTranslate()}
                onRevert={() => setRevertOpen(true)}
                translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
                revertLabel={tTranslate('controlRevertLabel')}
              />
            )}
          </div>
        ) : (
          <p
            className="w-full text-center text-theme-alt-text font-normal truncate leading-tight"
            style={{ fontSize }}
          >
            {name}
          </p>
        )}
```
**Verified tokens** (from `app/globals.css` `@theme inline`): the real spacing tokens are `--spacing-theme-gap`, `--spacing-theme-elements`, `--spacing-theme-item`, `--spacing-theme-general` — i.e. `gap-theme-gap`, `gap-theme-elements`, `mt-theme-gap`, `mt-theme-elements`. There is **no** `*-theme-gap-sm`. Never invent a token and never hard-code a value.

- [ ] **Step 3: Replace the translate modal with a one-tap translate.** In edit mode the title is already an input, so the modal's "manual" branch is redundant. Delete `handleTranslateChoice` (`:129-142`), the `translateOpen` state, the `TranslateChoiceModal` block (`:264-279`) and the now-unused `TranslateChoiceModal` import. Add:
```tsx
  // Edit-mode one-tap translate: MT-fill the name into the board language and
  // persist via the parent's rename. (No modal — the title input IS the manual path.)
  async function handleTranslate() {
    if (!language || !nameRecord) return;
    const src = displayString(nameRecord, language, DEFAULT_LOCALE);
    if (!src) return;
    const [translated] = await translateTexts([src], language);
    if (translated) onRename?.(translated);
  }
```

- [ ] **Step 4: Remove the badge and add the confirm.** Delete the `TranslateBadge` block (`:256-263`, as gated in Task 1) and its import if unused. Add `const [revertOpen, setRevertOpen] = useState(false);` beside the other state, and render the shared confirm inside the outer wrapper `<div>` (after `</Tag>`):
```tsx
      <UseOriginalConfirmDialog
        open={revertOpen}
        onOpenChange={setRevertOpen}
        name={name}
        onConfirm={() => { setRevertOpen(false); onRevert?.(); }}
      />
```

- [ ] **Step 5: Implement `onRevert` in `GroupsView.tsx`.** It already renames via `renameFolder({ folderId: id, name: { ...folder.name, [language]: value } })` (~`:154-158`) and renders `GroupTile` at `~:248`. Add an `onRevert` that strips the key, refusing to strip the last one:
```tsx
              onRevert={() => {
                const stripped = stripLocaleKey(folder.name, language) as Record<string, string>;
                if (Object.keys(stripped).length === 0) return; // never strip the last key
                void renameFolder({ folderId: folder._id, name: stripped });
              }}
```
Import `stripLocaleKey` from `@/lib/languages/variants`. Use the actual folder variable name in scope at the call site.

- [ ] **Step 6: Implement `onRevert` in `CategoriesContent.tsx`** at its `GroupTile` call site (~`:258`), using the same strip + last-key guard against the category rename mutation that its existing `handleRename` uses.

- [ ] **Step 7: Verify tsc.** Expected: no output.

- [ ] **Step 8: Verify in Chrome.** On a non-origin board: view mode shows a clean tile (title + cover, no pill). Enter edit mode → the control appears inline right of the dashed title input. On an untranslated tile it shows the translate glyph; tapping it fills the board-language title. Then the same slot shows ↺; tapping opens the "Use original" confirm; confirming restores the origin title. Compare against Figma `3017-2352`.

- [ ] **Step 9: Commit.**
```bash
git add app/components/app/shared/ui/GroupTile.tsx app/components/app/shared/sections/GroupsView.tsx app/components/app/categories/sections/CategoriesContent.tsx
git commit -m "feat(i18n-ux): GroupTile inline translate/revert control replaces the Made-in badge"
```

---

### Task 4 (Stage C): List row — upgrade the toolbar ↩ into the control

**Files (modify):** `app/components/app/lists/sections/ListsModeContent.tsx`, `messages/en.json` (only if a label is missing)

Per Figma `3025-2324`: the control lives **in the edit toolbar**; `MadeInLabel` sits **directly below the toolbar, right-aligned**.

- [ ] **Step 1: Replace the EditPanel ↩ with the control.** The revert `IconButton` (`<RotateCcw />`, added in the Variant Lifecycle work, ~`:236-247`) sits in the row's `EditPanel` between Delete and the Pencil. Replace that `IconButton` with:
```tsx
<TranslateRevertControl
  state={labelTranslateState(list.name as Record<string, string>, language)}
  onTranslate={() => onTranslateList(list._id)}
  onRevert={() => onRevertRequest(list._id, name)}
  translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
  revertLabel={tTranslate('controlRevertLabel')}
/>
```
`onTranslateList` already exists (it opens the list's translate choice modal — keep that modal; it offers whole/title/manual, which is still useful for lists). `onRevertRequest` already exists from the shipped revert. Add `const tTranslate = useTranslations('translate');` if not already present in this component.

- [ ] **Step 2: Replace the row badge with `MadeInLabel`.** Delete the `<TranslateBadge … />` at `~:249` (edit-gated in Task 1) and render, directly below the `EditPanel` and right-aligned, only when the control is in its translate state:
```tsx
{isEditing && labelTranslateState(list.name as Record<string, string>, language) === 'untranslated' && (
  <div className="flex justify-end mt-theme-gap">
    <MadeInLabel lang={resolvedLocale(list.name as Record<string, string>, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE} />
  </div>
)}
```
Use the row's in-scope edit-mode boolean and the nearest real spacing token. Import `MadeInLabel`, `resolvedLocale`, `DEFAULT_LOCALE`.

- [ ] **Step 3: Swap the row's revert confirm to the shared dialog.** Replace the existing inline revert `Dialog` (`~:735-760`) with:
```tsx
<UseOriginalConfirmDialog
  open={pendingRevert !== null}
  onOpenChange={(o) => { if (!o) setPendingRevert(null); }}
  name={pendingRevert?.name ?? ''}
  onConfirm={handleRevertConfirm}
  isPending={isDeleting}
/>
```
Use the actual pending-state and busy-flag names in scope. Delete any now-unused `rowRevert`/`revertConfirm` usages in this file (leave the `en.json` keys in place — other surfaces may still use them).

- [ ] **Step 4: Verify tsc.** Expected: no output.

- [ ] **Step 5: Verify in Chrome.** On a non-origin board, list rows in view mode show no pill and no control. In edit mode: an untranslated list shows the translate glyph in the toolbar with the "Made in ⟨LANG⟩" pill below it, right-aligned; a translated list shows ↺ and no pill, and tapping ↺ opens the "Use original" confirm and restores the origin title.

- [ ] **Step 6: Commit.**
```bash
git add app/components/app/lists/sections/ListsModeContent.tsx messages/en.json
git commit -m "feat(i18n-ux): list row adopts TranslateRevertControl + MadeInLabel in the edit toolbar"
```

---

### Task 5 (Stage C): List detail — per-item control in the edit renderers

Restores the per-item translate removed in Task 1, and adds the per-item revert.

**Files (modify):** `app/components/app/lists/sections/ListDetailContent.tsx` (the `EditRows`/`EditColumns`/`EditGrid` renderers and their `editProps`)

- [ ] **Step 1: Locate the edit-mode item renderers.** `ListDetailContent.tsx:519-523` renders `EditRows`/`EditColumns`/`EditGrid` with `{...editProps}`. Read those components (they may live in this file or a sibling) and find each item's existing edit controls cluster.

- [ ] **Step 2: Add the control to each item's edit controls.** For an item at `index` with a localised `description` record:
```tsx
<TranslateRevertControl
  state={labelTranslateState(item.description as Record<string, string> | undefined, language)}
  onTranslate={() => onTranslate(index)}
  onRevert={() => setPendingItemRevert({ index, name: displayString(item.description ?? {}, language, DEFAULT_LOCALE) })}
  translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
  revertLabel={tTranslate('controlRevertLabel')}
/>
```
`onTranslate(index)` is the existing per-item translate handler (`ListDetailContent.tsx:411` → the modal at `:339-380`) — thread it into `editProps` if it is not already there. Skip items whose `description` is a plain legacy string (`typeof item.description === 'string'` → state `'none'`).

- [ ] **Step 3: Add the per-item revert.** Add `const [pendingItemRevert, setPendingItemRevert] = useState<{ index: number; name: string } | null>(null);` and a handler that strips only that item's key and saves via the existing `updateItems` mutation (`:88`):
```tsx
  async function handleItemRevertConfirm() {
    if (!pendingItemRevert) return;
    const idx = pendingItemRevert.index;
    const nextItems = localItems.map((it, i) =>
      i === idx && it.description !== undefined
        ? { ...it, description: stripLocaleKey(it.description, language) }
        : it,
    );
    setPendingItemRevert(null);
    await updateItems({ profileListId: list._id, items: nextItems });
  }
```
Match `updateItems`' exact arg shape as used elsewhere in the file. Render the shared confirm:
```tsx
<UseOriginalConfirmDialog
  open={pendingItemRevert !== null}
  onOpenChange={(o) => { if (!o) setPendingItemRevert(null); }}
  name={pendingItemRevert?.name ?? ''}
  onConfirm={() => void handleItemRevertConfirm()}
/>
```

- [ ] **Step 4: Verify tsc.** Expected: no output.

- [ ] **Step 5: Verify in Chrome.** In a list detail on a non-origin board: view mode shows no translation chrome on items. In edit mode, an untranslated item shows the translate glyph (tapping opens the existing per-item translate modal); a translated item shows ↺, and reverting affects **only that item** — the other items and the list title are unchanged.

- [ ] **Step 6: Commit.**
```bash
git add app/components/app/lists/sections/ListDetailContent.tsx
git commit -m "feat(i18n-ux): per-item translate/revert control in list detail edit mode"
```

---

### Task 6 (Stage D): Sentence rows

**Files (modify):** `app/components/app/sentences/sections/SentencesModeContent.tsx`

**Critical:** the translate state opens **variant authoring**, never machine translation (ADR-016).

- [ ] **Step 1: Compute the state, preserving the existing badge logic.** `badgeLang` (computed ~`:554-557`) already handles both composition types (sequence → `authoredLang !== language`; fluent → `needsTranslation(fluentPrimary, language)`). Reuse it rather than a generic helper:
```ts
  // Precedence (owner decision 2026-07-21): badgeLang FIRST. A variant row can exist
  // while its text is still the source language (createSentenceVariant seeds it that
  // way) — that half-finished state must keep the route back into authoring, per
  // convex/profileSentences.ts:199-203 and lib/languages/variants.ts:44-48.
  const translateState: TranslateRevertState =
    badgeLang ? 'untranslated'
    : isRevertableVariant(sentence) ? 'translated'
    : 'none';
```

- [ ] **Step 2: Replace the EditPanel ↩ with the control.** In the row's `EditPanel`, replace the revert `IconButton` (`<RotateCcw />`, added in the Variant Lifecycle work) with:
```tsx
<TranslateRevertControl
  state={translateState}
  onTranslate={() => onAuthorVariant(sentence)}
  onRevert={() => onRevertRequest(sentence._id, name)}
  translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
  revertLabel={tTranslate('controlRevertLabel')}
/>
```
`onAuthorVariant` is the existing prop the badge used to call — this is the badge's former job, moved. Verify its exact name/signature at the row component's props before wiring.

- [ ] **Step 3: Replace the badge with `MadeInLabel`.** Delete the bespoke badge button (`~:731-745`, edit-gated in Task 1) and render, below the `EditPanel` and right-aligned, only in the translate state:
```tsx
{isEditing && translateState === 'untranslated' && badgeLang && (
  <div className="flex justify-end mt-theme-gap">
    <MadeInLabel lang={badgeLang} />
  </div>
)}
```
`badgeLang` is already the resolved origin locale used by the old badge — pass it straight through. Use the nearest real spacing token.

- [ ] **Step 4: Swap the revert confirm to the shared dialog.** Replace the inline revert `Dialog` (`~:1419-1446`) with `UseOriginalConfirmDialog`, bound to `pendingRevert` / `handleRevertConfirm` / `isDeleting` exactly as in Task 4 Step 3.

- [ ] **Step 5: Verify tsc.** Expected: no output.

- [ ] **Step 6: Verify in Chrome.** On a HI board with an EN-source sentence: view mode is clean. In edit mode the "Made in EN" pill shows below the toolbar and the toolbar shows the translate glyph; tapping it opens the **variant-authoring flow**. Capture the network log and assert **no** `/api/translate-text` request fires. After authoring a HI variant, the same slot shows ↺; reverting via the "Use original" confirm restores the EN source and the pill.

- [ ] **Step 7: Commit.**
```bash
git add app/components/app/sentences/sections/SentencesModeContent.tsx
git commit -m "feat(i18n-ux): sentence rows adopt TranslateRevertControl (translate = author variant)"
```

---

### Task 7 (Stage D): Phrase cards

**Files (modify):** `app/components/app/shared/ui/TalkerDropdown.tsx`

- [ ] **Step 1: Compute the state** for a collapsed phrase `p`:
```ts
// Same precedence as sentences (owner decision 2026-07-21): untranslated wins, so a
// half-finished variant keeps its route back into authoring.
const phraseState: TranslateRevertState =
  needsTranslation(p.name, language) ? 'untranslated'
  : isRevertableVariant(p) ? 'translated'
  : 'none';
```

- [ ] **Step 2: Replace the `BlockEditControls` ↩ with the control.** `PhraseEditCard` currently passes `onRevert`/`revertLabel` into `BlockEditControls` (added in the Variant Lifecycle work). Change `BlockEditControls` to accept an optional `translateRevert?: React.ReactNode` slot rendered where the ↩ button was, and have `PhraseEditCard` pass a `<TranslateRevertControl … />` element into it — so the shared control replaces the bespoke button while other `BlockEditControls` call sites (sentence unit blocks, `InlinePhraseEditor`) stay unchanged by omitting the slot. Remove the now-unused `onRevert`/`revertLabel` props from `BlockEditControls`.
```tsx
<TranslateRevertControl
  state={phraseState}
  onTranslate={() => onAuthorPhraseVariant(p._id)}
  onRevert={() => setPendingPhraseRevert({ id: p._id, name })}
  translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
  revertLabel={tTranslate('controlRevertLabel')}
/>
```
Wire `onTranslate` to the existing phrase variant-authoring entry point (the handler the phrase badge used); read the file to find its exact name. **Never** call `translateTexts` here.

- [ ] **Step 3: Replace the phrase badge with `MadeInLabel`.** Remove the `madeInLabel` prop plumbing on `PhraseDropdownCard` (`~:677-679`, gated in Task 1) and instead render `MadeInLabel` in the EDIT card below its controls, right-aligned, only when `phraseState === 'untranslated'`:
```tsx
<MadeInLabel lang={resolvedLocale(p.name, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE} />
```

- [ ] **Step 4: Swap the phrase revert confirm to the shared dialog** — replace the inline revert `Dialog` with `UseOriginalConfirmDialog` bound to `pendingPhraseRevert` and its confirm handler.

- [ ] **Step 5: Verify tsc.** Expected: no output.

- [ ] **Step 6: Verify in Chrome.** Phrase bank in view mode is clean. In edit mode an untranslated phrase shows the pill + translate glyph (which opens variant authoring, no `/api/translate-text` call); a phrase variant shows ↺ and reverts via the confirm. Confirm no ↩/control leaked into sentence per-unit blocks or `InlinePhraseEditor`.

- [ ] **Step 7: Commit.**
```bash
git add app/components/app/shared/ui/TalkerDropdown.tsx app/components/app/shared/ui/composition/BlockEditControls.tsx
git commit -m "feat(i18n-ux): phrase cards adopt TranslateRevertControl (translate = author variant)"
```

---

### Task 8: Docs

**Files (modify):** `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`

- [ ] **Step 1: Add "Addendum K — Edit-mode-only translation affordances".** Record: the governing principle (nothing translation-related renders outside edit mode — a student-permissions fix, not cosmetics); `TranslateRevertControl` + `MadeInLabel` + `UseOriginalConfirmDialog`; that **§3's badge-as-entry-point is superseded** — the variant-authoring entry point moved to the control's translate state and the "Made in" pill is now a non-actionable label; and that composed content is still never machine-translated. Match the file's existing addendum style.

- [ ] **Step 2: Move this plan to `_done/` and commit.**
```bash
git mv docs/4-builds/plans/phase-15.7-translate-revert-control.md docs/4-builds/plans/_done/
git add -A
git commit -m "docs(i18n-ux): ADR-016 Addendum K (edit-mode-only translation affordances); move plan to _done"
```

---

## Self-review — spec coverage

- Governing principle (edit-mode only) → Task 1 (all 7 sites), re-asserted in every adoption task's Chrome check.
- `TranslateRevertControl` / `MadeInLabel` / label-vs-composed state derivation → Task 2 (+ per-surface expressions in Tasks 3–7).
- Per-surface verbs table → Task 3 (MT title), Task 4 (MT title), Task 5 (MT description), Tasks 6–7 (**author variant, never MT** — asserted by a network check).
- Consolidation "upgrade the shipped ↩ in place" → Tasks 4, 6, 7 Step 2.
- Placement: toolbar + pill below for strips/rows (Tasks 4, 6, 7); inline, no pill, for GroupTile (Task 3).
- Revert confirmed by a "Use original" modal → Task 2 Step 4 + adopted in Tasks 3, 4, 5, 6, 7.
- Stage A's two accepted temporary consequences (GroupTile inverted then replaced; per-item translate unavailable until Task 5) → Tasks 1 and 5.
- No new Convex mutations → every verb reuses `renameFolder` / category rename / `updateProfileListName` / `updateProfileListItems` / `revertProfileListLanguage` / `/api/delete-composed` / existing variant-authoring entry points.
- Docs → Task 8.
