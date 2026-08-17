# Drafts bucket + a shared group picker — design

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-17
**Context:** MOS-13 (Phase 4 · rebuild defaults for marketing). Surfaced while authoring the first
default sentence module: a block sentence saved from the talker landed in a tile called "Ungrouped"
that looked like a broken folder.
**Touches:** ADR-014 (group folders + the `ungrouped` sentinel), ADR-015 (talker save)

---

## 1. Problem

Two related complaints, one cause.

**The bucket looks like a bug.** Saving a block sentence from the talker and taking the default
option files it nowhere, which surfaces a grey tile called **Ungrouped** on the Sentences page. It
can't be renamed, recoloured or deleted, and it doesn't exist in Convex — so it reads as broken
content rather than a deliberate place. It is in fact *synthetic*: `GroupsView` renders it when
`ungroupedCount > 0`, over items whose `folderId` is unset. The same tile appears on Lists, reached
via Home's create-a-list card, which never passes a folder.

**There is nowhere to put a new thing.** The talker's Save dialog lists existing folders and
"Ungrouped" — you cannot create a group at the moment you need one. Home's create-a-list and
create-a-sentence cards don't ask at all; they always strand the item.

## 2. Decision

**Give the bucket a real identity, and ask "where does this go?" everywhere something is created.**

### 2.1 The bucket becomes "Drafts"

Label and cover only — **no behaviour change**. It stays visible on student boards and its contents
stay fully usable, exactly as today. "Drafts" here means *not filed yet*, not *not live*; the
codebase has no draft concept and this does not add one.

| | |
|---|---|
| Copy | `sentences.ungrouped`, `lists.ungrouped`, `talker.saveUngrouped` → **"Drafts"** |
| Cover | `symbols/write.png` — pencil on a lined sheet — replacing the lucide `ImageIcon` placeholder |
| Colour | Unchanged: `UNGROUPED_COLOUR` `#6B7280`. The one cue that this tile isn't a recolourable folder |
| Editability | Unchanged: no rename, colour, delete or drag; renders only when `ungroupedCount > 0` |
| URL sentinel | **Unchanged** — `/…/folder/ungrouped` stays. It is an internal key; renaming it breaks existing links and forces route changes for no visible benefit |

**Both trees.** Sentences and Lists share `GroupsView`, and Home can strand either kind, so both get
it. An instructor learns the idea once.

The rename is nearly free: `GroupsView` is the only file needing a code edit, for the image. Every
other display site — both breadcrumbs, both move-to-group dialogs, `ListDetailContent`'s back link —
already reads `t('ungrouped')` and follows from the copy change alone.

`symbols/write.png` is chosen partly for its key: a clean canonical name rather than a numeric
SymbolStix id, so it is stable to reference from code.

### 2.2 One shared group picker

Three surfaces will ask the same question, so it is built once:
`app/components/app/shared/ui/GroupPicker.tsx`. It renders the tree's folders, a **Drafts** row, and
**+ New group** with an inline name input.

**It reports; it does not write:**

```ts
export type GroupSelection =
  | { kind: 'folder'; id: Id<'profileFolders'> }
  | { kind: 'drafts' }
  | { kind: 'new'; name: string };
```

A companion hook `useResolveGroupSelection(tree)` turns a selection into `folderId | undefined`,
creating the folder when `kind === 'new'`.

This split is deliberate. Folder creation and content creation must happen in a fixed order —
**folder first, then the content** — so a failed folder create leaves nothing behind. Putting that in
one hook gives all three hosts one implementation of the ordering and its failure handling, rather
than three chances to get it subtly different. It is the same "component reports what the user did,
host decides what it means" split used for the sentence-slot editor.

A group created this way is an ordinary folder: the same `createProfileFolder` mutation
`CreateGroupModal` calls, taking only a name. Colour and cover are set afterwards in edit mode, as
for any group.

### 2.3 Three hosts

| Host | Tree | Default selection |
|---|---|---|
| Talker "Save to sentences" (`PersistentTalker`) | `sentences` | Existing smart default (ADR-014 §7): the sentence folder whose name matches the current category, else Drafts |
| Home "Create a list" (`CreateListModal`) | `lists` | Drafts |
| Home "Create a sentence" (`CreateSentenceModal`) | `sentences` | Drafts |

The talker dialog replaces its hand-rolled folder list with the picker.

The two modals gain it behind an **opt-in prop, off by default**, because each has other callers that
must not change:

- `CreateListModal` — the Lists page, where the folder is implied by the group you are standing in.
- `CreateSentenceModal` — the Sentences page, same reason, **and** the talker's "Create Phrase",
  which files into `board.phrasesFolderId`.

Lists gets no talker entry point: nothing saves a list from the talker.

### 2.4 Not in scope

Changing what Home's cards do when the picker is left on Drafts (they still strand, deliberately —
"sort it later" stays a valid choice), and any student-visibility change for Drafts.

## 3. Code shape

**New**
- `app/components/app/shared/ui/GroupPicker.tsx` — presentational; takes `tree`, `value`,
  `onChange`, and the folder list; owns the inline new-group input's local state.
- `app/lib/folders/useResolveGroupSelection.ts` — `(tree) => (sel: GroupSelection) => Promise<Id<'profileFolders'> | undefined>`.

**Changed**
- `app/components/app/shared/sections/GroupsView.tsx` — synthetic tile renders
  `/api/assets?key=symbols/write.png` instead of the `ImageIcon` placeholder.
- `app/components/app/shared/sections/PersistentTalker.tsx` — dialog uses `GroupPicker`;
  `saveSelection` becomes a `GroupSelection`; confirm resolves it before `createProfileSentence`.
- `app/components/app/lists/modals/CreateListModal.tsx` — opt-in `showGroupPicker`; `onCreate` gains
  the selection.
- `app/components/app/sentences/modals/CreateSentenceModal.tsx` — same. Note this callback already
  gained an `autoMatch` argument in phase-24, so a third positional arg would make it
  `onCreate(name, autoMatch, group)` — three positionals a caller has to get in the right order.
  Collapse the extras instead: `onCreate(name: string, opts: { autoMatch: boolean; group?: GroupSelection })`.
  `CreateListModal` takes the same shape (it already passes rows separately), so the two modals stay
  symmetrical and each new option is named at the call site rather than counted.
- `app/components/app/home/sections/HomeContent.tsx` — passes `showGroupPicker`, resolves the
  selection, and files the new list/sentence into the result.
- `messages/en.json` — `saveNewGroup`, `saveNewGroupPlaceholder`, and the three "Drafts" values.
  **`en.json` only** (CLAUDE.md rule 1).

**Unchanged**: the `ungrouped` sentinel, both folder routes, `createProfileFolder`,
`createProfileList`, `createProfileSentence`. No schema change — this is all selection plumbing over
mutations that already accept an optional `folderId`.

## 4. Edge cases

| Case | Behaviour |
|---|---|
| No folders exist yet in the tree | Picker shows Drafts + "+ New group" only |
| "+ New group" selected, name blank/whitespace | Save disabled |
| "+ New group" name duplicates an existing folder | Allowed — `createProfileFolder` has no uniqueness rule today, and folders are renameable |
| Folder create succeeds, content create fails | Empty group remains; the user sees it and can delete or reuse it. Preferred over an orphaned item with no home |
| Folder create fails | Nothing written, dialog stays open |
| Picker left on Drafts | `folderId` omitted — today's behaviour |
| Modal reopened | Selection resets to the host's default |
| Last item leaves Drafts | Tile stops rendering (`ungroupedCount > 0`) |

## 5. Verification

No test runner (see the phase-24 spec §6; phase-17 forbids adding one). Gate is
`npx tsc --noEmit -p tsconfig.json` grep-filtered to touched files — the baseline carries 4
pre-existing unrelated errors — plus `npx eslint`, then signed-in Chrome on `:3000`.

**Drafts identity**
- Sentences and Lists group views both show **Drafts** with the pencil-on-paper cover.
- Open it: breadcrumb reads Drafts, contents unchanged, `/…/folder/ungrouped` still resolves.
- Move the last item out → the tile disappears.

**Picker**
- Talker → Save: existing smart default still preselects the matching folder when inside a category.
- Talker → Save → "+ New group", type a name, Save → the group exists on the Sentences page with the
  sentence in it.
- Home → Create a list → pick an existing group → the list lands there, not in Drafts.
- Home → Create a sentence → "+ New group" → same.
- Save stays disabled with an empty new-group name.

**Regression — the three callers that must not change**
- Lists page → Create list *inside a group*: no picker, still files into that group.
- Sentences page → Create sentence *inside a group*: no picker, still files into that group.
- Talker dropbar → Create Phrase: no picker, still files into `board.phrasesFolderId`.

## 6. Out of scope

- Making Drafts instructor-only or otherwise hiding it from student boards.
- Renaming the `ungrouped` URL sentinel.
- A folder picker on the Lists/Sentences page create modals (folder is implied by context).
- Uniqueness validation on group names.
