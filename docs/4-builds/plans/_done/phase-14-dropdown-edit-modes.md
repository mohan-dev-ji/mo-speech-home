# Phase 14 — Dropdown Edit Modes — Execution Plan

**Status:** Ready to run (fresh session) · **Date:** 2026-06-30 · **Branch:** `claude/practical-hofstadter-c6b656` (worktree)

> Self-contained plan. Make the talker dropdown's **core-word categories** and **phrase banks** instructor-authorable *in place*, reusing the existing category-edit and sentence-edit flows — no bespoke editors. Architecture: [ADR-015](../../decisions/ADR-015-composition-primitive-and-phrase-tree.md). Feature context: [FEAT-004-sentence-builder-talker.md → "Dropdown edit modes"](../../features/FEAT-004-sentence-builder-talker.md).

---

## Environment / rules (read first)

- **Worktree:** `/Users/mohanveraitch/Projects/mo-speech-home/.claude/worktrees/practical-hofstadter-c6b656`. Work here.
- **Never run `npx convex dev`** in the worktree (spawns an anonymous backend + rewrites `.env.local`). Verify Convex with `tsc -p convex/tsconfig.json`. The user runs `pnpm`/`convex deploy` themselves. Dev deployment: `dev:wandering-marmot-955`. Dev server runs on **:3000** (the user's — the preview MCP won't attach; use `curl` for compile checks, the user clicks through authed flows).
- **i18n:** add UI keys to **`messages/en.json` only** (never hand-add to other locales).
- **A pre-existing `lib/stripe.ts` TS error** (Stripe API-version pin) is unrelated — filter it out of tsc checks.
- **Figma** (Dev Mode MCP must be connected): file `3DAZYuK3A1TrkeZnyGwE1o`; Talker component `3222:4983`; variants **`core-word-edit` = 3237:2733**, **`Phrases-edit` = 3236:655**.

## What already exists (do NOT rebuild)

Phase 14 Slices 0–5 are shipped (commits through `c78b62c`). In place:

- **Schema:** `profileCategories.surface?: "core"`, `libraryModules.surface?: "core"`, `profileFolders.tree` += `"phrases"`, new **`profilePhrases`** table, `profileSentences` gains `kind`/`units[]`/`playback` (additive; `slots[]` is still the rendered source).
- **Backend (all built):**
  - `convex/profilePhrases.ts` — `getProfilePhrases`, `getPhraseBanks`, `createProfilePhrase({name, folderId?, words?})`, `updateProfilePhraseName`, `updateProfilePhraseWords({words})`, `updateProfilePhraseAudio({recordedAudioPath?, audioPath?})`, `deleteProfilePhrase`, `reorderProfilePhrases`, `installDefaultBanksAndCore` (auth-gated backfill).
  - `convex/profileCategories.ts` — `getCoreWordCategories` (surface:"core" only), `getProfileCategories` (excludes core), `getProfileSymbolsWithImages`.
  - `convex/migrations.ts` — `seedCoreWordModules`, `seedLibraryModulesFromJSON`, `backfillSentenceUnits`.
  - `convex/lib/contentModuleInstall.ts` — install propagates `surface` to the installed category.
- **Dropdown** (`app/components/app/shared/ui/TalkerDropdown.tsx`): consolidated **"Core words"** tab (zinc `CoreTile`s → drill-in via `getProfileSymbolsWithImages`/`getSymbolsByWords`) + **phrase-bank** tabs (`PhraseDropdownCard`). Slide-down animation. A **"Load defaults"** button when the core tab is empty (calls `installDefaultBanksAndCore`). Uses `NavTabButton` (to be swapped, step 1).
- **Talker bar** (`TalkerBar.tsx` / `TalkerContext.tsx` / `Header.tsx` / `PersistentTalker.tsx`): phrase-units (additive `kind`/`phraseName`/`words`), zinc `PhraseBox`, dnd-kit reorder + X-remove, staggered sequence play.

## Step 0 — Pre-flight (get live content to edit against)

The user deploys + seeds, then loads defaults into their account:
```bash
npx convex deploy
npx convex run migrations:seedCoreWordModules '{"adminClerkUserId":"<clerk id>"}'   # if not already seeded
```
Then in-app (signed in, Categories/Search page): open dropdown → **Core words** → **"Load default core words & phrases"**. Now the account has live `surface:"core"` categories + phrase banks to edit.

## Locate-first (the reuse-map agent didn't deliver — start with a focused read)

Confirm these before coding (grep/read only):
1. **Category board editable grid + add-symbol placeholder** — the component that renders editable symbol tiles + the "add symbol" placeholder and opens `SymbolEditorModal` in `categoryBoard` mode. Candidates: `app/components/app/categories/ui/SymbolCardEditable.tsx` + the category board/detail section. Get its props.
2. **`GroupTile`** (`app/components/app/shared/ui/GroupTile.tsx`) — editable folder card (dashed name via `onRename`, `onDeleteRequest`, `useSortable` reorder, `ColourSwatchPicker`, `onPublishRequest`). This is the model for the **core-word-edit** card (minus the swatch).
3. **Sentence edit** (`app/components/app/sentences/sections/SentencesModeContent.tsx`) — `SlotStrip` (~247) + `SortableSlot` (~195): chips with X-delete + add-slot placeholder + dnd reorder; the **Edit-Sentence modal** (text + Generate audio + Record + Save); the **move-to-folder** icon button in the sentence row. Get the modal component + props + the move-to-folder handler.
4. **Create modals** — the **New category** modal (name + "Type a word" inputs + "Add more symbols"; find its file + mutation + how words→symbols) and **`CreateSentenceModal`** (`app/components/app/sentences/modals/CreateSentenceModal.tsx`).
5. **`SymbolEditorModal`** (`app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx`) — `editorMode` values (`categoryBoard`/`sentenceSlot`/…) + entry props + save-result callbacks.
6. **Tabs** — `app/components/app/settings/ui/{Tab,TabBar}.tsx` (replace `NavTabButton`).
7. **Mutations to confirm exist** (add if missing): `updateProfileCategoryName`, `deleteProfileCategory`, category reorder, and whether `createProfileCategory` can stamp `surface:"core"` (likely needs a `surface?` arg or a `createCoreCategory`). profileSymbol CRUD lives in `convex/profileSymbols.ts`.

## Implementation sequence

**Step 1 — Tabs + edit/create chrome** (smallest, safe first increment)
- In `TalkerDropdown`, swap `NavTabButton` → Settings `TabBar`/`Tab`.
- Add `editing` state. Render an **Edit/Done** toggle + a context **Create** button under the tab bar: "Create Group" on the `core` tab, "Create Phrase" on a `bank-*` tab (Figma `core-word-edit` / `Phrases-edit`).

**Step 2 — Core-word edit** (≈ category edit)
- `editing && activeTab==='core' && coreSel===null`: render core tiles as editable cards (reuse `GroupTile` pattern or extend `CoreTile`): dashed editable name → `updateProfileCategoryName`; delete → `deleteProfileCategory`; reorder → category reorder; **no swatch** (zinc-locked).
- `editing` drill-in (`coreSel.kind==='category'`): render the category's symbols as an **editable board** reusing the category board's editable grid + **add-symbol placeholder** → `SymbolEditorModal` `categoryBoard` mode (image + audio). Saves a `profileSymbol`.

**Step 3 — Create Group**
- "Create Group" → the **New-category modal**, adjusted to stamp `surface:"core"`. On create: make the core category (+ optional placeholder symbols from the typed words) and open it in edit mode (`coreSel`) with placeholders; each placeholder click opens the symbol editor.

**Step 4 — Phrase edit** (≈ sentence edit, **stacked** layout)
- `editing && bank tab`: render each phrase card as a `SlotStrip`-style editor in the stacked zinc box (symbol chips over text, per Figma):
  - word chips each with **×** (delete) + an **add-symbol placeholder (+)** → `SymbolEditorModal` (sentenceSlot-like, no word-level audio) → `updateProfilePhraseWords`.
  - editable **name** (dashed) → `updateProfilePhraseName`.
  - **"Audio ready / tap to generate"** → the **Edit-Sentence modal** (text + Generate TTS / Record) → `updateProfilePhraseAudio`.
  - below the card: **delete** (`deleteProfilePhrase`) + **move-to-bank** (reuse the sentence move-to-folder button) + reorder (`reorderProfilePhrases`).

**Step 5 — Create Phrase**
- "Create Phrase" → `CreateSentenceModal` (type name) → `createProfilePhrase({name, folderId: <current bank>})` → empty phrase card opens in edit mode → add symbols + audio.

**Step 6 — Re-point talker Save (the deferred Slice 6)**
- Now content is real: wire `Header.onSave` → write a `kind:"sentence"`, `playback:"sequence"` composition from the bar's `units[]` (retaining phrase decomposition + unit clips) into a **chosen sentence folder** (folder picker, smart default per ADR-014 §7). No whole-sentence TTS for talker saves.

## Verification

- `tsc -p convex/tsconfig.json` clean; `npx tsc --noEmit` clean (ignore `lib/stripe.ts`); user runs `pnpm lint`/`build`.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/categories` → 307 (compiles, no 500).
- User clicks through (authed): Core words → **Edit** → rename/delete/reorder a group; open a group → add a symbol via the editor (image+audio). **Create Group** → name+words → placeholders → bind symbols. A bank → **Edit** → edit a phrase's symbols/name, generate/record audio, delete/move. **Create Phrase** → builds a new phrase. Then the **Save** round-trip into a chosen sentence folder.
- Confirm core stays zinc / no swatch; core categories never appear on the main Categories board.

## Commit cadence

Commit per step with `Phase 14 (edit modes): <step>` and push (upstream is set: plain `git push`). End commit messages with the `Co-Authored-By: Claude Opus 4.8` trailer.
