# Phase 18 — Separate image / text / audio for list items (+ `imageOnly` editor mode)

**Status:** SHIPPED (tsc-verified; live eyeball pending) · **Owner:** Mo · **Started:** 2026-08-10

> **Done 2026-08-10:** step 1 (AudioAuthorModal move/rename), Change 1 (create-list
> auto-match), A–C (imageOnly editor + list-item image-only), D (per-row audio via
> AudioAuthorModal with `literal` TTS). Note: `listItem` editor mode was NOT removed
> — it's still used by SentencesModeContent (sentence units). Recording restored:
> list rows have an Audio control that generates literal TTS or records.

## Problem

- The list-item symbol editor writes the picked symbol's word into the item's
  `description`, so browsing symbols changes the item's text (bug).
- Audio, label, and image are entangled in one editor. We want the symbol editor
  to be **just an image picker**, with text authored on the row and audio handled
  separately — mirroring the sentences flow (one image ↔ one text per item).

## Model (agreed)

A list item = **image** (image-only picker) + **text** (`description`, typed on the
row) + **audio** (its own row control → `SentenceAudioModal` → generate TTS from
the text *or* record). The symbol editor never touches text or audio again.

## Decisions (locked)

- **New `editorMode: 'imageOnly'`** — promoted from today's `folderImageMode`
  boolean. No properties panel, **no preview play button** (straight picker).
  Used for: **group/category cover images** and **list items**.
- **Sentences & phrases keep `sentenceSlot`** (they retain the Display panel —
  show label/image, colours, card shape). NOT consolidated. (Owner decision
  2026-08-10.)
- Recording is kept, moved to a per-row audio control (not the editor).

## Steps

### A. `imageOnly` editor mode (shared)
1. `SymbolEditorModal.tsx`: add `'imageOnly'` to the `editorMode` union; treat it
   as the replacement for `folderImageMode`. Save returns `{ imagePath,
   imageSourceType }` via a single `onImageOnlySave` callback.
2. `SymbolPreview`: add a `showPlay` prop (default true); pass `false` when
   `imageOnly` → remove the preview play button.
3. `PropertiesPanel.tsx`: add `'imageOnly'` to its `editorMode` type; the panel is
   not rendered for `imageOnly` (already gated by the old `!folderImageMode`).
4. Remove/retire `folderImageMode` boolean; keep a thin back-compat only if a
   caller is missed (goal: none).

### B. Group / category cover images → `imageOnly`
5. `GroupsView.tsx` + `CategoriesContent.tsx`: switch `folderImageMode` →
   `editorMode="imageOnly"`; adapt `onFolderImageSave(path)` →
   `onImageOnlySave({ imagePath }) `.

### C. List items → `imageOnly` (image-only)
6. `ListDetailContent.tsx`: open the editor with `editorMode="imageOnly"`;
   `handleListItemSaved` updates **only** `imagePath` (+ `imageSourceType`) —
   never `description`/audio. Fixes the text-changing bug.

### D. Per-row audio control (the sentences flow)
7. `ListDetailEdit.tsx`: add an **Audio** `IconButton` to each row's `EditPanel`
   (ready/not-ready state), calling `onAudioRequest(index)`.
8. `ListDetailContent.tsx`: render `SentenceAudioModal` for the targeted item —
   `initialValue = item.description`; `saveOverride` stores `recordedAudioPath` on
   the item; "generate" warms the TTS cache.
9. **TTS cache-key alignment (critical):** list playback uses
   `playTts(description, voiceId, { literal: true })`. The audio modal's generate
   must use the **same literal flag + voice** so a generated clip matches at play
   time. Add a `literal`/generate-mode option to the modal path if needed.
10. `convex/profileLists.ts`: ensure the list save/update accepts per-item
    `recordedAudioPath` (already persisted via the old editor path — reuse).

### E. Create-list auto-match + (i)
11. `CreateListModal.tsx`: swap manual steps for the shared `SymbolListFields`
    (paste + auto-match + (i) tip + Add more).
12. `SymbolListFields.tsx`: parametrise its copy (label/placeholder/tip) so the
    list modal reads "Steps / Type a step…" instead of "Symbols / Type a word".
13. `ListsModeContent.tsx` + `convex/profileLists.ts` `createProfileList`:
    accept rows `{ description, autoMatch }`; for auto-match rows resolve the top
    `searchSymbols` hit's `imagePath` onto the item; description stays the typed
    step. `createProfileList` gains an additive per-item `imagePath`.

## Verification
- tsc (app + convex) after each phase; eslint on touched files.
- Live (when the Chrome extension reconnects): image-only editor has no play
  button / no properties; picking symbols no longer changes item text; row audio
  control generates + records and plays back; create-list auto-match fills images.

## Risk / notes
- Shared `SymbolEditorModal` — scope every change to `imageOnly` so
  categoryBoard/sentenceSlot are untouched.
- No visual verification available at authoring time (extension down) — tsc is the
  safety net; do a live pass before calling it done.
