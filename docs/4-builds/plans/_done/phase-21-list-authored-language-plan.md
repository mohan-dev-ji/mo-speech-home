# Origin-aware List Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give lists an `authoredLanguage` (origin/master) marker so the "Made in" badge and translate/revert affordances become origin-aware — the origin board shows nothing, non-origin boards always show "Made in \<origin\>" + translate-or-revert, and revert can never delete the master.

**Architecture:** Add a `profileLists.authoredLanguage` field (set at create = board language), surface it through the two list queries, add one origin-aware state function (`listTranslateState`), and wire it into the list card (group view) and the per-item controls (detail view). Guard the revert mutation against stripping the master. Legacy/default lists (no field) fall back to `DEFAULT_LOCALE` at read time — no migration.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Convex 1.x, next-intl. **No unit-test runner exists** — verification is `tsc --noEmit` + `tsc -p convex/tsconfig.json` + ESLint + a browser acceptance test.

**Spec:** `docs/superpowers/specs/2026-08-13-list-authored-language-origin-design.md`

## Global Constraints

- **Work on `main`.** No branch/worktree unless asked.
- **Do NOT run `npm run dev`** — dev server is already on port **3001**. **Do NOT run `npx convex dev`.** Type-check Convex with `npx tsc -p convex/tsconfig.json` (needs Node 20: `source ~/.nvm/nvm.sh && nvm use 20.17.0`). Convex deploys from `main`.
- **Runtime fallback everywhere:** a list's origin is `list.authoredLanguage ?? DEFAULT_LOCALE`. Never assume the field is present.
- **The badge language is `authoredLanguage`** (not `resolvedLocale`), shown on BOTH non-origin states.
- **AAC theme tokens only**; **never hard-code UI copy** (translate/revert labels already come from `next-intl` — reuse them).
- **`TranslateRevertControl`** accepts `'untranslated' | 'translated' | 'none'` and renders nothing for `'none'`. `listTranslateState` returns `'origin' | 'untranslated' | 'translated'`; map `'origin' → 'none'` at every call site.
- Browser verification via **claude-in-chrome** (real signed-in Chrome), not the in-app browser.

---

### Task 1: Backend — `authoredLanguage` field, create, queries, revert guard

**Files:**
- Modify: `convex/schema.ts` (`profileLists` table, ~line 684)
- Modify: `convex/profileLists.ts` (`createProfileList` ~line 71; `getProfileLists` return ~line 30; `getProfileListWithItems` return ~line 55; `revertProfileListLanguage` ~line 235)

**Interfaces:**
- Produces: `profileLists.authoredLanguage?: string`; `createProfileList` accepts `authoredLanguage?: string`; both list queries return `authoredLanguage: string | undefined`; `revertProfileListLanguage` no-ops when reverting the origin language.

- [ ] **Step 1: Add the schema field**

In `convex/schema.ts`, in the `profileLists: defineTable({ … })` block, add after the `librarySourceId` line (~688):

```ts
    // The list's origin/master language (ADR-019). Set at create = board language.
    // Absent on pre-ADR-019 rows and `_starter` defaults → read as DEFAULT_LOCALE.
    authoredLanguage: v.optional(v.string()),
```

- [ ] **Step 2: Store it at create**

In `convex/profileLists.ts` `createProfileList`, add the arg and persist it. Change the `args` block to include:

```ts
  args: {
    name: v.record(v.string(), v.string()),
    folderId: v.optional(v.id("profileFolders")),
    authoredLanguage: v.optional(v.string()),
  },
```

and add `authoredLanguage` to the `ctx.db.insert("profileLists", { … })` object (next to `name`):

```ts
      name: args.name,
      ...(args.authoredLanguage ? { authoredLanguage: args.authoredLanguage } : {}),
```

- [ ] **Step 3: Return it from both queries**

In `getProfileLists` (the `lists.map(...)` return, ~line 30-42), add to the returned object:

```ts
        librarySourceId: list.librarySourceId,
        authoredLanguage: list.authoredLanguage,
        folderId: list.folderId, // ADR-014 — group membership (Lists tree)
```

In `getProfileListWithItems` (the return ~line 55-65), add:

```ts
      librarySourceId: list.librarySourceId,
      authoredLanguage: list.authoredLanguage,
      folderId: list.folderId, // ADR-014 — group membership (for breadcrumb/back)
```

- [ ] **Step 4: Guard revert against stripping the master**

In `revertProfileListLanguage` (~line 237), after the auth/ownership check and before stripping, add:

```ts
    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) throw new Error("Not authorised");
    // ADR-019: never strip the origin language — reverting the master would
    // delete it (the UI won't offer this on the origin board, but guard here too).
    if (args.language === (list.authoredLanguage ?? DEFAULT_LOCALE)) return;
```

(Reuse the existing `const list = await ctx.db.get(...)` line rather than duplicating it — insert the guard right after it.) Add the import at the top of `convex/profileLists.ts` if not present:

```ts
import { DEFAULT_LOCALE } from "../lib/languages/registry";
```

- [ ] **Step 5: Type-check Convex**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/profileLists.ts
git commit -m "feat(lists): authoredLanguage origin marker + revert guard (ADR-019)

Add profileLists.authoredLanguage (set at create), return it from both list
queries, and make revertProfileListLanguage a no-op when reverting the origin
language so the master can never be stripped.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `listTranslateState` helper

**Files:**
- Modify: `lib/languages/variants.ts` (add a function; `needsTranslation` and `DEFAULT_LOCALE`/`resolvedLocale` already imported)

**Interfaces:**
- Produces: `listTranslateState(record: Record<string,string> | undefined, boardLang: string, authoredLanguage: string): 'origin' | 'untranslated' | 'translated'`

- [ ] **Step 1: Add the function** (below `labelTranslateState`, which stays for non-origin-aware callers)

```ts
/**
 * Origin-aware control state for a single localised record whose master language
 * is known (lists carry `authoredLanguage`; ADR-019). Unlike `labelTranslateState`
 * it distinguishes the master board (no affordances) from a non-origin board:
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

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit` (expect no errors referencing `variants.ts`) and `npx eslint lib/languages/variants.ts` (expect clean).

- [ ] **Step 3: Commit**

```bash
git add lib/languages/variants.ts
git commit -m "feat(i18n): listTranslateState — origin-aware label/control state (ADR-019)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Create callers pass `authoredLanguage`

**Files:**
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx` (`handleCreate` ~line 430)
- Modify: `app/components/app/home/sections/HomeContent.tsx` (`handleCreateList` ~line 72)

**Interfaces:**
- Consumes: `createProfileList`'s new `authoredLanguage` arg (Task 1).

- [ ] **Step 1: ListsModeContent — pass authoredLanguage**

Change the `createList({ … })` call in `handleCreate` (currently keys `name` under `[language]` from an earlier fix):

```ts
    const id = await createList({
      name: { [language]: name },
      authoredLanguage: language,
      ...(realFolderId ? { folderId: realFolderId } : {}),
    });
```

- [ ] **Step 2: HomeContent — pass authoredLanguage**

Change the `createList` call in `handleCreateList`:

```ts
    const id = await createList({ name: { [language]: name }, authoredLanguage: language });
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit` (expect no NEW errors in these two files) and `npx eslint app/components/app/lists/sections/ListsModeContent.tsx app/components/app/home/sections/HomeContent.tsx`. Note: a pre-existing `preserve-manual-memoization` error at `ListsModeContent.tsx:~519` and a pre-existing `no-unused-expressions` warning at `HomeContent.tsx:~108` are NOT introduced by this task — confirm your diff doesn't touch those lines.

- [ ] **Step 4: Commit**

```bash
git add app/components/app/lists/sections/ListsModeContent.tsx app/components/app/home/sections/HomeContent.tsx
git commit -m "feat(lists): set authoredLanguage = board language at create (ADR-019)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: List card — origin-aware badge + control

**Files:**
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx` (imports ~line 41; the `ListCard` render — `TranslateRevertControl` ~line 182, `MadeInLabel` ~line 215)

**Interfaces:**
- Consumes: `listTranslateState` (Task 2); `list.authoredLanguage` (Task 1); `DEFAULT_LOCALE`, `MadeInLabel` (already imported).

- [ ] **Step 1: Import `listTranslateState`**

Change the variants import (line 41) from:

```ts
import { labelTranslateState } from '@/lib/languages/variants';
```
to:
```ts
import { listTranslateState } from '@/lib/languages/variants';
```

Confirm `labelTranslateState` has no other use in this file: `grep -n "labelTranslateState" app/components/app/lists/sections/ListsModeContent.tsx` should return nothing after the edit. Ensure `DEFAULT_LOCALE` is imported (it is — used at line 216).

- [ ] **Step 2: Compute the origin-aware state once in the card**

In the `ListCard` render body (the component that renders one list card — where line 182/215 live), add a single computation above the `return`/JSX that uses it (near where `name` is derived):

```ts
  const cardState = listTranslateState(
    list.name,
    language,
    list.authoredLanguage ?? DEFAULT_LOCALE,
  );
```

- [ ] **Step 3: Use it for the control (line ~182)**

Replace:
```tsx
                <TranslateRevertControl
                  state={labelTranslateState(list.name, language)}
```
with:
```tsx
                <TranslateRevertControl
                  state={cardState === 'origin' ? 'none' : cardState}
```

- [ ] **Step 4: Use it for the Made-in pill (line ~215-216)** — show on both non-origin states, badge = origin

Replace:
```tsx
            {isEditing && labelTranslateState(list.name, language) === 'untranslated' && (
              <MadeInLabel lang={resolvedLocale(list.name, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE} />
            )}
```
with:
```tsx
            {isEditing && cardState !== 'origin' && (
              <MadeInLabel lang={list.authoredLanguage ?? DEFAULT_LOCALE} />
            )}
```

(If `resolvedLocale` becomes unused in the file after this, leave its import — it is still used elsewhere in `ListsModeContent`, e.g. ~line 537/551/562. Verify with grep before removing anything.)

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit` and `npx eslint app/components/app/lists/sections/ListsModeContent.tsx` (the two pre-existing issues noted in Task 3 Step 3 may still appear; no NEW ones).

- [ ] **Step 6: Commit**

```bash
git add app/components/app/lists/sections/ListsModeContent.tsx
git commit -m "feat(lists): origin-aware list-card badge + translate/revert (ADR-019)

Origin board shows neither pill nor control; non-origin boards show
'Made in <origin>' on both untranslated and translated states, with the badge
reading authoredLanguage. Control hidden on origin (maps to 'none').

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Item level — origin-aware per-item controls

**Files:**
- Modify: `app/components/app/lists/sections/ListDetailEdit.tsx` (imports ~line 24-25; `EditItemProps` ~line 30; `EditContainerProps` ~line 46; three `SortableEdit*` items ~line 67/118/169 with controls at ~103/154/205; three containers `EditRows`/`EditColumns`/`EditGrid` ~line 241/272/316)
- Modify: `app/components/app/lists/sections/ListDetailContent.tsx` (imports ~line 23; whole-translate item check ~line 317; `handleItemRevertConfirm` ~line 418; `editProps` ~line 441)

**Interfaces:**
- Consumes: `listTranslateState` (Task 2); `list.authoredLanguage` from `getProfileListWithItems` (Task 1).

- [ ] **Step 1: ListDetailEdit — imports**

Change (line 24-25):
```ts
import { TranslateRevertControl } from '@/app/components/app/shared/ui/TranslateRevertControl';
import { labelTranslateState } from '@/lib/languages/variants';
```
to:
```ts
import { TranslateRevertControl, type TranslateRevertState } from '@/app/components/app/shared/ui/TranslateRevertControl';
import { listTranslateState } from '@/lib/languages/variants';
```
(`TranslateRevertState` is exported from `TranslateRevertControl.tsx`.)

- [ ] **Step 2: ListDetailEdit — add `authoredLanguage` to both prop types**

In `EditItemProps` (~line 30) add after `language: string;`:
```ts
  authoredLanguage: string;
```
In `EditContainerProps` (~line 46) add after `language: string;`:
```ts
  authoredLanguage: string;
```

- [ ] **Step 3: ListDetailEdit — thread it through the three containers**

In each of `EditRows`, `EditColumns`, `EditGrid` (~line 241/272/316): add `authoredLanguage` to the destructured params (next to `language`), and pass `authoredLanguage={authoredLanguage}` to each `SortableEdit*` element (next to the existing `language={language}`). Example for `EditRows`:

```ts
export function EditRows({ items, showNumbers, showChecklist, language, authoredLanguage, onDragEnd, /* …rest… */ }: EditContainerProps) {
```
and in its `<SortableEditRow … language={language} authoredLanguage={authoredLanguage} … />`. Do the same for `EditColumns`→`SortableEditColumn` and `EditGrid`→`SortableEditGrid`.

- [ ] **Step 4: ListDetailEdit — make each item's control origin-aware**

In each of `SortableEditRow`, `SortableEditColumn`, `SortableEditGrid` (~line 67/118/169): add `authoredLanguage` to the destructured params (next to `language`), and above the `return`, compute the control state once:

```ts
  const originState = item.description
    ? listTranslateState(item.descriptionRecord, language, authoredLanguage)
    : 'origin';
  const controlState: TranslateRevertState = originState === 'origin' ? 'none' : originState;
```

Then replace each control's `state=` expression:
```tsx
          <TranslateRevertControl
            state={item.description ? labelTranslateState(item.descriptionRecord, language) : 'none'}
```
with:
```tsx
          <TranslateRevertControl
            state={controlState}
```
(Do this in all three items — rows, columns, grid.)

- [ ] **Step 5: ListDetailContent — imports + thread authoredLanguage into editProps**

In `ListDetailContent.tsx`, change the variants import (line 23):
```ts
import { stripLocaleKey, labelTranslateState } from '@/lib/languages/variants';
```
to:
```ts
import { stripLocaleKey, listTranslateState } from '@/lib/languages/variants';
```
In the `editProps` object (~line 441), add after `language,`:
```ts
    authoredLanguage: list.authoredLanguage ?? DEFAULT_LOCALE,
```

- [ ] **Step 6: ListDetailContent — origin-aware whole-translate check**

At ~line 314-317 the "any item still needs translating" check uses `labelTranslateState`. Update it to be origin-aware. Replace:
```ts
      return labelTranslateState(recordOf(it, srcLang), language) === 'untranslated';
```
with:
```ts
      return listTranslateState(recordOf(it, srcLang), language, list.authoredLanguage ?? DEFAULT_LOCALE) === 'untranslated';
```
(`list` is in scope here — it's the `getProfileListWithItems` result used throughout this function.)

- [ ] **Step 7: ListDetailContent — guard item revert on the origin board**

In `handleItemRevertConfirm` (~line 418), add an early no-op at the top of the function body (after `if (!pendingItemRevert) return;`):

```ts
    // ADR-019: never strip an item's master key on the origin board.
    if (language === (list.authoredLanguage ?? DEFAULT_LOCALE)) { setPendingItemRevert(null); return; }
```

- [ ] **Step 8: Type-check + lint**

Run:
```bash
npx tsc --noEmit
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx eslint app/components/app/lists/sections/ListDetailEdit.tsx app/components/app/lists/sections/ListDetailContent.tsx
```
Expected: no NEW errors. Confirm `labelTranslateState` is no longer imported/used in either file (`grep -n labelTranslateState app/components/app/lists/sections/ListDetailEdit.tsx app/components/app/lists/sections/ListDetailContent.tsx` → nothing).

- [ ] **Step 9: Commit**

```bash
git add app/components/app/lists/sections/ListDetailEdit.tsx app/components/app/lists/sections/ListDetailContent.tsx
git commit -m "feat(lists): origin-aware per-item translate/revert in list detail (ADR-019)

Items inherit the list's authoredLanguage: no translate/revert glyph on the
origin board, and item revert no-ops there so a master key is never stripped.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: ADR-019 + browser acceptance test

**Files:**
- Create: `docs/4-builds/decisions/ADR-019-list-authored-language.md`

- [ ] **Step 1: Write the ADR**

Create `docs/4-builds/decisions/ADR-019-list-authored-language.md` recording: the problem (single-record lists had no master marker → destructive revert on origin + vanishing "Made in" label), the decision (add `authoredLanguage`, origin-aware `listTranslateState`, badge = origin on both non-origin states, revert guarded), the runtime `?? DEFAULT_LOCALE` fallback (no migration), scope (list card + item level; categories out of scope), and that it refines ADR-016's list-variant model. Follow the format of `docs/4-builds/decisions/ADR-018-voice-follows-text-fallback.md`.

- [ ] **Step 2: Browser acceptance test** (controller/owner, dev server on :3001, claude-in-chrome)

Create one list on the **EN** board and one on the **ES** board. For each list, in edit mode:
1. **On its origin board:** no Made-in pill, no translate, no revert control. ✅
2. **On the other board, before translating:** "Made in \<origin\>" pill + Translate control. ✅
3. **Translate it**, then on the other board: "Made in \<origin\>" pill + Revert control; pressing Revert removes the variant and falls back to the master (master text intact). ✅
4. **Back on the origin board after translating:** still clean — no destructive revert. ✅ (the bug this fixes)
5. **Repeat 1-4 for an item inside a list** (the per-item control).

- [ ] **Step 3: Commit the ADR**

```bash
git add docs/4-builds/decisions/ADR-019-list-authored-language.md
git commit -m "docs(adr): ADR-019 origin-aware list translation (authoredLanguage)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3.1 schema + create + callers → Tasks 1 & 3. ✓
- §3.2 runtime fallback (no migration) → used in Tasks 1/4/5 (`?? DEFAULT_LOCALE`). ✓
- §3.3 `listTranslateState` → Task 2. ✓
- §3.4 list card (control + pill on both non-origin, badge = origin) → Task 4. ✓
- §3.5 item level (control-only, three variants, origin → none) → Task 5. ✓
- §3.6 revert mutation guard → Task 1 Step 4; item revert guard → Task 5 Step 7. ✓
- §5 ADR-019 → Task 6. ✓
- §7 non-goals respected (no sentence/phrase change, no migration, categories out of scope). ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact code; every verify step gives a command + expected result. (Task 6 Step 1 describes the ADR by section + a concrete template to follow — an ADR is prose, not code.) ✓

**Type consistency:** `listTranslateState(record, boardLang, authoredLanguage): 'origin'|'untranslated'|'translated'` is used with those exact args/return in Tasks 4 & 5; `authoredLanguage` prop added to both `EditItemProps` and `EditContainerProps` and threaded consistently; `'origin' → 'none'` mapping applied at every `TranslateRevertControl` call site; `createProfileList` arg name `authoredLanguage` matches between Task 1 (definition) and Task 3 (callers). ✓
