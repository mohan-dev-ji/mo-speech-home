# Provenance-Gated Origin Affordances Implementation Plan (phase-23)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the "Made in \<lang\>" badge and the translate/revert control on library-installed content, so those affordances belong only to content the user authored.

**Architecture:** One shared predicate — `isLibraryContent(record)` = `record.librarySourceId !== undefined` — added to `lib/languages/variants.ts`. Each of the six render surfaces calls it and collapses its existing translate/revert state to `'none'` (or, for `GroupTile`, to `'origin'`, which the component already treats as "no control, no badge"). No schema change, no mutation change, no publish/install change; the only backend edit is one field added to the `getDropbarPhrases` query projection.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Convex 1.x.

**Spec:** [`docs/superpowers/specs/2026-08-15-provenance-gated-origin-affordances-design.md`](../../superpowers/specs/2026-08-15-provenance-gated-origin-affordances-design.md)

## Global Constraints

- **There is no unit-test runner in this repo.** Do not add one, do not invent test files, do not write `describe`/`it` blocks. The per-task verification loop is `npx tsc --noEmit` + `npx eslint <files>`; behavioural confirmation is an owner-run browser pass at the end (Task 6). A task is "done" when type-check and lint pass on the files it touched.
- **Never run `npx convex dev`** — it creates an anonymous local backend and rewrites `.env.local`. Type-check Convex with `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`.
- **Never run `npm run dev`** — the owner keeps a dev server running.
- **Never hard-code UI copy.** This change adds no new strings; it only removes rendered elements. If you think you need a new translation key, stop — you have misread the plan.
- **Always use AAC theme tokens.** No new styling is required by this plan.
- **Do not change display/fallback resolution.** `displayString(record, boardLang, authoredLanguage ?? DEFAULT_LOCALE)` calls stay exactly as they are. Only affordance state changes.
- **Do not touch** `convex/lib/contentModuleInstall.ts`, `convex/contentModules/publish.ts`, `convex/schema.ts`, or any `authoredLanguage` propagation. The superseded spec that proposed those changes is abandoned.
- Commit after every task with the exact message given.

---

### Task 1: The shared gate + the one query that hides `librarySourceId`

The predicate every later task imports, plus the single backend fix. The talker dropdown reads phrases through `dropbar.ts:getDropbarPhrases`, which builds an explicit projection and drops `librarySourceId`; the other five surfaces already carry the field.

**Files:**
- Modify: `lib/languages/variants.ts` (append after `listTranslateState`, which ends ~line 88)
- Modify: `convex/dropbar.ts:110-138` (`getDropbarPhrases` projection)

**Interfaces:**
- Consumes: nothing.
- Produces: `isLibraryContent(record: { librarySourceId?: string }): boolean`, exported from `lib/languages/variants.ts`. Tasks 2-5 all import it from `@/lib/languages/variants`.

- [ ] **Step 1: Add the predicate to `lib/languages/variants.ts`**

Insert directly below the closing brace of `listTranslateState`:

```ts
/**
 * ADR-021 — library-installed content is FINISHED content: no origin badge, no
 * translate, no revert, whatever language keys it holds. Provenance beats
 * language state, because a library row's non-board keys are CURATED
 * translations, not user variants — offering Revert there strips good copy and
 * ADR-019's origin guard doesn't fire (the origin key isn't the one being
 * removed). User-authored rows (no `librarySourceId`) keep the full ADR-019/020
 * behaviour.
 *
 * `librarySourceId` is stamped only by `convex/lib/contentModuleInstall.ts`, so
 * anything the user creates by hand — including a phrase made in the talker
 * dropbar — is user content.
 */
export function isLibraryContent(record: { librarySourceId?: string }): boolean {
  return record.librarySourceId !== undefined;
}
```

- [ ] **Step 2: Add `librarySourceId` to the dropbar phrase projection**

In `convex/dropbar.ts`, inside `getDropbarPhrases`, the returned object currently ends:

```ts
        // ADR-016 — client collapses sibling variants by board language + shows
        // the "Made in <lang>" badge / author entry.
        authoredLanguage: p.authoredLanguage,
        variantGroupId: p.variantGroupId,
      }));
```

Change it to:

```ts
        // ADR-016 — client collapses sibling variants by board language + shows
        // the "Made in <lang>" badge / author entry.
        authoredLanguage: p.authoredLanguage,
        variantGroupId: p.variantGroupId,
        // ADR-021 — provenance gate: library-installed phrases show no badge and
        // no translate/revert. Absent on anything the user created here.
        librarySourceId: p.librarySourceId,
      }));
```

- [ ] **Step 3: Type-check both projects**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0, no output.

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json
```

Expected: prints the nvm "Now using node v20.17.0" line, then exits 0 with no type errors.

- [ ] **Step 4: Lint the touched files**

Run:

```bash
npx eslint lib/languages/variants.ts convex/dropbar.ts
```

Expected: exits 0, no output.

- [ ] **Step 5: Commit**

```bash
git add lib/languages/variants.ts convex/dropbar.ts
git commit -m "feat(i18n): add isLibraryContent gate + expose librarySourceId to the dropbar"
```

---

### Task 2: Categories and folders (`GroupTile`)

`GroupTile` renders every category tile and every folder tile in all three foldered trees. It already computes one `tileState` that both the control (`:206`) and the badge (`:225`) key off, so a single assignment gates both.

**Files:**
- Modify: `app/components/app/shared/ui/GroupTile.tsx` (props block ~`:63-70`, destructuring `:87-106`, `tileState` `:165-167`)
- Modify: `app/components/app/categories/sections/CategoriesContent.tsx:298` (`<GroupTile>` call site)
- Modify: `app/components/app/shared/sections/GroupsView.tsx:253` (`<GroupTile>` call site)

**Interfaces:**
- Consumes: `isLibraryContent` from `@/lib/languages/variants` (Task 1).
- Produces: `GroupTile` accepts a new optional prop `isLibraryContent?: boolean`. Omitting it preserves today's behaviour, so no other caller breaks.

- [ ] **Step 1: Add the prop to `GroupTile`'s `Props` type**

In `app/components/app/shared/ui/GroupTile.tsx`, find:

```ts
  /** The record's origin/master language (ADR-020). Falls back to DEFAULT_LOCALE. */
  authoredLanguage?: string;
```

Add immediately below it:

```ts
  /**
   * ADR-021 — true for library-installed rows (those carrying `librarySourceId`).
   * Suppresses BOTH the "Made in" badge and the translate/revert control:
   * curated content ships complete in every supported language, so there is
   * nothing to translate, and a revert would strip a curated translation rather
   * than a user variant. Omitted → user content → unchanged ADR-019/020 kit.
   */
  isLibraryContent?: boolean;
```

- [ ] **Step 2: Destructure the prop**

In the same file, the component signature currently reads:

```ts
  nameRecord,
  language,
  authoredLanguage,
  onRevert,
}: Props) {
```

Change it to:

```ts
  nameRecord,
  language,
  authoredLanguage,
  isLibraryContent,
  onRevert,
}: Props) {
```

- [ ] **Step 3: Gate `tileState`**

Replace this block (~`:165`):

```ts
  const tileState = language && nameRecord
    ? listTranslateState(nameRecord, language, authoredLanguage ?? DEFAULT_LOCALE)
    : 'origin';
```

with:

```ts
  const tileState = isLibraryContent || !language || !nameRecord
    ? 'origin'
    : listTranslateState(nameRecord, language, authoredLanguage ?? DEFAULT_LOCALE);
```

`'origin'` is the component's existing "no control, no badge" state — the control at `:206` maps it to `state='none'` (renders nothing) and the badge at `:225` is guarded by `tileState !== 'origin'`. No further edits inside `GroupTile`.

- [ ] **Step 4: Pass it from the categories grid**

In `app/components/app/categories/sections/CategoriesContent.tsx`, find in the `<GroupTile>` call:

```tsx
                      authoredLanguage={cat.authoredLanguage ?? DEFAULT_LOCALE}
```

Add immediately below:

```tsx
                      isLibraryContent={isLibraryContent(cat)}
```

Add the import to the existing `@/lib/languages/variants` import if one is present; otherwise add:

```ts
import { isLibraryContent } from '@/lib/languages/variants';
```

- [ ] **Step 5: Pass it from the folders grid**

In `app/components/app/shared/sections/GroupsView.tsx`, find in the `<GroupTile>` call:

```tsx
                      authoredLanguage={folder.authoredLanguage ?? DEFAULT_LOCALE}
```

Add immediately below:

```tsx
                      isLibraryContent={isLibraryContent(folder)}
```

Add the import the same way as Step 4. The local folder type already declares `librarySourceId?: string` (`GroupsView.tsx:64`), so no type change is needed.

- [ ] **Step 6: Type-check and lint**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0, no output.

Run:

```bash
npx eslint app/components/app/shared/ui/GroupTile.tsx app/components/app/categories/sections/CategoriesContent.tsx app/components/app/shared/sections/GroupsView.tsx
```

Expected: exits 0, no output.

- [ ] **Step 7: Commit**

```bash
git add app/components/app/shared/ui/GroupTile.tsx app/components/app/categories/sections/CategoriesContent.tsx app/components/app/shared/sections/GroupsView.tsx
git commit -m "feat(i18n): hide origin badge + translate/revert on library categories and folders"
```

---

### Task 3: Lists — card and per-item controls

Two surfaces: the list card in the groups view, and the per-item description controls inside a list's detail edit mode. Item-level provenance comes from the **parent list** — items have no `librarySourceId` of their own.

**Files:**
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx:151` (`cardState`)
- Modify: `app/components/app/lists/sections/ListDetailContent.tsx:445` (`editProps`)
- Modify: `app/components/app/lists/sections/ListDetailEdit.tsx` (`EditItemProps` `:30`, `EditContainerProps` `:47`, three row components `:69`/`:124`/`:179`, three containers `:255`/`:287`/`:332`)

**Interfaces:**
- Consumes: `isLibraryContent` from `@/lib/languages/variants` (Task 1).
- Produces: `EditItemProps` and `EditContainerProps` each gain a required `isLibraryContent: boolean` field. `ListDetailContent`'s `editProps` object supplies it once; all three containers are called with `{...editProps}` (`ListDetailContent.tsx:581-583`), so no call-site edits are needed there.

- [ ] **Step 1: Gate the list card state**

In `app/components/app/lists/sections/ListsModeContent.tsx`, replace:

```ts
  const cardState = listTranslateState(
    list.name,
    language,
    list.authoredLanguage ?? DEFAULT_LOCALE,
  );
```

with:

```ts
  // ADR-021 — library lists ship complete in every language: no badge, no
  // control. 'origin' is the existing "no affordances" state.
  const cardState = isLibraryContent(list)
    ? 'origin'
    : listTranslateState(list.name, language, list.authoredLanguage ?? DEFAULT_LOCALE);
```

Add `isLibraryContent` to the existing `@/lib/languages/variants` import in this file. The `ListRow` type already declares `librarySourceId?: string` (`:66`), so no type change is needed. Both consumers already key off `cardState` — the control at `:191` (`cardState === 'origin' ? 'none' : cardState`) and the badge at `:227` (`cardState !== 'origin'`) — so no further edits here.

- [ ] **Step 2: Thread provenance into the list detail edit props**

In `app/components/app/lists/sections/ListDetailContent.tsx`, find in the `editProps` object:

```ts
    authoredLanguage: list.authoredLanguage ?? DEFAULT_LOCALE,
```

Add immediately below:

```ts
    // ADR-021 — item controls follow the PARENT list's provenance; items carry
    // no librarySourceId of their own.
    isLibraryContent: isLibraryContent(list),
```

Add `isLibraryContent` to the existing `@/lib/languages/variants` import in this file. `getProfileListWithItems` already returns `librarySourceId` (`convex/profileLists.ts:64`).

- [ ] **Step 3: Add the field to both prop types in `ListDetailEdit.tsx`**

In `type EditItemProps` (`:30`), find:

```ts
  language: string;
  authoredLanguage: string;
  onDeleteRequest: () => void;
```

Change to:

```ts
  language: string;
  authoredLanguage: string;
  /** ADR-021 — parent list is library-installed: no translate/revert control. */
  isLibraryContent: boolean;
  onDeleteRequest: () => void;
```

In `export type EditContainerProps` (`:47`), find:

```ts
  language: string;
  authoredLanguage: string;
  onDragEnd: (event: DragEndEvent) => void;
```

Change to:

```ts
  language: string;
  authoredLanguage: string;
  /** ADR-021 — parent list is library-installed: no translate/revert control. */
  isLibraryContent: boolean;
  onDragEnd: (event: DragEndEvent) => void;
```

- [ ] **Step 4: Gate `controlState` in all three row components**

`SortableEditRow` (`:69`), `SortableEditColumn` (`:124`) and `SortableEditGrid` (`:179`) each open with the identical destructuring line and each compute `controlState` identically. In **each of the three**, change the destructuring line:

```ts
  item, index, showNumbers, showChecklist, language, authoredLanguage,
```

to:

```ts
  item, index, showNumbers, showChecklist, language, authoredLanguage, isLibraryContent,
```

and change the state line:

```ts
  const controlState: TranslateRevertState = originState === 'origin' ? 'none' : originState;
```

to:

```ts
  const controlState: TranslateRevertState =
    isLibraryContent || originState === 'origin' ? 'none' : originState;
```

Leave the `originState` computation above it untouched.

- [ ] **Step 5: Pass the prop down in all three containers**

`EditRows` (`:255`), `EditColumns` (`:287`) and `EditGrid` (`:332`) each destructure the container props inline on one long line. In **each of the three**, change:

```ts
{ items, showNumbers, showChecklist, language, authoredLanguage, onDragEnd,
```

to:

```ts
{ items, showNumbers, showChecklist, language, authoredLanguage, isLibraryContent, onDragEnd,
```

(the rest of each destructuring line is unchanged), and in each container's JSX find:

```tsx
              authoredLanguage={authoredLanguage}
```

adding immediately below it:

```tsx
              isLibraryContent={isLibraryContent}
```

Those three JSX sites are at `:269`, `:302` and `:346`.

- [ ] **Step 6: Type-check and lint**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0, no output. A missing-prop error on `EditRows`/`EditColumns`/`EditGrid` means Step 2 was skipped — `editProps` must supply `isLibraryContent`.

Run:

```bash
npx eslint app/components/app/lists/sections/ListsModeContent.tsx app/components/app/lists/sections/ListDetailContent.tsx app/components/app/lists/sections/ListDetailEdit.tsx
```

Expected: exits 0, no output.

- [ ] **Step 7: Commit**

```bash
git add app/components/app/lists/sections/ListsModeContent.tsx app/components/app/lists/sections/ListDetailContent.tsx app/components/app/lists/sections/ListDetailEdit.tsx
git commit -m "feat(i18n): hide origin badge + translate/revert on library lists and their items"
```

---

### Task 4: Sentences

The sentence row computes `badgeLang` (drives the badge) and `translateState` (drives the control) as two separate values, so both need the gate.

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx:556-571`

**Interfaces:**
- Consumes: `isLibraryContent` from `@/lib/languages/variants` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Gate both values**

In `app/components/app/sentences/sections/SentencesModeContent.tsx`, find:

```ts
  const badgeLang = isSequenceRow(sentence)
    ? (authoredLang !== language ? authoredLang : undefined)
    : (needsTranslation(fluentPrimary, language)
        ? resolvedLocale(fluentPrimary, language, DEFAULT_LOCALE)
        : undefined);
```

Change to:

```ts
  // ADR-021 — library-installed sentences are finished content: no badge, no
  // variant authoring, no revert (their sibling variants are curated, not the
  // user's). Computed once and applied to both the badge and the control.
  const isLibrarySentence = isLibraryContent(sentence);
  const badgeLang = isLibrarySentence
    ? undefined
    : isSequenceRow(sentence)
      ? (authoredLang !== language ? authoredLang : undefined)
      : (needsTranslation(fluentPrimary, language)
          ? resolvedLocale(fluentPrimary, language, DEFAULT_LOCALE)
          : undefined);
```

Then find:

```ts
  const translateState: TranslateRevertState =
    badgeLang ? 'untranslated'
    : isRevertableVariant(sentence) ? 'translated'
    : 'none';
```

Change to:

```ts
  const translateState: TranslateRevertState =
    isLibrarySentence ? 'none'
    : badgeLang ? 'untranslated'
    : isRevertableVariant(sentence) ? 'translated'
    : 'none';
```

Leave the explanatory comments above each block in place. Add `isLibraryContent` to the existing `@/lib/languages/variants` import. `SentenceRow` already declares `librarySourceId?: string` (`:118`).

- [ ] **Step 2: Type-check and lint**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0, no output.

Run:

```bash
npx eslint app/components/app/sentences/sections/SentencesModeContent.tsx
```

Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add app/components/app/sentences/sections/SentencesModeContent.tsx
git commit -m "feat(i18n): hide origin badge + translate/revert on library sentences"
```

---

### Task 5: Phrases (talker dropdown)

The dropdown's badge is derived from `phraseState`, so gating that one value removes both affordances.

**Files:**
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx:671-674`

**Interfaces:**
- Consumes: `isLibraryContent` from `@/lib/languages/variants` (Task 1) and the `librarySourceId` field added to `getDropbarPhrases` in Task 1. The phrase type here is inferred from the Convex query, so no local type edit is needed — if `p.librarySourceId` is a type error, Task 1 Step 2 was skipped.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Gate `phraseState`**

In `app/components/app/shared/ui/TalkerDropdown.tsx`, find:

```ts
                const phraseState: TranslateRevertState =
                  needsTranslation(p.name, language) ? 'untranslated'
                  : isRevertableVariant(p) ? 'translated'
                  : 'none';
```

Change to:

```ts
                // ADR-021 — a library-installed phrase is finished content. A
                // phrase the user made HERE has no librarySourceId (only the
                // dropbar CONTAINER folder carries the sentinel), so it keeps
                // the full authoring kit.
                const phraseState: TranslateRevertState =
                  isLibraryContent(p) ? 'none'
                  : needsTranslation(p.name, language) ? 'untranslated'
                  : isRevertableVariant(p) ? 'translated'
                  : 'none';
```

Add `isLibraryContent` to the existing `@/lib/languages/variants` import. The `madeInLabel` prop at `:707` is already guarded by `phraseState === 'untranslated'`, so it disappears with no further edit.

- [ ] **Step 2: Type-check and lint**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0, no output.

Run:

```bash
npx eslint app/components/app/shared/ui/TalkerDropdown.tsx
```

Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add app/components/app/shared/ui/TalkerDropdown.tsx
git commit -m "feat(i18n): hide origin badge + translate/revert on library phrases"
```

---

### Task 6: ADR-021 + owner acceptance

The decision record, and the one behavioural check no type-checker can make.

**Files:**
- Create: `docs/4-builds/decisions/ADR-021-provenance-gated-origin-affordances.md`

**Interfaces:**
- Consumes: the implemented behaviour from Tasks 1-5.
- Produces: nothing.

- [ ] **Step 1: Write the ADR**

Create `docs/4-builds/decisions/ADR-021-provenance-gated-origin-affordances.md` following the house format of ADR-019/020 (`# ADR-021 — …`, then **Status/Date/Extends/Design** lines, `## Context`, `## Decision` with a `### Mechanism` subsection, `## Consequences`). It must state:

- **Context:** ADR-016/019/020 gave content an origin marker and origin-aware translate/revert. Those affordances also rendered on library-installed content, where the non-board language keys are *curated translations*, not user variants — so Revert strips good copy (ADR-019's guard protects only the origin key), the "Made in EN" badge is noise on content that ships complete in every language, and Translate has nothing to do.
- **Decision:** gate the affordances on **provenance** (`librarySourceId`), not language state. Library-sourced → no badge, no Translate, no Revert, ever. User-authored → unchanged ADR-019/020 behaviour. Display/fallback resolution is untouched.
- **Mechanism:** `isLibraryContent()` in `lib/languages/variants.ts`; six surfaces collapse their state (`GroupTile` via a new prop → `tileState = 'origin'`; lists, list items, sentences, phrases via `'none'`); one field added to `getDropbarPhrases`. No schema, mutation, publish or install change.
- **Consequences, including these four:**
  1. A freshly seeded account shows no origin affordances anywhere — all its content is library-installed. The admin's authoring account is unaffected (its source rows have no `librarySourceId`), so multilingual defaults can still be built.
  2. Provenance is fixed at install: editing a library list does not restore its controls. Accepted — library content arrives fully translated, so edits are preference tweaks.
  3. The dropbar's core-words category and phrases folder carry sentinel `librarySourceId` values (`dropbar.ts:70`/`:85`), so those *container tiles* lose their controls; phrases the user creates inside keep theirs, because the rule keys on the row being rendered, not its parent.
  4. **Precondition for the next app language.** Installed content is a copy; re-publishing a module does not update rows already materialised in family accounts, and no reload path exists (`contentModuleInstall.ts:6` claims one; only uninstall and dedup are implemented). The removed Translate button was an accidental recovery path for that gap. Before the next language run, ship a refresh — an admin backfill patching installed rows' localised records from their `libraryModules` source, matched by `librarySourceId` and preserving user edits, or a user-facing per-module "update from library".
- **Supersedes note:** the same-day `authoredLanguage`-propagation design was abandoned; with the affordances gated, nothing consumes a module-level origin marker.

Also add the ADR link to the spec's header line (`**Decision record:** ADR-021`) in `docs/superpowers/specs/2026-08-15-provenance-gated-origin-affordances-design.md`, replacing "(to be written with the implementation)".

- [ ] **Step 2: Full verification sweep**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0, no output.

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json
```

Expected: exits 0, no type errors.

Run:

```bash
npx eslint lib/languages/variants.ts convex/dropbar.ts app/components/app/shared/ui/GroupTile.tsx app/components/app/shared/ui/TalkerDropdown.tsx app/components/app/categories/sections/CategoriesContent.tsx app/components/app/shared/sections/GroupsView.tsx app/components/app/lists/sections/ListsModeContent.tsx app/components/app/lists/sections/ListDetailContent.tsx app/components/app/lists/sections/ListDetailEdit.tsx app/components/app/sentences/sections/SentencesModeContent.tsx
```

Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add docs/4-builds/decisions/ADR-021-provenance-gated-origin-affordances.md docs/superpowers/specs/2026-08-15-provenance-gated-origin-affordances-design.md
git commit -m "docs(adr): ADR-021 provenance-gated origin affordances"
```

- [ ] **Step 4: Hand over for owner acceptance — do NOT self-certify**

The dropbar query change only reaches the live deployment once this branch lands on `main` (where `convex dev` runs), so the dropdown check requires the merge. Report to the owner that the code is complete and type-clean, and give them this checklist:

1. **Seeded content, edit mode, any board language** — default categories, seeded list folders, seeded sentences: no "Made in" badge, no translate/revert icon.
2. **Own content** — create a category, a folder, a list, a sentence and a dropbar phrase; switch to a different board language: "Made in \<origin\>" + Translate appear; translate one, confirm Revert appears and restores the master.
3. **List items** — open a library list in edit mode: no per-item translate/revert. Open a hand-made list on a non-origin board: per-item controls behave as before.
4. **Dropbar** — a phrase you created keeps its badge and control; the phrases *folder tile* itself has none.

Once the owner confirms, move this plan to `docs/4-builds/plans/_done/`.

---

## Self-Review

**Spec coverage:** §3.1 gate → Task 1. §3.2 all six surfaces → Tasks 2 (categories, folders), 3 (list card, list items), 4 (sentences), 5 (phrases) + the `getDropbarPhrases` fix in Task 1. §3.3 edge cases → documented in ADR (Task 6) and in the Task 5 comment. §4 language-refresh dependency → ADR consequence 4 (Task 6). §5 non-goals → Global Constraints ("do not touch" list). §6 verification → per-task loops + Task 6 sweep.

**Placeholders:** none — every step carries the exact before/after code or the exact command. Task 6 Step 1 specifies the ADR's required content point by point rather than deferring it.

**Type consistency:** `isLibraryContent` is the single exported name, imported identically in Tasks 2-5; the `GroupTile` prop and the `EditItemProps`/`EditContainerProps` field reuse that name. `GroupTile`'s prop is optional (no other caller breaks); the list edit props are required (the one caller supplies them via `editProps`).
