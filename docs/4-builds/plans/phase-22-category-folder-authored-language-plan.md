# Origin-aware Categories & Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give categories and folders an `authoredLanguage` origin marker so their name badge/translate/revert and text fallback are origin-aware — extending the ADR-019 list model so a category/folder reverts to its made-in language, not a prior translation.

**Architecture:** Add `authoredLanguage` to `profileCategories` + `profileFolders` (set at create = board language), then make the shared `GroupTile` origin-aware via the existing `listTranslateState` helper (fixing categories AND all foldered trees at once), thread the origin into the display fallback, and guard the client-side revert. Both list/folder queries return raw docs, so the field reaches the client with no query change. Runtime fallback `?? DEFAULT_LOCALE`; no migration.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Convex 1.x, next-intl. **No unit-test runner** — verification is `tsc --noEmit` + `tsc -p convex/tsconfig.json` + ESLint + a browser acceptance test.

**Spec:** `docs/superpowers/specs/2026-08-14-category-folder-authored-language-design.md`

## Global Constraints

- **Work on `main`.** No branch/worktree unless asked.
- **No `npm run dev`** (dev server already on a port the owner runs); **no `npx convex dev`.** Convex type-check: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`. App type-check: `npx tsc --noEmit`. Lint: `npx eslint <files>`.
- **Runtime fallback everywhere:** origin = `record.authoredLanguage ?? DEFAULT_LOCALE`. Never assume the field is present.
- **Badge = `authoredLanguage`**, shown on both non-origin states.
- `listTranslateState(record, boardLang, authoredLanguage): 'origin' | 'untranslated' | 'translated'` (from `lib/languages/variants.ts`, built in phase-21). `TranslateRevertControl` renders nothing for `'none'`; map `'origin' → 'none'`.
- **Symbols are out of scope** — do not touch symbol labels or `CategoryDetailContent`.
- AAC theme tokens only; never hard-code UI copy (translate/revert labels come from `next-intl`).

---

### Task 1: Backend — `authoredLanguage` on categories + folders

**Files:**
- Modify: `convex/schema.ts` (`profileCategories` ~line 543; `profileFolders` ~line 839)
- Modify: `convex/profileCategories.ts` (`createProfileCategory` args ~line 320, insert ~line 353)
- Modify: `convex/profileFolders.ts` (`createFolder` args ~line 55, insert ~line 70)

**Interfaces:**
- Produces: `profileCategories.authoredLanguage?: string`, `profileFolders.authoredLanguage?: string`; `createProfileCategory` + `createFolder` accept + store `authoredLanguage?: string`. (Both list queries `getProfileCategories`/`getCoreWordCategories`/`getProfileFolders` return raw docs via `.collect()`, so they carry the new field with **no change**.)

- [ ] **Step 1: Schema fields**

In `convex/schema.ts`, add to `profileCategories` (after the `name: localisedString,` line ~545):

```ts
    // Origin/master language (ADR-020, extends ADR-019). Set at create = board
    // language. Absent on legacy rows → read as DEFAULT_LOCALE at runtime.
    authoredLanguage: v.optional(v.string()),
```

And to `profileFolders` (after its `name: localisedString,` line ~847):

```ts
    authoredLanguage: v.optional(v.string()),
```

- [ ] **Step 2: Store in `createProfileCategory`**

In `convex/profileCategories.ts`, add to the `createProfileCategory` `args` object (alongside `name`):

```ts
    authoredLanguage: v.optional(v.string()),
```

and to the `ctx.db.insert("profileCategories", { … })` object (after `name: args.name,`):

```ts
      ...(args.authoredLanguage ? { authoredLanguage: args.authoredLanguage } : {}),
```

- [ ] **Step 3: Store in `createFolder`**

In `convex/profileFolders.ts`, add to `createFolder` `args`:

```ts
    authoredLanguage: v.optional(v.string()),
```

and to its `ctx.db.insert("profileFolders", { … })` object (after `name: args.name,`):

```ts
      ...(args.authoredLanguage ? { authoredLanguage: args.authoredLanguage } : {}),
```

- [ ] **Step 4: Type-check Convex**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: PASS. (No query edits — `getProfileCategories`/`getProfileFolders` return `.collect()`'d docs which now include the field.)

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/profileCategories.ts convex/profileFolders.ts
git commit -m "feat(categories): authoredLanguage origin marker on categories + folders (ADR-020)

Add profileCategories.authoredLanguage + profileFolders.authoredLanguage, stored
at create. Both list queries return raw docs, so the field reaches the client
with no query change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Create callers pass `authoredLanguage`

**Files:**
- Modify: `app/lib/categories/useCreateCategory.ts:27`
- Modify: `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx:82`
- Modify: `app/components/app/shared/sections/GroupsView.tsx:152` (`handleCreate`)

**Interfaces:** Consumes `createProfileCategory`/`createFolder`'s new `authoredLanguage` arg (Task 1). `language` (board language) is already in scope in all three.

- [ ] **Step 1: `useCreateCategory`**

Change (line 27):
```ts
    return createCategory({ name: { [language]: name }, symbols });
```
to:
```ts
    return createCategory({ name: { [language]: name }, symbols, authoredLanguage: language });
```

- [ ] **Step 2: `PropertiesPanel` category-create**

Change (line 82):
```ts
      const id = await createCategory({ name: { [language]: name } });
```
to:
```ts
      const id = await createCategory({ name: { [language]: name }, authoredLanguage: language });
```

- [ ] **Step 3: `GroupsView` folder-create**

Change (in `handleCreate`, line 152):
```ts
    await createFolder({ tree, name: { [language]: name } });
```
to:
```ts
    await createFolder({ tree, name: { [language]: name }, authoredLanguage: language });
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit` (no NEW errors in these files) and `npx eslint app/lib/categories/useCreateCategory.ts app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx app/components/app/shared/sections/GroupsView.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/lib/categories/useCreateCategory.ts app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx app/components/app/shared/sections/GroupsView.tsx
git commit -m "feat(categories): set authoredLanguage = board language at create (ADR-020)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Origin-aware `GroupTile` (shared by categories + folders)

**Files:**
- Modify: `app/components/app/shared/ui/GroupTile.tsx` (imports ~line 12-17; `Props` type ~line 63-66; control block ~lines 190-198)

**Interfaces:**
- Consumes: `listTranslateState` (phase-21); `MadeInLabel`.
- Produces: `GroupTile` accepts `authoredLanguage?: string`; renders origin-aware control + a Made-in badge on non-origin states.

- [ ] **Step 1: Imports**

In `GroupTile.tsx`, change:
```ts
import { TranslateRevertControl } from '@/app/components/app/shared/ui/TranslateRevertControl';
import { UseOriginalConfirmDialog } from '@/app/components/app/shared/ui/UseOriginalConfirmDialog';
import { labelTranslateState } from '@/lib/languages/variants';
```
to:
```ts
import { TranslateRevertControl } from '@/app/components/app/shared/ui/TranslateRevertControl';
import { MadeInLabel } from '@/app/components/app/shared/ui/MadeInLabel';
import { UseOriginalConfirmDialog } from '@/app/components/app/shared/ui/UseOriginalConfirmDialog';
import { listTranslateState } from '@/lib/languages/variants';
```
(`displayString` and `DEFAULT_LOCALE` are already imported. Confirm `labelTranslateState` has no other use in this file first: `grep -n labelTranslateState app/components/app/shared/ui/GroupTile.tsx` — expect only the one line you are replacing.)

- [ ] **Step 2: Add the `authoredLanguage` prop**

In the `Props` type, after the `language?: string;` line (~line 64):
```ts
  /** The record's origin/master language (ADR-020). Falls back to DEFAULT_LOCALE. */
  authoredLanguage?: string;
```

Destructure it in the component signature wherever the other props (`nameRecord`, `language`) are destructured — add `authoredLanguage` to that list.

- [ ] **Step 3: Origin-aware control + Made-in badge**

Replace the control block (~lines 190-198):
```tsx
            {language && nameRecord && (
              <TranslateRevertControl
                state={labelTranslateState(nameRecord, language)}
                onTranslate={() => void handleTranslate()}
                onRevert={() => setRevertOpen(true)}
                translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
                revertLabel={tTranslate('controlRevertLabel')}
              />
            )}
```
with:
```tsx
            {language && nameRecord && (() => {
              // Origin-aware (ADR-020): no control on the master board; on a
              // non-origin board show Translate (untranslated) or Revert (translated).
              const tileState = listTranslateState(nameRecord, language, authoredLanguage ?? DEFAULT_LOCALE);
              return (
                <>
                  <TranslateRevertControl
                    state={tileState === 'origin' ? 'none' : tileState}
                    onTranslate={() => void handleTranslate()}
                    onRevert={() => setRevertOpen(true)}
                    translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
                    revertLabel={tTranslate('controlRevertLabel')}
                  />
                  {tileState !== 'origin' && (
                    <MadeInLabel lang={authoredLanguage ?? DEFAULT_LOCALE} />
                  )}
                </>
              );
            })()}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit` (no NEW errors) and `npx eslint app/components/app/shared/ui/GroupTile.tsx`. Confirm `labelTranslateState` is gone (`grep -n labelTranslateState app/components/app/shared/ui/GroupTile.tsx` → nothing).

- [ ] **Step 5: Commit**

```bash
git add app/components/app/shared/ui/GroupTile.tsx
git commit -m "feat(categories): origin-aware GroupTile — badge + translate/revert (ADR-020)

Shared tile (categories + all foldered trees) uses listTranslateState instead of
labelTranslateState: no control on the origin board, and a 'Made in <origin>'
badge on both non-origin states. Takes an authoredLanguage prop.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Origin-aware display fallback, GroupTile prop, revert guard (both callers)

**Files:**
- Modify: `app/components/app/categories/sections/CategoriesContent.tsx` (display ~line 294; `GroupTile` props ~line 309-310; revert ~lines 313-317)
- Modify: `app/components/app/shared/sections/GroupsView.tsx` (display ~line 251; `GroupTile` props ~line 266; revert ~lines 270-274)

**Interfaces:** Consumes `GroupTile`'s new `authoredLanguage` prop (Task 3); `cat.authoredLanguage` / `folder.authoredLanguage` from the raw query docs (Task 1). `DEFAULT_LOCALE` is already imported in both files.

- [ ] **Step 1: CategoriesContent — display fallback**

Change (line 294):
```ts
                  const name = displayString(cat.name, language, DEFAULT_LOCALE);
```
to:
```ts
                  // Origin-aware fallback (ADR-020): show the made-in language, not
                  // a prior translation, when the board language is absent.
                  const name = displayString(cat.name, language, cat.authoredLanguage ?? DEFAULT_LOCALE);
```

- [ ] **Step 2: CategoriesContent — pass `authoredLanguage` to GroupTile + guard revert**

Add the prop next to `language={language}` (~line 310):
```tsx
                      nameRecord={cat.name}
                      language={language}
                      authoredLanguage={cat.authoredLanguage ?? DEFAULT_LOCALE}
```

And guard the revert (the `onRevert` at ~lines 313-317) — add the guard as the first line of the handler:
```tsx
                      onRevert={() => {
                        // ADR-020: never strip the origin key on the master board.
                        if (language === (cat.authoredLanguage ?? DEFAULT_LOCALE)) return;
                        const stripped = stripLocaleKey(cat.name, language) as Record<string, string>;
                        if (Object.keys(stripped).length === 0) return; // never strip the last key
                        void updateCategoryMeta({ profileCategoryId: cat._id, name: stripped });
                      }}
```

- [ ] **Step 3: GroupsView — display fallback**

Change (line 251):
```ts
                  const name = displayString(folder.name, language, DEFAULT_LOCALE);
```
to:
```ts
                  const name = displayString(folder.name, language, folder.authoredLanguage ?? DEFAULT_LOCALE);
```

- [ ] **Step 4: GroupsView — pass `authoredLanguage` to GroupTile + guard revert**

Add the prop next to `language={language}` (~line 266):
```tsx
                      nameRecord={folder.name}
                      language={language}
                      authoredLanguage={folder.authoredLanguage ?? DEFAULT_LOCALE}
```

And guard the revert (`onRevert` ~lines 270-274):
```tsx
                      onRevert={() => {
                        // ADR-020: never strip the origin key on the master board.
                        if (language === (folder.authoredLanguage ?? DEFAULT_LOCALE)) return;
                        const stripped = stripLocaleKey(folder.name, language) as Record<string, string>;
                        if (Object.keys(stripped).length === 0) return; // never strip the last key
                        void renameFolder({ folderId: folder._id, name: stripped });
                      }}
```

- [ ] **Step 5: Type-check + lint**

Run:
```bash
npx tsc --noEmit
npx eslint app/components/app/categories/sections/CategoriesContent.tsx app/components/app/shared/sections/GroupsView.tsx
```
Expected: no NEW errors. If `tsc` reports `authoredLanguage` is not a property of `cat`/`folder`, a local type is shadowing the Convex doc — add `authoredLanguage?: string` to that local type (grep the file for a `type … = {` describing the category/folder row). It should type-check directly from the query doc in most cases.

- [ ] **Step 6: Commit**

```bash
git add app/components/app/categories/sections/CategoriesContent.tsx app/components/app/shared/sections/GroupsView.tsx
git commit -m "feat(categories): origin-aware display fallback + revert guard for categories/folders (ADR-020)

Names fall back to authoredLanguage (not DEFAULT_LOCALE/first-key), pass the origin
into GroupTile, and the client-side revert no-ops on the origin board so the master
key can't be stripped.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: ADR-020 + browser acceptance test

**Files:**
- Create: `docs/4-builds/decisions/ADR-020-category-folder-authored-language.md`

- [ ] **Step 1: Write the ADR**

Create `docs/4-builds/decisions/ADR-020-category-folder-authored-language.md` recording: the problem (categories/folders lacked an origin marker → same revert-lands-wrong fragility lists had), the decision (add `authoredLanguage`, origin-aware shared `GroupTile`, origin-aware display fallback, client-side revert guard), the accepted difference from lists (revert is a generic rename, so the guard is client-side + last-key only — no server mutation guard), the runtime `?? DEFAULT_LOCALE` fallback (no migration; optional first-key backfill possible since categories never had the en-hardcode bug), scope (category + folder names; folders across all trees via the shared tile), and non-goals (symbols). State it extends ADR-019. Follow the format of `docs/4-builds/decisions/ADR-019-list-authored-language.md`.

- [ ] **Step 2: Browser acceptance test** (owner-run, dev server + claude-in-chrome)

Create a category on a non-`en` board and a folder on a non-`en` board. For each, in edit mode:
1. On its **origin** board: no Made-in badge, no translate, no revert.
2. On the **other** board, before translating: "Made in \<origin\>" + Translate.
3. Translate it, then on the other board: "Made in \<origin\>" + Revert; pressing Revert falls back to the **origin** (not a prior translation), master intact.
4. Back on the **origin** board after translating: still clean.
5. Confirm a `hi`-origin category (the case that would have broken before) reverts to `hi`, not to a prior translation.

- [ ] **Step 3: Commit the ADR**

```bash
git add docs/4-builds/decisions/ADR-020-category-folder-authored-language.md
git commit -m "docs(adr): ADR-020 origin-aware categories & folders

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3.1 schema + create + callers → Tasks 1 & 2. ✓ (queries need no change — raw docs; noted.)
- §3.2 runtime fallback (no migration) → `?? DEFAULT_LOCALE` used in Tasks 3 & 4. ✓ (optional backfill deferred to ADR note.)
- §3.3 origin-aware GroupTile (listTranslateState + origin→none + MadeInLabel + prop) → Task 3. ✓
- §3.4 display fallback → Task 4 Steps 1 & 3. ✓
- §3.5 revert guard (client-side) → Task 4 Steps 2 & 4. ✓
- §6 ADR-020 → Task 5. ✓
- §7 non-goals (symbols untouched; only folders of other trees change via the shared tile). ✓

**Placeholder scan:** No TBD/TODO; every code step has exact before/after; verify steps give commands + expected results. (Task 5 Step 1 describes ADR sections + a template to follow — an ADR is prose.) ✓

**Type consistency:** `authoredLanguage?: string` optional on schema, create args, and the `GroupTile` prop; `listTranslateState(record, boardLang, authoredLanguage)` used with the exact phase-21 signature; `'origin' → 'none'` mapping at the one `TranslateRevertControl` site; `createProfileCategory`/`createFolder` arg name `authoredLanguage` matches Task 1 (definition) ↔ Task 2 (callers). ✓
