# Phase 25 — Slot labels as an authoring seed (+ fluent fork-on-edit)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening a fluent sentence slot pre-fills the SymbolStix search box with that slot's word, so authoring a sentence never means retyping a word you already typed.

**Architecture:** Fluent slots gain a localised `label`, written by auto-match and by the slot editor, read only to seed the search box — **never rendered**. The three dead accordions (Display / Text / Shape) come out of the slot editor, since they write a `displayProps` field no sentence renderer reads. And because a slot save now writes a board-language-keyed label, the three fluent slot writers gain the fork-on-edit that `persistUnits` already has — otherwise editing on a Hindi board would write `label.hi` into the English source row.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4

**Spec:** `docs/superpowers/specs/2026-08-16-slot-label-authoring-seed-design.md`
**Builds on:** phase-24 (`docs/4-builds/plans/phase-24-sentence-auto-match-plan.md`)
**Relevant ADRs:** ADR-015 (`slots[]` vs `units[]`), ADR-016 (per-language variants)

## Global Constraints

- **No test runner exists in this repo, and you must not add one.** Per-task gate is `npx tsc --noEmit -p tsconfig.json` filtered to the touched files, `npx eslint <files>`, then browser verification.
- **`tsc` has 4 pre-existing unrelated errors** — three stale `.next/types/validator.ts` module-not-found entries and one `lib/stripe.ts` API-version mismatch. Never expect a clean exit; always grep for the files you touched and expect **no output**.
- **`app/components/app/sentences/sections/SentencesModeContent.tsx` has 2 pre-existing `react-hooks/refs` eslint errors** (around line 902, in the drag-order reconciliation block). They are not yours. When linting that file, expect exactly those two and nothing else.
- **Dev server is already running on http://localhost:3000.** Do **not** run `npm run dev`.
- **Never run `npx convex dev`.** Verify Convex-facing types with `npx tsc -p convex/tsconfig.json`.
- **Browser verification uses signed-in Chrome** (the `claude-in-chrome` tools), not the in-app browser — the app requires a Clerk session.
- **The label is never rendered.** No task adds it to `ThumbnailStrip`, `SortableSlot`, or any other renderer. Sentence display must look byte-identical before and after this plan.
- **UI copy:** never hard-code strings. Every key goes in **`messages/en.json` only** — never hand-add to `hi.json`/`es.json`. (This plan should need no new keys.)
- **Theme tokens only:** no hard-coded colours, radii, spacing, or font sizes.
- **Work on `main`.** Do not create a branch.
- Commit after each task.

---

### Task 1: The `label` field — schema and mutations

Backend only. Adds an optional field; no behaviour changes and nothing writes it yet.

**Files:**
- Modify: `convex/schema.ts:759-765` (the `profileSentences.slots` object)
- Modify: `convex/profileSentences.ts:134-142` (`createProfileSentence.slots` arg)
- Modify: `convex/profileSentences.ts:257-263` (`updateProfileSentenceSlots.slots` arg)

**Interfaces:**
- Consumes: `localisedString` — already defined at `convex/schema.ts:31` as `v.record(v.string(), v.string())`.
- Produces: an optional `label` on every sentence slot, accepted by both mutations. Tasks 2 and 5 write it; Task 5 reads it.

---

- [ ] **Step 1: Add the field to the stored shape**

In `convex/schema.ts`, the `profileSentences.slots` array currently reads:

```ts
    slots: v.array(
      v.object({
        order: v.number(),
        imagePath: v.optional(v.string()),
        displayProps: v.optional(slotDisplayProps),
      })
    ),
```

Replace it with:

```ts
    slots: v.array(
      v.object({
        order: v.number(),
        imagePath: v.optional(v.string()),
        displayProps: v.optional(slotDisplayProps),
        // AUTHORING ONLY — never rendered. Seeds the slot editor's SymbolStix
        // search box so changing a tile doesn't mean retyping the word, and so
        // a blank tile still knows which word it was for. Localised so the seed
        // follows the board language (a Hindi variant seeds Hindi words rather
        // than stranding English ones). Do NOT wire this into ThumbnailStrip or
        // SortableSlot — sentence display is deliberately image-only.
        label: v.optional(localisedString),
      })
    ),
```

- [ ] **Step 2: Accept it on create**

In `convex/profileSentences.ts`, `createProfileSentence`'s `slots` arg currently reads:

```ts
    slots:    v.optional(
      v.array(
        v.object({
          order:        v.number(),
          imagePath:    v.optional(v.string()),
          displayProps: displayPropsSchema,
        })
      )
    ),
```

Replace it with:

```ts
    slots:    v.optional(
      v.array(
        v.object({
          order:        v.number(),
          imagePath:    v.optional(v.string()),
          displayProps: displayPropsSchema,
          // Authoring-only seed for the slot editor's symbol search — never
          // rendered. See convex/schema.ts profileSentences.slots.
          label:        v.optional(v.record(v.string(), v.string())),
        })
      )
    ),
```

- [ ] **Step 3: Accept it on update**

In the same file, `updateProfileSentenceSlots`'s `slots` arg currently reads:

```ts
    slots: v.array(
      v.object({
        order:        v.number(),
        imagePath:    v.optional(v.string()),
        displayProps: displayPropsSchema,
      })
    ),
```

Replace it with:

```ts
    slots: v.array(
      v.object({
        order:        v.number(),
        imagePath:    v.optional(v.string()),
        displayProps: displayPropsSchema,
        // Authoring-only seed for the slot editor's symbol search — never
        // rendered. See convex/schema.ts profileSentences.slots.
        label:        v.optional(v.record(v.string(), v.string())),
      })
    ),
```

Leave `flattenUnitsToSlots` alone. It mirrors sequence sentences, which are edited through the unit editor and never through the slot editor.

- [ ] **Step 4: Type-check Convex**

```bash
npx tsc -p convex/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 5: Type-check the app**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "schema|profileSentences"
```

Expected: **no output**. (The 4 known pre-existing errors are filtered out — see Global Constraints.)

- [ ] **Step 6: Lint**

```bash
npx eslint convex/schema.ts convex/profileSentences.ts
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add convex/schema.ts convex/profileSentences.ts
git commit -m "feat(sentences): optional authoring label on fluent slots

Stored to seed the slot editor's symbol search — never rendered. Localised
so the seed follows the board language instead of stranding one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Auto-match writes the label

The pure builder stamps each slot with the word it came from — including the words that matched nothing, which is the case that matters most, since a blank tile has no artwork to remind you what it was for.

**Files:**
- Modify: `lib/sentences/autoMatchSlots.ts`

**Interfaces:**
- Consumes: `SearchHit` from `@/lib/symbols/autoMatchDeps`, which already carries `words: Record<string, string>` alongside `imagePath`.
- Produces: `SlotSpec` gains `label?: Record<string, string>`. Task 5 relies on the same shape when merging on save.

---

- [ ] **Step 1: Widen `SlotSpec`**

In `lib/sentences/autoMatchSlots.ts`, replace the `SlotSpec` type:

```ts
export type SlotSpec = {
  order: number;
  imagePath?: string;
};
```

with:

```ts
export type SlotSpec = {
  order: number;
  imagePath?: string;
  // AUTHORING ONLY — never rendered. Seeds the slot editor's symbol search.
  // Carries the matched symbol's full multi-language words with the typed word
  // winning for the board language, so the seed follows the board — the same
  // shape `buildCreateSymbols` stores for category symbols.
  label?: Record<string, string>;
};
```

- [ ] **Step 2: Stamp the word in `buildSentenceSlots`**

In the same file, the mapper inside `buildSentenceSlots` currently reads:

```ts
      try {
        const hit = await deps.search(word, language);
        return hit ? { order, imagePath: hit.imagePath } : { order };
      } catch {
        return { order };
      }
```

Replace it with:

```ts
      // Every slot is stamped with its word, matched or not: a blank tile has no
      // artwork to say what it was for, so the seed is worth MORE there.
      const typed = { [language]: word };
      try {
        const hit = await deps.search(word, language);
        return hit
          ? { order, imagePath: hit.imagePath, label: { ...hit.words, ...typed } }
          : { order, label: typed };
      } catch {
        return { order, label: typed };
      }
```

`{ ...hit.words, ...typed }` puts the typed word in the board-language slot while keeping the symbol's other languages — spreading `typed` last is what makes the typed word win.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "autoMatchSlots"
```

Expected: **no output**.

- [ ] **Step 4: Lint**

```bash
npx eslint lib/sentences/autoMatchSlots.ts
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/sentences/autoMatchSlots.ts
git commit -m "feat(sentences): stamp auto-matched slots with their source word

Matched slots carry the symbol's full word set with the typed word winning
for the board language; unmatched slots carry the typed word alone — the
blank tile is exactly where knowing the word helps most.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Strip the dead panels out of the slot editor

Display, Text and Shape write `displayProps`, which **no sentence renderer reads** — `ThumbnailStrip` and `SortableSlot` both draw image-only and ignore it entirely. Three panels of controls that have never done anything.

Once they're gone, `PropertiesPanel` renders **nothing** in `sentenceSlot` mode (Label/Description and Audio are already hidden for it, and the remaining sections are `categoryBoard`-only), so the panel is also gated out at the modal to avoid an empty bordered container.

**`editorMode="sentenceSlot"` has THREE consumers, not one.** Besides sentence slots, the talker's
phrase-word editor and the inline phrase editor both open this mode and both write
`result.displayProps` into `profilePhrases.words[].displayProps`. Checked with grep: no composition
renderer (`CompositionBlock.tsx`, `UnitCardShell.tsx`, `PhraseBuilderBody.tsx`) touches `display`,
`SymbolCard`, `bgColour`, `cardShape` or `showLabel` — phrase-word tiles render image-only exactly
like sentence slots. Every `displayProps` occurrence in `app/` is a *writer*; there are no readers.

So the panels are dead in all three, and all three are cleaned. Owner decision, 2026-08-16.

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx:623, 698, 730`
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` (`SentenceSlotSaveResult` type ~line 42; the `sentenceSlot` save branch ~line 624; the `PropertiesPanel` render ~line 976)
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (`handleSlotSave` ~line 1080)
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx:476, 478` (`handlePhraseWordSave`)
- Modify: `app/components/app/sentences/sections/InlinePhraseEditor.tsx:85, 87` (phrase word save)

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces: `SentenceSlotSaveResult` becomes `{ imagePath?: string; searchWord?: string; symbolWords?: Record<string, string> }` — `displayProps` is gone. Task 5 reads `searchWord` and `symbolWords`.

---

- [ ] **Step 1: Make the three sections categoryBoard-only**

In `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx` there are three section guards to change. Each currently reads:

```tsx
      {(editorMode === 'categoryBoard' || editorMode === 'sentenceSlot') && (
```

They are at the **Display** section (~line 623), the **Text size** section (~line 698), and the **Shape** section (~line 730). Change all three to:

```tsx
      {editorMode === 'categoryBoard' && (
```

Also update each section's leading comment so it no longer claims sentenceSlot support:
- `{/* ── Display (categoryBoard + sentenceSlot) ─── */}` → `{/* ── Display (categoryBoard) ─── */}`
- `{/* ── Text size (categoryBoard + sentenceSlot) ─── */}` → `{/* ── Text size (categoryBoard) ─── */}`
- `{/* ── Shape (categoryBoard + sentenceSlot) ─── */}` → `{/* ── Shape (categoryBoard) ─── */}`

Leave every other section untouched.

- [ ] **Step 2: Gate the whole panel out of sentenceSlot mode**

In `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx`, the panel currently renders as:

```tsx
          {/* Properties — hidden in image-only mode */}
          {!imageOnly && (
            <PropertiesPanel
```

Change the comment and the guard to:

```tsx
          {/* Properties — hidden in image-only mode, and in sentenceSlot mode,
              where every section is now categoryBoard-only (Display/Text/Shape
              wrote displayProps, which no sentence renderer reads). Without this
              guard the panel would render as an empty bordered container. */}
          {!imageOnly && editorMode !== 'sentenceSlot' && (
            <PropertiesPanel
```

Leave the panel's props unchanged.

- [ ] **Step 3: Reshape the save result type**

In the same file, `SentenceSlotSaveResult` currently reads:

```ts
export type SentenceSlotSaveResult = {
  imagePath?: string;
  displayProps?: {
    bgColour?: string;
    textColour?: string;
    textSize?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showImage?: boolean;
    cardShape?: 'square' | 'rounded' | 'circle';
  };
};
```

Replace it with:

```ts
export type SentenceSlotSaveResult = {
  imagePath?: string;
  // What was in the SymbolStix search box at save time. The box seeds FROM the
  // slot's stored label, so an untouched box reports the same word back — which
  // is what makes the slot's word change only when the user types a new search,
  // never merely because they clicked a different symbol.
  searchWord?: string;
  // Canonical words of the currently-picked SymbolStix symbol, keyed by ISO
  // code. Empty for Upload / Image Search / AI Generate, which have no word set.
  symbolWords?: Record<string, string>;
  // NOTE: no displayProps. Sentence slots never rendered it — see the editor's
  // Display/Text/Shape sections, which are categoryBoard-only.
};
```

- [ ] **Step 4: Return the new fields from the sentenceSlot save branch**

In the same file, the `sentenceSlot` save branch currently calls:

```ts
        const ts = draft.textSize;
        onSentenceSlotSave?.({
          imagePath,
          displayProps: {
            bgColour:   draft.bgColour,
            textColour: draft.textColour,
            textSize:   (ts === 'xl' ? 'lg' : ts) as 'sm' | 'md' | 'lg',
            showLabel:  draft.showLabel,
            showImage:  draft.showImage,
            cardShape:  draft.shape,
          },
        });
```

Replace that whole call with:

```ts
        onSentenceSlotSave?.({
          imagePath,
          searchWord: searchQuery.trim() || undefined,
          symbolWords: draft.symbolWords,
        });
```

Delete the now-unused `const ts = draft.textSize;` line directly above it. Leave the rest of the branch (the `imagePath` resolution above, and the `onClose()` / `catch` / `finally` below) exactly as it is.

- [ ] **Step 5: Stop the sentences page reading `displayProps` off the save result**

In `app/components/app/sentences/sections/SentencesModeContent.tsx`, `handleSlotSave` currently contains:

```tsx
    const current = [...sentence.slots];
    if (slotEditTarget.slotIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, displayProps: result.displayProps });
    } else {
      current[slotEditTarget.slotIndex] = {
        ...current[slotEditTarget.slotIndex],
        imagePath:    result.imagePath,
        displayProps: result.displayProps,
      };
    }
```

Replace that block with:

```tsx
    // displayProps is no longer authored for slots — the editor's Display/Text/
    // Shape sections are categoryBoard-only now. Values already stored on
    // existing slots are preserved by the spread, just never updated.
    const current = [...sentence.slots];
    if (slotEditTarget.slotIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath });
    } else {
      current[slotEditTarget.slotIndex] = {
        ...current[slotEditTarget.slotIndex],
        imagePath: result.imagePath,
      };
    }
```

Leave `handleRemoveSlot` and `handleReorderSlots` alone — they pass stored `displayProps` straight through, which is exactly the preservation described above.

- [ ] **Step 5b: Stop the talker's phrase-word editor reading it**

In `app/components/app/shared/ui/TalkerDropdown.tsx`, `handlePhraseWordSave` currently contains:

```tsx
    if (wordIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
    } else if (current[wordIndex]) {
      current[wordIndex] = { ...current[wordIndex], imagePath: result.imagePath, displayProps: result.displayProps };
    }
```

Replace it with:

```tsx
    // displayProps is no longer authored — the editor's Display/Text/Shape
    // sections are categoryBoard-only now. No composition renderer ever read it
    // for phrase words; existing stored values are preserved by the spread.
    if (wordIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, audioPath: undefined, label: undefined });
    } else if (current[wordIndex]) {
      current[wordIndex] = { ...current[wordIndex], imagePath: result.imagePath };
    }
```

Change nothing else in that file.

- [ ] **Step 5c: Stop the inline phrase editor reading it**

In `app/components/app/sentences/sections/InlinePhraseEditor.tsx`, lines 85 and 87 currently read:

```tsx
      words.push({ order: words.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
```
```tsx
      words[wordEditor.index] = { ...words[wordEditor.index], imagePath: result.imagePath, displayProps: result.displayProps };
```

Replace them with:

```tsx
      words.push({ order: words.length, imagePath: result.imagePath, audioPath: undefined, label: undefined });
```
```tsx
      words[wordEditor.index] = { ...words[wordEditor.index], imagePath: result.imagePath };
```

Add this comment above the `if` that contains them:

```tsx
    // displayProps is no longer authored — see TalkerDropdown.handlePhraseWordSave.
```

Change nothing else in that file.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SymbolEditorModal|PropertiesPanel|SentencesModeContent|TalkerDropdown|InlinePhraseEditor"
```

Expected: **no output**. All three `sentenceSlot` consumers are in the grep — a leftover `result.displayProps` anywhere is exactly what this catches.

- [ ] **Step 7: Lint**

```bash
npx eslint app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/shared/ui/TalkerDropdown.tsx app/components/app/sentences/sections/InlinePhraseEditor.tsx
```

Expected: clean on all but `SentencesModeContent.tsx`, where you should see **exactly the 2 pre-existing `react-hooks/refs` errors** and nothing else (see Global Constraints).

- [ ] **Step 8: Browser check**

In signed-in Chrome on **http://localhost:3000**:

1. Sentences page → Edit → tap a slot tile. Expected: the editor shows the image-source tabs, the search box and the preview — and **no** Display / Text / Shape sections. Save still works and the tile keeps its image.
2. Talker dropbar → a phrase → edit a phrase word tile. Expected: same editor, also without the three sections; picking a symbol and saving still swaps the tile's image.
3. Categories page → tap a symbol to edit it. Expected: Display, Text size and Shape are all **still there** — they're categoryBoard-only, not deleted.
4. A list item editor (Lists page → Edit → tap an item). Expected: unchanged.

- [ ] **Step 9: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/shared/ui/TalkerDropdown.tsx app/components/app/sentences/sections/InlinePhraseEditor.tsx
git commit -m "refactor(symbol-editor): drop the dead Display/Text/Shape panels from sentenceSlot mode

They wrote displayProps, which nothing reads — sentence slots and phrase
words both render image-only, and no composition renderer touches it. Three
panels of controls that never did anything, in all three callers of this
mode: sentence slots, talker phrase words, and the inline phrase editor.

The save result now reports the search word and the picked symbol's words
instead, which the label wiring needs next.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Fork-on-edit for the three fluent slot writers

`handleSlotSave`, `handleRemoveSlot` and `handleReorderSlots` all call `updateSlots` directly on whichever row is displayed. `persistUnits` does not — it creates or reuses the board-language variant and writes to *that*, so a source is never mutated from another board.

So today, on a Hindi board showing an English source as a fallback, reordering or editing a slot edits **the English sentence**. Talker-saved sentences are safe; fluent ones are not. Task 5 would make this worse by writing a board-language-keyed label into the source, so the fork lands first.

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (`handleRemoveSlot` ~1057, `handleReorderSlots` ~1066, `handleSlotSave` ~1080, `persistUnits` ~1096)

**Interfaces:**
- Consumes: `createVariant` (`api.profileSentences.createSentenceVariant`) and `language`, both already in scope in this component.
- Produces: `resolveWriteTarget(sentenceId: Id<'profileSentences'>): Promise<Id<'profileSentences'>>`. Task 5's `handleSlotSave` calls it.

---

- [ ] **Step 1: Extract the fork helper**

In `app/components/app/sentences/sections/SentencesModeContent.tsx`, `persistUnits` currently reads:

```tsx
  async function persistUnits(sentenceId: Id<'profileSentences'>, units: CompositionUnitClient[]) {
    const row = sentences?.find((s) => s._id === sentenceId);
    // Fork-on-edit: editing a fallback (source/other-language) row on this board
    // creates/reuses the board-language variant (idempotent) and writes to IT, so
    // the source is never mutated from another board.
    const targetId =
      row && (row.authoredLanguage ?? DEFAULT_LOCALE) !== language
        ? await createVariant({ sourceSentenceId: row._id, authoredLanguage: language })
        : sentenceId;
    const reindexed = units.map((u, i) => ({ ...u, order: i }));
    await updateUnits({ profileSentenceId: targetId, units: reindexed });
  }
```

Replace it with the helper plus a slimmed `persistUnits`:

```tsx
  // ADR-016 fork-on-edit: editing a fallback (source / other-language) row on
  // this board creates or reuses the board-language variant (idempotent) and
  // returns ITS id, so the source is never mutated from another board. The
  // variant is seeded from the source's slots and units, so the caller's
  // snapshot of the row is still the right thing to write.
  //
  // Shared by the unit path and all three slot writers. The slot writers used
  // to skip this entirely and edit the displayed row directly — which meant a
  // reorder on a Hindi board silently rewrote the English sentence.
  async function resolveWriteTarget(
    sentenceId: Id<'profileSentences'>,
  ): Promise<Id<'profileSentences'>> {
    const row = sentences?.find((s) => s._id === sentenceId);
    return row && (row.authoredLanguage ?? DEFAULT_LOCALE) !== language
      ? await createVariant({ sourceSentenceId: row._id, authoredLanguage: language })
      : sentenceId;
  }

  async function persistUnits(sentenceId: Id<'profileSentences'>, units: CompositionUnitClient[]) {
    const targetId = await resolveWriteTarget(sentenceId);
    const reindexed = units.map((u, i) => ({ ...u, order: i }));
    await updateUnits({ profileSentenceId: targetId, units: reindexed });
  }
```

Place `resolveWriteTarget` **above** `handleRemoveSlot` (~line 1057) so all four callers sit below it.

- [ ] **Step 2: Fork on remove**

`handleRemoveSlot` currently reads:

```tsx
  function handleRemoveSlot(sentenceId: Id<'profileSentences'>, slotIndex: number) {
    const sentence = sentences?.find((s) => s._id === sentenceId);
    if (!sentence) return;
    const updated = sentence.slots
      .filter((_, i) => i !== slotIndex)
      .map((slot, i) => ({ ...slot, order: i }));
    updateSlots({ profileSentenceId: sentenceId, slots: updated });
  }
```

Replace it with:

```tsx
  async function handleRemoveSlot(sentenceId: Id<'profileSentences'>, slotIndex: number) {
    const sentence = sentences?.find((s) => s._id === sentenceId);
    if (!sentence) return;
    const updated = sentence.slots
      .filter((_, i) => i !== slotIndex)
      .map((slot, i) => ({ ...slot, order: i }));
    const targetId = await resolveWriteTarget(sentenceId);
    await updateSlots({ profileSentenceId: targetId, slots: updated });
  }
```

- [ ] **Step 3: Fork on reorder**

`handleReorderSlots` currently reads:

```tsx
  function handleReorderSlots(sentenceId: Id<'profileSentences'>, nextSlots: Slot[]) {
    // `nextSlots` already carries reindexed `order` values from SlotStrip.
    // Re-shape to the mutation arg type so optional displayProps default
    // to undefined when absent.
    const slotsArg = nextSlots.map((s, i) => ({
      order: i,
      imagePath: s.imagePath,
      displayProps: s.displayProps,
    }));
    updateSlots({
      profileSentenceId: sentenceId,
      slots: slotsArg,
    });
  }
```

Replace it with:

```tsx
  async function handleReorderSlots(sentenceId: Id<'profileSentences'>, nextSlots: Slot[]) {
    // `nextSlots` already carries reindexed `order` values from SlotStrip.
    // Re-shape to the mutation arg type so optional fields default to undefined
    // when absent. `label` rides along so a reorder never drops a slot's seed.
    const slotsArg = nextSlots.map((s, i) => ({
      order: i,
      imagePath: s.imagePath,
      displayProps: s.displayProps,
      label: s.label,
    }));
    const targetId = await resolveWriteTarget(sentenceId);
    await updateSlots({
      profileSentenceId: targetId,
      slots: slotsArg,
    });
  }
```

- [ ] **Step 4: Add `label` to the local `Slot` type**

The `label: s.label` you just wrote needs the local type to carry it. In the same file, the `Slot` type currently reads:

```tsx
type Slot = {
  order: number;
  imagePath?: string;
  displayProps?: {
    bgColour?: string;
    textColour?: string;
    textSize?: 'sm' | 'md' | 'lg' | 'xl';
    showLabel?: boolean;
    showImage?: boolean;
    cardShape?: 'square' | 'rounded' | 'circle';
  };
};
```

Add the field at the end of the object:

```tsx
type Slot = {
  order: number;
  imagePath?: string;
  displayProps?: {
    bgColour?: string;
    textColour?: string;
    textSize?: 'sm' | 'md' | 'lg' | 'xl';
    showLabel?: boolean;
    showImage?: boolean;
    cardShape?: 'square' | 'rounded' | 'circle';
  };
  // AUTHORING ONLY — never rendered. Seeds the slot editor's symbol search.
  label?: Record<string, string>;
};
```

- [ ] **Step 5: Fork on save**

`handleSlotSave` currently ends with:

```tsx
    const reindexed = current.map((s, i) => ({ ...s, order: i }));
    updateSlots({ profileSentenceId: slotEditTarget.sentenceId, slots: reindexed });
    setSlotEditTarget(null);
  }
```

Replace those lines with:

```tsx
    const reindexed = current.map((s, i) => ({ ...s, order: i }));
    const targetId = await resolveWriteTarget(slotEditTarget.sentenceId);
    await updateSlots({ profileSentenceId: targetId, slots: reindexed });
    setSlotEditTarget(null);
  }
```

and change the function's signature line from:

```tsx
  function handleSlotSave(result: SentenceSlotSaveResult) {
```

to:

```tsx
  async function handleSlotSave(result: SentenceSlotSaveResult) {
```

All three handlers are now async. That is fine for their call sites: TypeScript accepts a `() => Promise<void>` wherever a `() => void` is expected, so the `SlotStrip` prop types need no change.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SentencesModeContent"
```

Expected: **no output**.

- [ ] **Step 7: Lint**

```bash
npx eslint app/components/app/sentences/sections/SentencesModeContent.tsx
```

Expected: **exactly the 2 pre-existing `react-hooks/refs` errors** and nothing else.

- [ ] **Step 8: Browser check — the fork, all three writers**

This is the step with real blast radius. In signed-in Chrome on **http://localhost:3000**:

Setup: on an **English** board, create a sentence with at least 3 slots (auto-match makes this quick). Note its exact slot order.

Then switch the board to **Hindi** (Settings → language). The sentence should still appear, with a **Made in EN** badge in edit mode. For each of the three writers, starting from a fresh English-board sentence each time:

1. **Reorder** — drag a slot to a new position on the Hindi board. Then switch back to English. Expected: the **English sentence's slot order is unchanged**. Switch to Hindi again: the reordered version is there.
2. **Delete** — remove a slot on the Hindi board. Switch to English. Expected: the English sentence **still has all its slots**.
3. **Save** — tap a slot on the Hindi board, pick a different symbol, save. Switch to English. Expected: the English sentence's tile is **unchanged**.

Also confirm, on the Hindi board after any of the three: the badge still reads **Made in EN** and the translate control is still present. That is expected and deliberate — a manual fork copies the source's `text`/`name` with their English keys, so the row stays "untranslated" until you actually give it Hindi text (`convex/profileSentences.ts:205`).

Finally, the no-fork case: on an **English** board, edit a slot of an English sentence. Expected: **no** second copy of the sentence appears.

- [ ] **Step 9: Commit**

```bash
git add app/components/app/sentences/sections/SentencesModeContent.tsx
git commit -m "fix(sentences): fork-on-edit for the fluent slot writers (ADR-016)

handleSlotSave, handleRemoveSlot and handleReorderSlots wrote straight to
the displayed row, so reordering or editing a slot on a Hindi board silently
rewrote the English source. persistUnits already forked; the slot path never
did.

All four now share one resolveWriteTarget helper.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Seed the search box, and merge the label on save

The payoff. Opening a slot pre-fills the SymbolStix search box with that slot's word; saving records whatever is in the box.

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` (props ~line 66, destructure ~line 122, `searchQuery` init ~line 265)
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (`handleSlotSave`; the slot-editor seed values near `existingSlotImagePath` ~line 1215; the `<SymbolEditorModal>` slot usage ~line 1532)

**Interfaces:**
- Consumes: `SentenceSlotSaveResult.searchWord` / `.symbolWords` (Task 3), `resolveWriteTarget` (Task 4), `SlotSpec.label` shape (Task 2), the `label` mutation args (Task 1).
- Produces: nothing downstream — this is the last task.

---

- [ ] **Step 1: Add the seed prop**

In `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx`, find this line in `SymbolEditorModalProps`:

```ts
  initialLabel?: string;                          // pre-populate label / description field
```

Add directly below it:

```ts
  // Seed ONLY the SymbolStix search box, without touching the label field.
  // sentenceSlot mode has no label field (its panel is gated out), so it needs
  // a way to pre-fill the search that doesn't drag the label machinery in.
  initialSearchQuery?: string;
```

- [ ] **Step 2: Destructure it**

In the same file, the component destructures its props. Find:

```tsx
  initialLabel,
  onClose,
```

and change it to:

```tsx
  initialLabel,
  initialSearchQuery,
  onClose,
```

- [ ] **Step 3: Use it to seed the search box**

In the same file, find:

```tsx
  const [searchQuery, setSearchQuery] = useState(() => initialLabel ?? '');
```

Replace it with:

```tsx
  const [searchQuery, setSearchQuery] = useState(() => initialSearchQuery ?? initialLabel ?? '');
```

`initialSearchQuery` wins so a caller can seed the search independently of the label. Leave the `useEffect` below it (which clears the query when the modal closes) untouched.

- [ ] **Step 4: Merge the label on save**

In `app/components/app/sentences/sections/SentencesModeContent.tsx`, `handleSlotSave` currently begins:

```tsx
  async function handleSlotSave(result: SentenceSlotSaveResult) {
    if (!slotEditTarget) return;
    const sentence = sentences?.find((s) => s._id === slotEditTarget.sentenceId);
    if (!sentence) return;

```

Insert the label computation immediately after those lines, before the `const current = [...sentence.slots];` block:

```tsx
    // The slot's label is authoring-only (never rendered): it seeds this
    // editor's symbol search next time. The BOARD-language word is whatever is
    // in the search box — and because the box seeded FROM this label, it only
    // differs when the user typed a new search. Clicking a different symbol
    // therefore does NOT change their word.
    //
    // The other languages DO follow the picked symbol, so they stay true to the
    // tile. Upload / Image Search / AI Generate carry no word set, so there the
    // existing languages are kept.
    const prevLabel =
      slotEditTarget.slotIndex >= 0
        ? sentence.slots[slotEditTarget.slotIndex]?.label
        : undefined;
    const typedWord = result.searchWord?.trim();
    const labelBase =
      result.symbolWords && Object.keys(result.symbolWords).length > 0
        ? result.symbolWords
        : (prevLabel ?? {});
    let nextLabel: Record<string, string> | undefined;
    if (typedWord) {
      nextLabel = { ...labelBase, [language]: typedWord };
    } else {
      // Cleared box → drop just this language's seed, keep any others.
      const rest = { ...labelBase };
      delete rest[language];
      nextLabel = Object.keys(rest).length > 0 ? rest : undefined;
    }

```

- [ ] **Step 5: Write the label into the slot**

Immediately below that, the block you edited in Task 3 currently reads:

```tsx
    const current = [...sentence.slots];
    if (slotEditTarget.slotIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath });
    } else {
      current[slotEditTarget.slotIndex] = {
        ...current[slotEditTarget.slotIndex],
        imagePath: result.imagePath,
      };
    }
```

Replace it with:

```tsx
    const current = [...sentence.slots];
    if (slotEditTarget.slotIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, label: nextLabel });
    } else {
      current[slotEditTarget.slotIndex] = {
        ...current[slotEditTarget.slotIndex],
        imagePath: result.imagePath,
        label: nextLabel,
      };
    }
```

Assigning `label: nextLabel` unconditionally is deliberate — when `nextLabel` is `undefined` the field is dropped, which is what clearing the search box should do.

- [ ] **Step 6: Compute the seed value**

In the same file, find the existing slot-editor seed value:

```tsx
  const existingSlotImagePath =
    slotEditTarget && slotEditTarget.slotIndex >= 0
      ? slotEditorSentence?.slots[slotEditTarget.slotIndex]?.imagePath
      : undefined;
```

Add directly below it:

```tsx
  // Exact-language only — deliberately NOT displayString/displayValue, whose
  // 3-tier fallback (exact → en → first key) is right for display and wrong for
  // a search seed. With the fallback, clearing the box couldn't work (another
  // language's word resurfaced), and the next save would write that word back
  // under THIS language's key — an English string stored under `hi`, reseeding
  // forever. No entry for this board's language means no seed, which is the
  // honest answer: an English word typed into a Hindi board's search queries
  // the `search_text_hi` surface, which contains Hindi words and their
  // romanisations, never English — so it would just return nothing.
  const existingSlotSearch =
    slotEditTarget && slotEditTarget.slotIndex >= 0
      ? slotEditorSentence?.slots[slotEditTarget.slotIndex]?.label?.[language] || undefined
      : undefined;
```

`|| undefined` keeps an empty-string entry from seeding an empty-but-defined value. Do **not** reach
for `displayString` here even though it is already imported and used elsewhere in this file — see the
comment. (An earlier draft of this plan specified `displayString` and it was a defect; the review
caught it.)

- [ ] **Step 7: Pass it to the slot editor**

Find the slot editor usage (the one with `editorMode="sentenceSlot"`):

```tsx
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="sentenceSlot"
          initialImagePath={existingSlotImagePath}
          onClose={() => setSlotEditTarget(null)}
          onSave={() => {}}
          onSentenceSlotSave={handleSlotSave}
        />
```

Add the seed prop:

```tsx
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="sentenceSlot"
          initialImagePath={existingSlotImagePath}
          initialSearchQuery={existingSlotSearch}
          onClose={() => setSlotEditTarget(null)}
          onSave={() => {}}
          onSentenceSlotSave={handleSlotSave}
        />
```

Do **not** add it to the unit editor below it — that one seeds from `initialLabel` and already works.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SymbolEditorModal|SentencesModeContent"
```

Expected: **no output**.

- [ ] **Step 9: Lint**

```bash
npx eslint app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx app/components/app/sentences/sections/SentencesModeContent.tsx
```

Expected: clean on the modal; **exactly the 2 pre-existing `react-hooks/refs` errors** on `SentencesModeContent.tsx`.

- [ ] **Step 10: Browser verification**

In signed-in Chrome on **http://localhost:3000**, Sentences page. Delete each test sentence when you're done with it.

**Seeding**

| Do this | Expected |
|---|---|
| Auto-match `I want to go home`, Edit, tap the **`home`** tile | Search box already contains `home`, results showing |
| Auto-match `I want zzzqx now`, Edit, tap the **blank** tile | Search box already contains `zzzqx` — the blank tile knows its word |
| Open a sentence created **before** this change, tap a tile | Empty search box, as before — no label to seed from |
| Tap the **+** add-slot button | Empty search box |

**The typed-word rule**

| Do this | Expected |
|---|---|
| Tap a tile, pick a *different* symbol **without** retyping, save, reopen | Box still shows the **original** word — clicking a symbol does not change it |
| Tap a tile, type `outside`, pick a symbol, save, reopen | Box shows `outside` — the typed word, not the symbol's own name |
| Tap a tile, clear the box, save, reopen | Empty box |

**Regression — display must not change**

| Do this | Expected |
|---|---|
| Look at any sentence in **view** mode | Image-only tiles, exactly as before. **No words on tiles.** |
| Look at any sentence in **edit** mode | Image-only tiles, exactly as before. **No words on tiles.** |
| Open a talker-saved sentence's word block editor | Still pre-fills from the unit's label, unchanged |

- [ ] **Step 11: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx app/components/app/sentences/sections/SentencesModeContent.tsx
git commit -m "feat(sentences): pre-fill the slot editor's symbol search (MOS-13)

Opening a slot seeds the SymbolStix box with that slot's word, resolved for
the board language — so changing a tile no longer means retyping a word you
already typed, and a blank tile still tells you which word it was for.

Saving records whatever is in the box, so the word changes when you search,
not when you click a symbol. Never rendered: sentence display is unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done criteria

- Tapping an auto-matched slot opens the editor with that slot's word already in the SymbolStix search box — including on blank tiles.
- The slot's word changes when you type a new search, not when you click a different symbol.
- The slot editor has no Display / Text / Shape sections; the category and list editors still do.
- Editing, reordering or deleting a slot on a board whose language differs from the sentence's authored language leaves the source row untouched.
- Sentence strips render identically to before, in view and edit mode. No labels are visible anywhere.
- `npx tsc --noEmit -p tsconfig.json` reports nothing beyond the 4 known pre-existing errors.

## Follow-ups (explicitly out of scope)

- Rendering the label anywhere.
- Migrating or clearing the now-inert `displayProps` stored on existing slots.
- Auditing sentences already damaged by pre-fork foreign-board edits.
- Labels on `profileLists` items or phrase words.
- Fork-on-edit anywhere outside the fluent slot writers.
