# Phase 26 — Drafts bucket + a shared group picker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The synthetic "Ungrouped" tile becomes **Drafts** with a real cover symbol, and the three places that create content gain one shared group picker with an inline "new group" option, so there is somewhere to put a thing at the moment you make it.

**Architecture:** The bucket rename is copy plus one image swap — every display site already reads `t('ungrouped')`, so only `GroupsView` needs code. The picker is built once as a presentational component that *reports* a `GroupSelection` and never writes; a companion hook resolves that selection into a `folderId`, creating the folder before the content so a failed create leaves nothing behind. Three hosts consume it: the talker's save dialog, and Home's two create modals behind an opt-in prop.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4

**Spec:** `docs/superpowers/specs/2026-08-17-drafts-and-group-picker-design.md`
**Relevant ADRs:** ADR-014 (group folders + the `ungrouped` sentinel), ADR-015 (talker save)

## Global Constraints

- **No test runner exists in this repo, and you must not add one.** Per-task gate is `npx tsc --noEmit -p tsconfig.json` filtered to the touched files, `npx eslint <files>`, then browser verification.
- **`tsc` has 4 pre-existing unrelated errors** — three stale `.next/types/validator.ts` module-not-found entries and one `lib/stripe.ts` API-version mismatch. Never expect a clean exit; grep for the files you touched and expect **no output**.
- **Known pre-existing eslint noise** (not yours, do not fix): `SentencesModeContent.tsx` 2 `react-hooks/refs` errors (~line 904); `SymbolEditorModal.tsx` 5 problems (~274/351/402/437/480).
- **UI copy:** never hard-code strings. Every key goes in **`messages/en.json` only** — never hand-add to `hi.json`/`es.json`. `i18n/request.ts` merges each locale over `en.json`, and the translation pipeline only translates keys *absent* from a locale, so a hand-added placeholder ships forever.
- **Theme tokens only:** no hard-coded colours, radii, spacing, or font sizes. Tailwind CSS 4, no `tailwind.config.ts`; `--theme-*` vars live in `app/globals.css`. `UNGROUPED_COLOUR` in `GroupsView.tsx` is an existing exception and stays as-is.
- **The `ungrouped` URL sentinel does not change.** `/…/folder/ungrouped` must keep working. This plan renames the *label* only.
- **Drafts is a label, not behaviour.** Nothing here hides Drafts from student boards or changes what its contents do.
- **Dev server is already running on http://localhost:3000.** Do **not** run `npm run dev`. **Never run `npx convex dev`** — verify Convex-facing types with `npx tsc -p convex/tsconfig.json`.
- **Browser verification uses signed-in Chrome** (the `claude-in-chrome` tools), not the in-app browser — the app requires a Clerk session.
- **Work on `main`.** Do not create a branch. Stage only the paths each task's commit lists — never `git add -A`.

---

### Task 1: The bucket becomes Drafts

Copy plus one image swap. Independently shippable and it fixes the thing that looks broken today, so it lands first.

Every other display site — both breadcrumbs, both move-to-group dialogs, `ListDetailContent`'s back link — already calls `t('ungrouped')`, so they follow from the copy change with no code edit. Only the tile's placeholder icon needs replacing.

**Files:**
- Modify: `messages/en.json` (`sentences.ungrouped`, `lists.ungrouped`, `talker.saveUngrouped`)
- Modify: `app/components/app/shared/sections/GroupsView.tsx:7` (import), `:286-303` (the synthetic tile)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks depend on. Task 4 deletes `talker.saveUngrouped`.

---

- [ ] **Step 1: Rename the three copy values**

In `messages/en.json`, change **only these three values**, leaving the keys themselves alone:

- `sentences.ungrouped`: `"Ungrouped"` → `"Drafts"`
- `lists.ungrouped`: `"Ungrouped"` → `"Drafts"`
- `talker.saveUngrouped`: `"Ungrouped"` → `"Drafts"`

**`en.json` only.** Do not touch `hi.json` or `es.json`.

- [ ] **Step 2: Verify the JSON still parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Give the tile a real cover symbol**

In `app/components/app/shared/sections/GroupsView.tsx`, the synthetic tile's image block currently reads:

```tsx
                    <div className="w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden" style={{ backgroundColor: getCategoryColour(UNGROUPED_COLOUR).c100, padding: '8cqi' }}>
                      <ImageIcon className="w-1/2 h-1/2" style={{ color: getCategoryColour(UNGROUPED_COLOUR).c500 }} />
                    </div>
```

Replace that block with:

```tsx
                    <div className="w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden" style={{ backgroundColor: getCategoryColour(UNGROUPED_COLOUR).c100, padding: '8cqi' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/api/assets?key=symbols/write.png"
                        alt=""
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    </div>
```

Also update the comment two lines above the `<button>` from:

```tsx
                {/* Synthetic Ungrouped tile — not editable, always last. Mirrors
                    GroupTile's view-mode look (same ImageIcon fallback). */}
```

to:

```tsx
                {/* Synthetic Drafts tile — items whose folderId is unset. Not a
                    profileFolders row, so it is deliberately not editable: no
                    rename, colour, delete or drag, and it renders only while
                    something is in it. Keeps the grey UNGROUPED_COLOUR as the cue
                    that it isn't a recolourable folder. The `ungrouped` URL
                    sentinel is unchanged — this is a label, not a new concept. */}
```

- [ ] **Step 4: Drop the now-unused icon import**

`ImageIcon` was only used by the block you just replaced. In the same file, line 7 reads:

```tsx
import { ImageIcon } from 'lucide-react';
```

Delete that line entirely. Leaving it will fail lint as an unused import.

- [ ] **Step 5: Confirm nothing else used it**

```bash
grep -n "ImageIcon" app/components/app/shared/sections/GroupsView.tsx
```

Expected: **no output**. If anything matches, restore the import instead of deleting it.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "GroupsView"
```

Expected: **no output**.

- [ ] **Step 7: Lint**

```bash
npx eslint app/components/app/shared/sections/GroupsView.tsx
```

Expected: no errors.

- [ ] **Step 8: Browser check**

In signed-in Chrome on **http://localhost:3000**:

1. `/en/sentences` — the grey tile reads **Drafts** and shows a pencil-on-paper symbol, not the generic placeholder.
2. Click it — it opens, the breadcrumb reads **Drafts**, the URL is still `/en/sentences/folder/ungrouped`, and its contents are unchanged.
3. `/en/lists` — same tile, same label. (If no unfiled list exists the tile is correctly absent; create one from Home's "Create a list" card to see it, then delete it.)
4. In edit mode on either groups page, the Drafts tile still has **no** colour, trash or drag controls.
5. Move the last item out of Drafts (edit mode → the move-to-group button on the row) — the tile disappears entirely. Move it back to confirm it returns.

- [ ] **Step 9: Commit**

```bash
git add messages/en.json app/components/app/shared/sections/GroupsView.tsx
git commit -F- <<'MSG'
feat(groups): the ungrouped bucket becomes Drafts with a cover symbol

It is synthetic — a view over items whose folderId is unset — so it had no
name worth reading and a placeholder icon, which made it look like a broken
folder rather than a deliberate place.

Label and cover only: still visible on student boards, still not editable,
still renders only while something is in it, and the `ungrouped` URL
sentinel is untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 2: The GroupPicker component

Presentational only. It renders the tree's folders, a Drafts row, and a "+ New group" row that reveals an inline name input — and it **reports** what the user chose. It never creates anything; Task 3 owns that.

No consumers yet; Tasks 4 and 6 wire it up.

**Files:**
- Create: `app/components/app/shared/ui/GroupPicker.tsx`
- Modify: `messages/en.json` (new `groupPicker` namespace)

**Interfaces:**
- Consumes: `api.profileFolders.getProfileFolders` (args `{ tree }`), `useProfile()` for `language`, `displayString` from `@/lib/languages/displayValue`, `DEFAULT_LOCALE` from `@/lib/languages/registry`.
- Produces:
  - `export type GroupSelection = { kind: 'folder'; id: Id<'profileFolders'> } | { kind: 'drafts' } | { kind: 'new'; name: string }`
  - `export function GroupPicker(props: { tree: 'sentences' | 'lists'; value: GroupSelection; onChange: (next: GroupSelection) => void }): JSX.Element`
  - `export function isGroupSelectionReady(sel: GroupSelection): boolean`
  - `export const DRAFTS_SELECTION: GroupSelection` — the shared `{ kind: 'drafts' }` default.

  Tasks 3, 4 and 6 all import from this module.

---

- [ ] **Step 1: Add the copy keys**

In `messages/en.json`, add a new top-level `groupPicker` object (place it alphabetically near the other namespaces):

```json
  "groupPicker": {
    "label": "Group",
    "drafts": "Drafts",
    "newGroup": "+ New group",
    "newGroupPlaceholder": "Group name"
  },
```

`groupPicker.drafts` deliberately duplicates the `"Drafts"` value in `sentences.ungrouped` / `lists.ungrouped`: those label the *tile and breadcrumbs*, this labels a *row in a picker*, and translators should be free to word them differently. **`en.json` only.**

- [ ] **Step 2: Verify the JSON still parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Create the component**

Create `app/components/app/shared/ui/GroupPicker.tsx`:

```tsx
"use client";

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';

/**
 * Where a newly created thing should go. The picker REPORTS this; it never
 * writes. `useResolveGroupSelection` turns it into a folderId, creating the
 * folder when kind === 'new' — that ordering (folder first, then content) lives
 * in one place so a failed create can't strand an item.
 */
export type GroupSelection =
  | { kind: 'folder'; id: Id<'profileFolders'> }
  | { kind: 'drafts' }
  | { kind: 'new'; name: string };

/** The default every host opens on, and what "sort it later" means. */
export const DRAFTS_SELECTION: GroupSelection = { kind: 'drafts' };

/** A host's submit stays disabled until this is true. */
export function isGroupSelectionReady(sel: GroupSelection): boolean {
  return sel.kind === 'new' ? sel.name.trim().length > 0 : true;
}

type Props = {
  tree: 'sentences' | 'lists';
  value: GroupSelection;
  onChange: (next: GroupSelection) => void;
};

/**
 * "Where does this go?" — the tree's folders, Drafts, and an inline new group.
 * Shared by the talker's save dialog and Home's two create modals so the
 * question looks and behaves the same wherever content is created.
 */
export function GroupPicker({ tree, value, onChange }: Props) {
  const t = useTranslations('groupPicker');
  const { language } = useProfile();
  const folders = useQuery(api.profileFolders.getProfileFolders, { tree });
  // Kept across a toggle away and back, so a mistyped name isn't lost.
  const [newName, setNewName] = useState('');

  const rowStyle = (selected: boolean) => ({
    background: selected ? 'var(--theme-primary)' : 'var(--theme-symbol-bg)',
    color: selected ? 'var(--theme-alt-text)' : 'var(--theme-text)',
    border: `2px solid ${selected ? 'var(--theme-primary)' : 'transparent'}`,
  });

  const rowClass = 'text-left px-3 py-2.5 rounded-theme-sm text-theme-s font-medium transition-colors';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
        {t('label')}
      </label>

      <div className="flex flex-col gap-2 max-h-[40vh] overflow-auto">
        {(folders ?? []).map((f) => {
          const selected = value.kind === 'folder' && value.id === f._id;
          return (
            <button
              key={f._id}
              type="button"
              onClick={() => onChange({ kind: 'folder', id: f._id })}
              className={rowClass}
              style={rowStyle(selected)}
            >
              {displayString(f.name, language, DEFAULT_LOCALE)}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChange({ kind: 'drafts' })}
          className={rowClass}
          style={rowStyle(value.kind === 'drafts')}
        >
          {t('drafts')}
        </button>

        <button
          type="button"
          onClick={() => onChange({ kind: 'new', name: newName })}
          className={rowClass}
          style={rowStyle(value.kind === 'new')}
        >
          {t('newGroup')}
        </button>

        {value.kind === 'new' && (
          <input
            type="text"
            value={newName}
            autoFocus
            onChange={(e) => {
              setNewName(e.target.value);
              onChange({ kind: 'new', name: e.target.value });
            }}
            placeholder={t('newGroupPlaceholder')}
            className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
            style={{
              background: 'var(--theme-symbol-bg)',
              color: 'var(--theme-text)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "GroupPicker"
```

Expected: **no output**.

- [ ] **Step 5: Lint**

```bash
npx eslint app/components/app/shared/ui/GroupPicker.tsx
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json app/components/app/shared/ui/GroupPicker.tsx
git commit -F- <<'MSG'
feat(groups): shared GroupPicker — folders, Drafts, inline new group

Reports a GroupSelection and never writes, so the create-folder-then-create-
content ordering lives in one hook rather than in each of the three hosts
that will ask this question.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 3: The resolver hook

Turns a `GroupSelection` into a `folderId`, creating the folder when the user chose "new". One implementation of the ordering — **folder first, then the content** — so a failed folder create leaves nothing behind, and no host can get it subtly different.

**Files:**
- Create: `app/lib/folders/useResolveGroupSelection.ts`

**Interfaces:**
- Consumes: `GroupSelection` from `@/app/components/app/shared/ui/GroupPicker` (Task 2), `api.profileFolders.createFolder` (args `{ tree, name, colour?, icon?, authoredLanguage? }`, returns the new `Id<'profileFolders'>`), `useProfile()` for `language`.
- Produces: `export function useResolveGroupSelection(tree: 'sentences' | 'lists'): (sel: GroupSelection) => Promise<Id<'profileFolders'> | undefined>`. Tasks 4 and 6 call it.

---

- [ ] **Step 1: Create the hook**

Create `app/lib/folders/useResolveGroupSelection.ts`:

```ts
"use client";

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import type { GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';

/**
 * Resolve a GroupPicker selection to the folderId the content should be created
 * with, creating the folder first when the user chose "new group".
 *
 * Callers MUST await this BEFORE creating their content. That order is the
 * point of the hook: if the folder create fails, nothing is written and the
 * caller's dialog stays open. The reverse order could strand an item whose
 * folder never appeared.
 *
 * A "new" selection with a blank name resolves to undefined (Drafts) rather
 * than creating an untitled folder — hosts gate submit on
 * `isGroupSelectionReady`, so this is a backstop, not the expected path.
 */
export function useResolveGroupSelection(tree: 'sentences' | 'lists') {
  const createFolder = useMutation(api.profileFolders.createFolder);
  const { language } = useProfile();

  return useCallback(
    async (sel: GroupSelection): Promise<Id<'profileFolders'> | undefined> => {
      if (sel.kind === 'folder') return sel.id;
      if (sel.kind === 'drafts') return undefined;
      const name = sel.name.trim();
      if (!name) return undefined;
      // Key the name under the board language and stamp it as the origin
      // language (ADR-020) — same call CreateGroupModal makes, so a group made
      // here is an ordinary folder: colour and cover are set later in edit mode.
      return await createFolder({
        tree,
        name: { [language]: name },
        authoredLanguage: language,
      });
    },
    [createFolder, tree, language],
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "useResolveGroupSelection|GroupPicker"
```

Expected: **no output**.

- [ ] **Step 3: Lint**

```bash
npx eslint app/lib/folders/useResolveGroupSelection.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/lib/folders/useResolveGroupSelection.ts
git commit -F- <<'MSG'
feat(groups): useResolveGroupSelection — create the folder, then the content

One implementation of the ordering. Callers await this before creating their
content, so a failed folder create writes nothing instead of stranding an
item whose folder never appeared.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 4: The talker save dialog uses the picker

First real consumer, and the one you asked for: saving a block sentence from the talker can now create the group it belongs in.

`PersistentTalker` already has a hand-rolled folder list and a smart default. The list is replaced by `GroupPicker`; the smart default (ADR-014 §7 — match the current category's name, else the bucket) is preserved, just expressed as a `GroupSelection`.

**Files:**
- Modify: `app/components/app/shared/sections/PersistentTalker.tsx` (imports; `saveSelection` state ~line 69; `computeDefaultFolder` ~106-115; `handleSaveConfirm` ~line 171; the dialog markup ~234-256; the Save button's `disabled` ~line 275)
- Modify: `messages/en.json` (delete the now-unused `talker.saveUngrouped`)

**Interfaces:**
- Consumes: `GroupPicker`, `GroupSelection`, `DRAFTS_SELECTION`, `isGroupSelectionReady` (Task 2); `useResolveGroupSelection` (Task 3).
- Produces: nothing downstream.

---

- [ ] **Step 1: Add the imports**

In `app/components/app/shared/sections/PersistentTalker.tsx`, add to the import block:

```tsx
import { GroupPicker, DRAFTS_SELECTION, isGroupSelectionReady, type GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';
import { useResolveGroupSelection } from '@/app/lib/folders/useResolveGroupSelection';
```

- [ ] **Step 2: Retype the selection state and add the resolver**

The state line currently reads:

```tsx
  const [saveSelection, setSaveSelection] = useState<Id<'profileFolders'> | 'ungrouped' | null>(null);
```

Replace it with:

```tsx
  const [saveSelection, setSaveSelection] = useState<GroupSelection>(DRAFTS_SELECTION);
  const resolveGroup = useResolveGroupSelection('sentences');
```

- [ ] **Step 3: Express the smart default as a selection**

`computeDefaultFolder` currently reads:

```tsx
  function computeDefaultFolder(): Id<'profileFolders'> | 'ungrouped' {
    const label = breadcrumbExtra?.label?.trim().toLowerCase();
    if (label) {
      const match = (sentenceFolders ?? []).find(
        (f) => displayString(f.name, language, DEFAULT_LOCALE).trim().toLowerCase() === label
      );
      if (match) return match._id;
    }
    return 'ungrouped';
  }
```

Replace it with:

```tsx
  function computeDefaultFolder(): GroupSelection {
    const label = breadcrumbExtra?.label?.trim().toLowerCase();
    if (label) {
      const match = (sentenceFolders ?? []).find(
        (f) => displayString(f.name, language, DEFAULT_LOCALE).trim().toLowerCase() === label
      );
      if (match) return { kind: 'folder', id: match._id };
    }
    return DRAFTS_SELECTION;
  }
```

Leave `handleSaveOpen` alone — it already calls `setSaveSelection(computeDefaultFolder())`, which still type-checks.

- [ ] **Step 4: Resolve the selection before creating the sentence**

In `handleSaveConfirm`, this line:

```tsx
      const folderId = saveSelection === 'ungrouped' ? undefined : saveSelection;
```

becomes:

```tsx
      // Resolve BEFORE the sentence create: if this makes a folder and then
      // throws, nothing is written. See useResolveGroupSelection.
      const folderId = await resolveGroup(saveSelection);
```

Leave the `createProfileSentence({ …, ...(folderId ? { folderId } : {}) })` call below it unchanged.

- [ ] **Step 5: Swap the hand-rolled list for the picker**

The dialog body currently renders the folder buttons and the Ungrouped button inside:

```tsx
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
```

Replace that entire `<div>` — from `<div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">` through its closing `</div>`, including the `.map()` over `sentenceFolders` and the `saveUngrouped` button — with:

```tsx
          <GroupPicker tree="sentences" value={saveSelection} onChange={setSaveSelection} />
```

`sentenceFolders` stays in the file — `computeDefaultFolder` still uses it.

- [ ] **Step 6: Gate Save on a ready selection**

The Save button's disabled prop currently reads:

```tsx
              disabled={!saveSelection || isSaving}
```

Replace it with:

```tsx
              disabled={!isGroupSelectionReady(saveSelection) || isSaving}
```

`saveSelection` is never null now, so the old truthiness check would always pass and let an unnamed new group through.

- [ ] **Step 7: Delete the orphaned copy key**

`talker.saveUngrouped` no longer has a reader — `GroupPicker` uses `groupPicker.drafts`. Remove the `"saveUngrouped"` line from the `talker` object in `messages/en.json`, then confirm:

```bash
grep -rn "saveUngrouped" app/ messages/ ; node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"
```

Expected: no `saveUngrouped` matches, then `ok`.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "PersistentTalker|GroupPicker|useResolveGroupSelection"
```

Expected: **no output**.

- [ ] **Step 9: Lint**

```bash
npx eslint app/components/app/shared/sections/PersistentTalker.tsx
```

Expected: no errors. If `Id` or `displayString` became unused, remove those imports; if they are still used elsewhere in the file, leave them.

- [ ] **Step 10: Browser check**

In signed-in Chrome on **http://localhost:3000**, on a talker-capable page (e.g. `/en/categories`) with the Talker toggle on:

1. Build a short sentence by tapping symbols, then press the save (disk) button. The dialog shows your sentence groups, **Drafts**, and **+ New group**.
2. **Smart default preserved:** open a category whose name matches a sentence group, build a sentence, save — that group is preselected.
3. **New group:** tap "+ New group", type a name, Save. Then go to `/en/sentences` — the group exists with your sentence inside it.
4. **Blank name:** tap "+ New group", leave it empty — Save is disabled.
5. **Drafts still works:** save another sentence with Drafts selected — it lands in the Drafts tile.

Delete the test sentences and the test group afterwards.

- [ ] **Step 11: Commit**

```bash
git add app/components/app/shared/sections/PersistentTalker.tsx messages/en.json
git commit -F- <<'MSG'
feat(talker): create a group while saving a sentence

The save dialog's hand-rolled folder list becomes the shared GroupPicker, so
a block sentence can go straight into a new group instead of being stranded
in Drafts and filed later. The ADR-014 smart default is preserved.

Save now gates on isGroupSelectionReady — the old truthiness check would have
let an unnamed new group through.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 5: Name the create modals' options

Both create modals gain an opt-in picker, which would make a third positional argument on callbacks that already take two. Collapse the extras into a named options object first, as its own reviewable change, so the wiring in Task 6 is a one-line addition rather than a signature change tangled with behaviour.

After this task both modals read `onCreate(name, opts)`. **No behaviour changes** — the picker prop exists but no caller passes it yet.

**Files:**
- Modify: `app/components/app/lists/modals/CreateListModal.tsx`
- Modify: `app/components/app/sentences/modals/CreateSentenceModal.tsx`
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx` (`handleCreate` ~line 444)
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (`handleCreate` ~line 944)
- Modify: `app/components/app/home/sections/HomeContent.tsx` (`handleCreateList` ~line 75, `handleCreateSentence` ~line 111)

**Interfaces:**
- Consumes: `GroupPicker`, `GroupSelection`, `DRAFTS_SELECTION`, `isGroupSelectionReady` (Task 2).
- Produces:
  - `CreateListModal` props: `onCreate: (name: string, opts: { rows: SymbolRow[]; group?: GroupSelection }) => Promise<void>` and `showGroupPicker?: boolean`.
  - `CreateSentenceModal` props: `onCreate: (name: string, opts: { autoMatch: boolean; group?: GroupSelection }) => Promise<void>` and `showGroupPicker?: boolean`.

  Task 6 passes `showGroupPicker` and reads `opts.group`.

---

- [ ] **Step 1: Retype and wire CreateListModal**

In `app/components/app/lists/modals/CreateListModal.tsx`, replace the `Props` type:

```tsx
type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, rows: Array<{ label: string; autoMatch: boolean }>) => Promise<void>;
};
```

with:

```tsx
type Props = {
  isOpen: boolean;
  onClose: () => void;
  // Options are named rather than positional: this callback already carried the
  // rows, and the group would have made a third argument whose order a caller
  // has to remember. CreateSentenceModal takes the same shape.
  onCreate: (name: string, opts: { rows: SymbolRow[]; group?: GroupSelection }) => Promise<void>;
  // Ask where the list should go. Off by default: the Lists page opens this
  // modal from inside a group, where the folder is already implied.
  showGroupPicker?: boolean;
};
```

Add the import:

```tsx
import { GroupPicker, DRAFTS_SELECTION, isGroupSelectionReady, type GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';
```

Change the signature line to destructure the new prop:

```tsx
export function CreateListModal({ isOpen, onClose, onCreate, showGroupPicker = false }: Props) {
```

Add group state beside the existing state, and reset it:

```tsx
  const [group, setGroup] = useState<GroupSelection>(DRAFTS_SELECTION);
```

In `reset()`, add `setGroup(DRAFTS_SELECTION);` alongside the existing lines.

In `handleSubmit`, change:

```tsx
      await onCreate(trimmed, rows);
```

to:

```tsx
      await onCreate(trimmed, { rows, ...(showGroupPicker ? { group } : {}) });
```

Render the picker directly above the `{/* Footer */}` comment:

```tsx
          {showGroupPicker && (
            <GroupPicker tree="lists" value={group} onChange={setGroup} />
          )}
```

And gate the submit button — change:

```tsx
              disabled={!name.trim() || isCreating}
```

to:

```tsx
              disabled={!name.trim() || isCreating || (showGroupPicker && !isGroupSelectionReady(group))}
```

- [ ] **Step 2: Retype and wire CreateSentenceModal**

In `app/components/app/sentences/modals/CreateSentenceModal.tsx`, change the `onCreate` line in `Props` from:

```tsx
  onCreate: (name: string, autoMatch: boolean) => Promise<void>;
```

to:

```tsx
  // Options are named rather than positional: autoMatch arrived in phase-24 and
  // the group would have made a third argument whose order a caller has to
  // remember. CreateListModal takes the same shape.
  onCreate: (name: string, opts: { autoMatch: boolean; group?: GroupSelection }) => Promise<void>;
  // Ask where the sentence should go. Off by default: the Sentences page opens
  // this from inside a group, and the talker's Create Phrase files into
  // board.phrasesFolderId.
  showGroupPicker?: boolean;
```

Add the same import:

```tsx
import { GroupPicker, DRAFTS_SELECTION, isGroupSelectionReady, type GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';
```

Add `showGroupPicker = false` to the destructured props, add the state:

```tsx
  const [group, setGroup] = useState<GroupSelection>(DRAFTS_SELECTION);
```

add `setGroup(DRAFTS_SELECTION);` to `reset()`, and change the submit call from:

```tsx
      await onCreate(trimmed, autoMatch);
```

to:

```tsx
      await onCreate(trimmed, { autoMatch, ...(showGroupPicker ? { group } : {}) });
```

Render the picker directly above the footer's `<div className="grid grid-cols-2 gap-3">`:

```tsx
          {showGroupPicker && (
            <GroupPicker tree="sentences" value={group} onChange={setGroup} />
          )}
```

And gate the submit — change:

```tsx
              disabled={!name.trim() || isCreating}
```

to:

```tsx
              disabled={!name.trim() || isCreating || (showGroupPicker && !isGroupSelectionReady(group))}
```

- [ ] **Step 3: Update the four call sites**

Each handler's second parameter changes shape. **Behaviour is identical** — only how the values arrive.

`app/components/app/lists/sections/ListsModeContent.tsx`, `handleCreate`:

```tsx
  async function handleCreate(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
```

becomes:

```tsx
  async function handleCreate(name: string, { rows }: { rows: Array<{ label: string; autoMatch: boolean }> }) {
```

`app/components/app/home/sections/HomeContent.tsx`, `handleCreateList`:

```tsx
  async function handleCreateList(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
```

becomes:

```tsx
  async function handleCreateList(name: string, { rows }: { rows: Array<{ label: string; autoMatch: boolean }> }) {
```

`app/components/app/sentences/sections/SentencesModeContent.tsx`, `handleCreate`:

```tsx
  async function handleCreate(name: string, autoMatch: boolean) {
```

becomes:

```tsx
  async function handleCreate(name: string, { autoMatch }: { autoMatch: boolean }) {
```

`app/components/app/home/sections/HomeContent.tsx`, `handleCreateSentence`:

```tsx
  async function handleCreateSentence(name: string, autoMatch: boolean) {
```

becomes:

```tsx
  async function handleCreateSentence(name: string, { autoMatch }: { autoMatch: boolean }) {
```

Leave every body unchanged.

- [ ] **Step 4: Confirm Create Phrase needs no edit**

`app/components/app/shared/ui/TalkerDropdown.tsx` passes `handleCreatePhrase(name: string)` to `CreateSentenceModal`. A function declared with fewer parameters stays assignable to a wider signature in TypeScript, so it needs **no change**. Confirm:

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "TalkerDropdown"
```

Expected: **no output**. If this errors, stop and report rather than editing that file.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "CreateListModal|CreateSentenceModal|ListsModeContent|SentencesModeContent|HomeContent|TalkerDropdown"
```

Expected: **no output**.

- [ ] **Step 6: Lint**

```bash
npx eslint app/components/app/lists/modals/CreateListModal.tsx app/components/app/sentences/modals/CreateSentenceModal.tsx app/components/app/lists/sections/ListsModeContent.tsx app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/home/sections/HomeContent.tsx
```

Expected: clean except `SentencesModeContent.tsx`, where you should see **exactly the 2 pre-existing `react-hooks/refs` errors** and nothing else.

- [ ] **Step 7: Browser check — nothing changed yet**

No caller passes `showGroupPicker`, so every create flow must look and behave exactly as before. In signed-in Chrome on **http://localhost:3000**:

1. Lists page → open a group → Create list. No picker; the list lands in that group.
2. Sentences page → open a group → Create sentence, with auto-match ticked. No picker; the sentence lands in that group with its symbols filled.
3. Home → Create a list, and Home → Create a sentence. No picker; both still create (into Drafts, as today).
4. Talker dropbar → Create Phrase. No picker; the phrase is created as before.

Delete the test content afterwards.

- [ ] **Step 8: Commit**

```bash
git add app/components/app/lists/modals/CreateListModal.tsx app/components/app/sentences/modals/CreateSentenceModal.tsx app/components/app/lists/sections/ListsModeContent.tsx app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/home/sections/HomeContent.tsx
git commit -F- <<'MSG'
refactor(modals): name the create-modal options instead of stacking positionals

CreateSentenceModal.onCreate already took autoMatch from phase-24; adding the
group would have made three positionals in a fixed order. Both create modals
now take (name, opts) and gain an opt-in group picker, off by default so the
Lists page, Sentences page and Create Phrase are untouched.

No behaviour change — nothing passes showGroupPicker yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 6: Home asks where things go

The payoff for the path you hit: Home's create-a-list card stops silently stranding lists.

**Files:**
- Modify: `app/components/app/home/sections/HomeContent.tsx` (imports; `handleCreateList` ~line 75; `handleCreateSentence` ~line 111; the two modal usages ~159-169)

**Interfaces:**
- Consumes: `useResolveGroupSelection` (Task 3); `showGroupPicker` and `opts.group` on both modals (Task 5).
- Produces: nothing — this is the last task.

---

- [ ] **Step 1: Add the imports and resolvers**

In `app/components/app/home/sections/HomeContent.tsx`, add to the import block:

```tsx
import { useResolveGroupSelection } from '@/app/lib/folders/useResolveGroupSelection';
import type { GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';
```

Add both resolvers next to the other hooks, near the `createSentence` mutation:

```tsx
  // MOS-13 — Home's quick-create cards used to file nothing, stranding every
  // list and sentence in Drafts. One resolver per tree.
  const resolveListGroup = useResolveGroupSelection('lists');
  const resolveSentenceGroup = useResolveGroupSelection('sentences');
```

- [ ] **Step 2: File the new list**

`handleCreateList` currently starts:

```tsx
  async function handleCreateList(name: string, { rows }: { rows: Array<{ label: string; autoMatch: boolean }> }) {
    // Key the name under the ACTIVE board language, not a hardcoded `en` — else
    // non-English lists are mislabelled "Made in EN" (variant state is derived
    // from which language keys the record holds). Mirrors createSentence below.
    const id = await createList({ name: { [language]: name }, authoredLanguage: language });
```

Replace those lines with:

```tsx
  async function handleCreateList(
    name: string,
    { rows, group }: { rows: Array<{ label: string; autoMatch: boolean }>; group?: GroupSelection },
  ) {
    // Resolve BEFORE the list create: if this makes a folder and then throws,
    // nothing is written. See useResolveGroupSelection.
    const folderId = group ? await resolveListGroup(group) : undefined;
    // Key the name under the ACTIVE board language, not a hardcoded `en` — else
    // non-English lists are mislabelled "Made in EN" (variant state is derived
    // from which language keys the record holds). Mirrors createSentence below.
    const id = await createList({
      name: { [language]: name },
      authoredLanguage: language,
      ...(folderId ? { folderId } : {}),
    });
```

Leave the rest of the function unchanged.

- [ ] **Step 3: File the new sentence**

`handleCreateSentence` currently reads:

```tsx
  async function handleCreateSentence(name: string, { autoMatch }: { autoMatch: boolean }) {
```

Replace that signature with:

```tsx
  async function handleCreateSentence(
    name: string,
    { autoMatch, group }: { autoMatch: boolean; group?: GroupSelection },
  ) {
    // Resolve BEFORE the sentence create — see useResolveGroupSelection.
    const folderId = group ? await resolveSentenceGroup(group) : undefined;
```

Then in the `createSentence({ … })` call inside that function, add the folder to the existing spread list so it reads:

```tsx
    await createSentence({
      name: { [language]: name },
      authoredLanguage: language,
      ...(slots ? { slots } : {}),
      ...(folderId ? { folderId } : {}),
    });
```

Leave the rest of the function, including the `buildSentenceSlots` call and the `router.push`, unchanged.

- [ ] **Step 4: Turn the picker on for both cards**

The two modal usages become:

```tsx
      <CreateListModal
        isOpen={listOpen}
        onClose={() => setListOpen(false)}
        onCreate={handleCreateList}
        showGroupPicker
      />
      <CreateSentenceModal
        isOpen={sentenceOpen}
        onClose={() => setSentenceOpen(false)}
        onCreate={handleCreateSentence}
        showAutoMatch
        showGroupPicker
      />
```

Leave the `CreateCategoryModal` above them alone — categories are flat and have no groups.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "HomeContent|GroupPicker|useResolveGroupSelection"
```

Expected: **no output**.

- [ ] **Step 6: Lint**

```bash
npx eslint app/components/app/home/sections/HomeContent.tsx
```

Expected: no errors.

- [ ] **Step 7: Browser verification**

In signed-in Chrome on **http://localhost:3000**, starting from Home. Delete each item you create.

| Do this | Expected |
|---|---|
| Home → Create a list → pick an existing group → Create | The list appears in that group on `/en/lists`, **not** in Drafts |
| Home → Create a list → "+ New group", type a name → Create | The group exists on `/en/lists` with the list inside it |
| Home → Create a list → leave it on Drafts → Create | Lands in Drafts, as before |
| Home → Create a list → "+ New group" with an empty name | Create is disabled |
| Home → Create a sentence → "+ New group", tick auto-match → Create | New group on `/en/sentences`, sentence inside it, symbols filled |
| Reopen either Home modal after creating | Selection is back on Drafts |

**Regression — the three callers that must stay untouched:**

| Do this | Expected |
|---|---|
| Lists page → open a group → Create list | No picker; lands in that group |
| Sentences page → open a group → Create sentence | No picker; lands in that group |
| Talker dropbar → Create Phrase | No picker; phrase created as before |

- [ ] **Step 8: Commit**

```bash
git add app/components/app/home/sections/HomeContent.tsx
git commit -F- <<'MSG'
feat(home): ask where quick-created lists and sentences go

Home's cards never passed a folder, so everything made there was stranded in
Drafts with no way to say otherwise at the time. Both cards now show the
shared group picker, including creating a group on the spot.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Done criteria

- The bucket reads **Drafts** with a pencil-on-paper cover on both the Sentences and Lists group pages, is still not editable, and `/…/folder/ungrouped` still resolves.
- Saving a sentence from the talker can file it into an existing group, a brand-new group, or Drafts.
- Home's create-a-list and create-a-sentence cards offer the same choice.
- Creating from inside a group on the Lists or Sentences page shows no picker and still files into that group; Create Phrase is unchanged.
- Submit is disabled whenever "+ New group" is selected with a blank name.
- `npx tsc --noEmit -p tsconfig.json` reports nothing beyond the 4 known pre-existing errors.

## Follow-ups (explicitly out of scope)

- Hiding Drafts from student boards, or any other behaviour behind the name.
- Renaming the `ungrouped` URL sentinel.
- A group picker on the Lists/Sentences page create modals (the folder is implied by context).
- Uniqueness validation on group names.
- Rolling back a created folder when the content create then fails (spec §4: the empty group is kept deliberately).
