# Block-Aware Play Modal & Unit-Based Sentences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) tracking. **Self-contained** — a fresh session can start cold from this doc.

**Goal:** Make the talker "Play sentence" experience — and talker-saved sentences — show the whole composition as **blocks** (single words + phrase-blocks), with a yellow glow stepping through each block as it plays, a Replay button, click-away close, and click-a-block-to-play. Talker-saved sentences render, play, and edit as blocks (phrases keep their form); Sentences-page ("fluent") sentences are untouched.

**Architecture:** One shared block renderer + one shared block play modal driven by ADR-015 `units[]` (word | phrase). The talker builds blocks from `talkerSymbols`; saved sentences build them from `units[]`. Sentences carry `playback` — `"sequence"` (talker-saved) gets the block treatment; `"fluent"`/legacy keeps the existing flat `slots[]` + whole-sentence-TTS path.

**Tech Stack:** Next 16 / React 19 / TypeScript / Tailwind CSS 4 / Convex 1.x. Audio via `new Audio('/api/assets?key=<rawKey>')` + `lib/audio/playTts.ts` (`playKey`, `playTts`).

## Context

The talker dropbar now composes single words and phrases as visually distinct blocks, which helps students see sentence structure. Today that structure is lost the moment you play or save: the talker `PlayModal` pops symbols up one at a time; saved sentences render a flat `slots[]` thumbnail strip and play whole-sentence TTS via `SentencePlayModal`; the sentence read query even drops `units`. This plan preserves the block structure end-to-end for talker-saved sentences. Execute on `main` (the `practical-hofstadter-c6b656` worktree has been merged, so all referenced code is on main).

## For a fresh session — read these first (grounds every task; no re-exploration needed)

Repo root on `main`: `/Users/mohanveraitch/Projects/mo-speech-home`. Design basis: [ADR-015](../../decisions/ADR-015-composition-primitive-and-phrase-tree.md) (composition primitive: a sentence/phrase is an ordered list of `units`, each a **word** or a **phrase** snapshot). Background: the 2-tab talker dropbar shipped; the talker bar composes word + phrase blocks.

**The two existing play modals (today):**
- `app/components/app/shared/modals/PlayModal.tsx` — talker's single-symbol pop-up (swaps one symbol at a time). Used only by `PersistentTalker` (grep to confirm); this plan replaces its role with the block modal.
- `app/components/app/sentences/modals/SentencePlayModal.tsx` — saved-sentence player: plays `recordedAudioPath` else whole-sentence `playTts(sentenceText)`; renders a flat `slots` thumbnail grid. **Keep it** for fluent/legacy sentences.

**Talker playback + block shapes:**
- `app/components/app/shared/sections/PersistentTalker.tsx` — `handlePlaySentence` (~97–122, the for-loop that swaps `PlayModal` per `talkerSymbols` item and awaits each `audioPath` `ended`), `handleChipTap` (~87–95), `PlayModalState` (~46–51), and `handleSaveConfirm` (~143–202, builds `units[]` + flat `slots[]` and calls `createProfileSentence({ kind:'sentence', playback:'sequence', units, slots })`). A phrase unit plays its own single `audioPath` (one block), not per-word.
- `app/contexts/TalkerContext.tsx` — `TalkerSymbolItem` (`kind?: 'word'|'phrase'`, `phraseName?`, `words?: {imagePath?,audioPath?,label}[]`). Word `imagePath` is a full `/api/assets?key=…` URL; phrase `words[].imagePath` are raw keys (hence `toAssetUrl`/`toAudioKey`).
- `app/components/app/shared/ui/TalkerBar.tsx` — `PhraseBox` (~198–244): the zinc phrase block (row of `w-24 h-24` thumbnails + a `ZINC.c700` name pill) — the **target look** for a phrase block. `const ZINC = getCategoryColour('zinc')` (`app/lib/categoryColours.ts`, `{c700,c500,c100}`).
- `app/components/app/shared/ui/SymbolCard.tsx` — word card (image + label).
- Audio helpers: `lib/audio/playTts.ts` — `playKey(rawKey)` (~26–30, sync, wraps `/api/assets?key=`), `playTts(text, voiceId)` (~37–57, returns r2Key). Glow reference: `ModellingOverlayWrapper.tsx` box-shadow (`0 0 0 3px …, 0 0 16px 4px …`); `globals.css` has `--theme-overlay` (`rgba(0,0,0,0.82)`) and z-`[200]` overlay convention.

**Saved sentences (the fluent-vs-sequence split):**
- `convex/schema.ts` — `profileSentences` (~734–782): has `slots[]` (flat, still the rendered source), `units?: compositionUnit[]`, `kind?: 'sentence'`, `playback?: 'sequence'|'fluent'`. `compositionUnit`/`compositionWord` validators (~265–293): word = `{kind:'word',order,imagePath?,audioPath?,label?,displayProps?}`; phrase = `{kind:'phrase',order,name,audioPath?,recordedAudioPath?,librarySourceId?,words:compositionWord[]}`.
- `convex/profileSentences.ts` — `getProfileSentences` (~54–89) **projects `slots` only — drops `units`/`kind`/`playback` (the Task 1 blocker)**; `createProfileSentence` already persists `units`/`slots`/`playback` (and has a local `compositionUnitSchema` to reuse in Task 6); `updateProfileSentenceSlots` (~112–137) is the mirror for the new `updateProfileSentenceUnits`.
- `app/components/app/sentences/sections/SentencesModeContent.tsx` — `SentenceRow` type (~92–108, `slots` only), `ThumbnailStrip` (~133–155, reads `slots`), `SlotStrip`/`SortableSlot` edit strip (~157–308, dnd-kit `horizontalListSortingStrategy`), the row `onPlay={(s)=>setPlayTarget(s)}` (~1066), and the `SentencePlayModal` render (~1221–1235). No separate sentence detail page — all inline.
- Phrase-card visual parity: `app/components/app/shared/ui/TalkerDropdown.tsx` `PhraseDropdownCard` (zinc box, `w-20 h-20` thumbs + name pill).

**Env / how to verify:** dev server runs on **:3000** (user's; preview MCP won't attach — use `curl` for compile checks + the user does authed click-throughs). Never run `npx convex dev` in a worktree; verify Convex with `npx tsc -p convex/tsconfig.json`. Ignore the pre-existing `lib/stripe.ts` Stripe-version TS error. User runs `npx convex deploy` + `pnpm lint/build`.

## Global Constraints

- **AAC theme tokens only** — no hard-coded colours/spacing/radii in AAC UI (`app/globals.css` `:root` + `@theme inline`). One new token allowed: `--theme-play-glow`.
- **i18n:** new UI copy → `messages/en.json` **only** (never hand-add other locales).
- **No `npx convex dev`** in the worktree. Verify Convex with `npx tsc -p convex/tsconfig.json`. User runs `npx convex deploy` + `pnpm`.
- **No JS component test runner exists.** Per-task verification = `npx tsc --noEmit` clean (ignore the pre-existing `lib/stripe.ts` Stripe-version error) + `npx tsc -p convex/tsconfig.json` clean + `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/<route>` → 307 (compiles) + the authed manual click-through in **Verification**. Do not invent a test framework.
- **Commit per task**, message `Play blocks: <task>`, then `git push`.

## Shared client shapes (used across tasks)

```ts
// A resolved-for-render/play composition block. imageUrl is ready for <img src>;
// audioKey is a RAW R2 key for playKey(). Helpers below normalise the two
// storage conventions (talker word imagePaths are full /api/assets URLs; unit +
// phrase-word imagePaths are raw keys).
export type PlayWord   = { kind: 'word';   label: string; imageUrl?: string; audioKey?: string };
export type PlayPhrase = { kind: 'phrase'; name: string;  imageUrl?: string; audioKey?: string;
                           words: { label: string; imageUrl?: string }[] };
export type PlayBlock  = PlayWord | PlayPhrase;

export function toAssetUrl(p?: string): string | undefined {
  if (!p) return undefined;
  return p.startsWith('/api/assets') ? p : `/api/assets?key=${p}`;
}
export function toAudioKey(p?: string): string | undefined {
  if (!p) return undefined;
  const prefix = '/api/assets?key=';
  return p.startsWith(prefix) ? p.slice(prefix.length) : p;
}
```
Put these in a new `app/components/app/shared/ui/composition/blocks.ts` (Task 2).

---

### Task 1: Expose `units`/`kind`/`playback` on sentence reads

**Files:**
- Modify: `convex/profileSentences.ts` (`getProfileSentences`, the `.map(...)` projection ~lines 71–83)

**Interfaces — Produces:** `getProfileSentences` rows now include `units?: CompositionUnit[]`, `kind?: 'sentence'`, `playback?: 'sequence' | 'fluent'`.

- [ ] **Step 1:** In the projection add `units: s.units`, `kind: s.kind`, `playback: s.playback` alongside `slots`. Leave `slots` in place (fluent + fallback still use it).
- [ ] **Step 2:** `npx tsc -p convex/tsconfig.json` → clean (ignore stripe). Confirm no other consumer of `getProfileSentences` breaks (grep `getProfileSentences`).
- [ ] **Step 3:** Commit `Play blocks: expose units/kind/playback on getProfileSentences`.

---

### Task 2: Yellow glow token + shared `CompositionBlock` renderer

**Files:**
- Modify: `app/globals.css` (`:root`, add token)
- Create: `app/components/app/shared/ui/composition/blocks.ts` (types + helpers above + mappers)
- Create: `app/components/app/shared/ui/composition/CompositionBlock.tsx`

**Interfaces — Produces:**
- `blocks.ts`: `PlayWord/PlayPhrase/PlayBlock`, `toAssetUrl`, `toAudioKey`, plus:
  - `blocksFromTalker(items: TalkerSymbolItem[]): PlayBlock[]`
  - `blocksFromUnits(units: CompositionUnitClient[], language: string): PlayBlock[]` (resolves localised labels via `displayString`; `CompositionUnitClient` = the `units` element type from `getProfileSentences`)
- `CompositionBlock.tsx`: `function CompositionBlock({ block, active, onTap }: { block: PlayBlock; active?: boolean; onTap?: () => void })`

**Approach:** The phrase visual is the zinc box already in `TalkerBar.tsx` `PhraseBox` (thumbnails row + name pill, `const ZINC = getCategoryColour('zinc')` from `app/lib/categoryColours.ts`). The word visual is a card: image over label. `active` wraps the block in the yellow glow.

- [ ] **Step 1:** `app/globals.css` `:root` — add `--theme-play-glow: #FACC15;` (amber-400). No `@theme inline` mapping needed (used via CSS var in inline `boxShadow`).
- [ ] **Step 2:** Create `blocks.ts` with the types/helpers above and the two mappers. `blocksFromTalker`: word → `{ kind:'word', label: item.label, imageUrl: toAssetUrl(item.imagePath), audioKey: toAudioKey(item.audioPath) }`; phrase → `{ kind:'phrase', name: item.phraseName ?? item.label, audioKey: toAudioKey(item.audioPath), words: (item.words??[]).map(w => ({ label: w.label, imageUrl: toAssetUrl(w.imagePath) })) }`. `blocksFromUnits`: same shape, resolving `displayString(u.label|u.name, language, DEFAULT_LOCALE)` and `toAssetUrl(u.imagePath)`, `toAudioKey(u.audioPath)`; phrase audio prefers `recordedAudioPath ?? audioPath`.
- [ ] **Step 3:** Create `CompositionBlock.tsx`.

```tsx
"use client";
import { getCategoryColour } from '@/app/lib/categoryColours';
import type { PlayBlock } from './blocks';

const ZINC = getCategoryColour('zinc');
const GLOW = '0 0 0 3px var(--theme-play-glow), 0 0 20px 6px var(--theme-play-glow)';

export function CompositionBlock({ block, active, onTap }: { block: PlayBlock; active?: boolean; onTap?: () => void }) {
  const glow = active ? { boxShadow: GLOW } : undefined;
  if (block.kind === 'word') {
    return (
      <button type="button" onClick={onTap} aria-label={block.label}
        className="flex flex-col items-center gap-1 rounded-theme p-2 transition-shadow"
        style={{ background: 'var(--theme-symbol-card-bg)', ...glow }}>
        <div className="w-24 h-24 flex items-center justify-center">
          {block.imageUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={block.imageUrl} alt={block.label} className="w-full h-full object-contain" draggable={false} />
            : <div className="w-3/4 aspect-square rounded-lg bg-black/10" />}
        </div>
        <span className="text-caption font-medium" style={{ color: 'var(--theme-symbol-card-text)' }}>{block.label}</span>
      </button>
    );
  }
  // phrase — zinc box (mirror TalkerBar PhraseBox), name pill underneath
  return (
    <button type="button" onClick={onTap} aria-label={block.name}
      className="flex flex-col items-center gap-2 rounded-theme p-3 transition-shadow"
      style={{ background: ZINC.c500, ...glow }}>
      <div className="flex items-end gap-2">
        {(block.words.length ? block.words : [{ label: '', imageUrl: undefined }]).map((w, i) => (
          <div key={i} className="w-20 h-20 rounded-theme-sm overflow-hidden flex items-center justify-center" style={{ background: ZINC.c100 }}>
            {w.imageUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={w.imageUrl} alt={w.label} className="w-full h-full object-contain p-1.5" draggable={false} />
              : <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{w.label}</span>}
          </div>
        ))}
      </div>
      <span className="text-caption font-medium rounded-full px-3 py-0.5" style={{ background: ZINC.c700, color: '#fff' }}>{block.name}</span>
    </button>
  );
}
```

- [ ] **Step 4:** `npx tsc --noEmit` → clean. Commit `Play blocks: glow token + shared CompositionBlock`.

---

### Task 3: `CompositionPlayModal` (block play modal)

**Files:**
- Create: `app/components/app/shared/modals/CompositionPlayModal.tsx`
- Modify: `messages/en.json` (`talker.replay` = "Replay")

**Interfaces — Consumes:** `PlayBlock`, `CompositionBlock`, `playKey`/`playTts`. **Produces:** `function CompositionPlayModal({ isOpen, blocks, voiceId, onClose }: { isOpen: boolean; blocks: PlayBlock[]; voiceId: string; onClose: () => void })`.

**Approach:** Fullscreen overlay (`fixed inset-0 z-[200]`, `background: var(--theme-overlay)`, `onClick={onClose}`). Blocks in a `flex flex-wrap gap-4 justify-center` container that `stopPropagation`s. An `activeIndex` state drives the glow. On open, auto-run the sequence. Replay button re-runs. Clicking a block cancels the run and plays just that block (glowing it). Reuse the await-on-ended pattern from `PersistentTalker.handlePlaySentence`.

- [ ] **Step 1:** Implement the playback engine:

```tsx
const cancelRef = useRef(false);
const [activeIndex, setActiveIndex] = useState<number | null>(null);

function clipKey(b: PlayBlock) { return b.audioKey; }          // word/phrase own clip
function ttsText(b: PlayBlock) { return b.kind === 'word' ? b.label : b.name; }

async function playOne(b: PlayBlock): Promise<void> {
  const key = clipKey(b);
  if (key) {
    await new Promise<void>((res) => {
      const a = new Audio(`/api/assets?key=${key}`);
      a.addEventListener('ended', () => res());
      a.addEventListener('error', () => res());
      a.play().catch(() => res());
    });
  } else {
    // no stored clip → speak the label/name (better than silence)
    await playTts(ttsText(b), voiceId);
    await new Promise<void>((res) => setTimeout(res, 200));
  }
}

async function runSequence() {
  cancelRef.current = false;
  for (let i = 0; i < blocks.length; i++) {
    if (cancelRef.current) break;
    setActiveIndex(i);
    await playOne(blocks[i]);
  }
  if (!cancelRef.current) setActiveIndex(null);
}

useEffect(() => { if (isOpen) runSequence(); return () => { cancelRef.current = true; }; }, [isOpen]); // eslint-disable-line
```

- [ ] **Step 2:** Render blocks + controls:

```tsx
if (!isOpen) return null;
return (
  <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 p-8"
       style={{ background: 'var(--theme-overlay)' }} onClick={() => { cancelRef.current = true; onClose(); }}>
    <div className="flex flex-wrap gap-4 justify-center max-w-5xl" onClick={(e) => e.stopPropagation()}>
      {blocks.map((b, i) => (
        <CompositionBlock key={i} block={b} active={activeIndex === i}
          onTap={() => { cancelRef.current = true; setActiveIndex(i); playOne(b).then(() => setActiveIndex(null)); }} />
      ))}
    </div>
    <button type="button" onClick={(e) => { e.stopPropagation(); runSequence(); }}
      className="flex items-center gap-2 rounded-theme-sm px-5 py-3 text-body font-semibold"
      style={{ background: 'var(--theme-brand-primary)', color: '#fff' }}>
      <RotateCcw className="w-5 h-5" /> {t('replay')}
    </button>
  </div>
);
```
(Import `RotateCcw` from lucide, `useTranslations('talker')`.)

- [ ] **Step 3:** Add `messages/en.json` `talker.replay` = "Replay". `node -e` JSON-validate.
- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit `Play blocks: CompositionPlayModal`.

---

### Task 4: Talker uses `CompositionPlayModal`

**Files:**
- Modify: `app/components/app/shared/sections/PersistentTalker.tsx`

**Interfaces — Consumes:** `blocksFromTalker`, `CompositionPlayModal`.

**Approach:** Replace the per-symbol `playModal` swap + `handlePlaySentence` loop with: Play button opens `CompositionPlayModal` (it owns playback). Single chip tap plays the clip only (drop the single-symbol pop-up). Keep `SentencePlayModal` for the fluent sentence path.

- [ ] **Step 1:** grep `PlayModal` usages repo-wide. If `PlayModal` (the single-symbol one) is used only by `PersistentTalker`, plan its removal in Task 7; if used elsewhere, leave it.
- [ ] **Step 2:** Add `const [playing, setPlaying] = useState(false);`. `handlePlaySentence` → `if (talkerSymbols.length) setPlaying(true)`. Delete the manual for-loop/`cancelSequenceRef`/`setPlayModal` sequence body.
- [ ] **Step 3:** `handleChipTap` → `if (item.audioPath) playAudio(item.audioPath);` (remove `setPlayModal`).
- [ ] **Step 4:** Render:
```tsx
{playing && (
  <CompositionPlayModal isOpen blocks={blocksFromTalker(talkerSymbols)} voiceId={voiceId} onClose={() => setPlaying(false)} />
)}
```
Remove the old `<PlayModal>` block + `PlayModalState`/`playModal` state if now unused. (`voiceId` from `useProfile()` — add to the destructure.)
- [ ] **Step 5:** `npx tsc --noEmit` clean; `curl` `/en/categories` → 307. Manual: build a sentence with a word + a phrase, tap Play → whole composition shows, glow steps word→phrase→…, Replay re-runs, tap a block plays it, click backdrop closes. Commit `Play blocks: talker Play opens the block modal`.

---

### Task 5: Saved talker-sentences render + play as blocks

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx`

**Approach:** Extend `SentenceRow` with `units?`, `kind?`, `playback?`. A row is "sequence" when `playback === 'sequence' && (units?.length ?? 0) > 0`. For sequence rows: the listing strip renders `blocksFromUnits(units, language)` via `CompositionBlock` (read-only, no `onTap`), and Play opens `CompositionPlayModal`. Fluent/legacy rows keep `ThumbnailStrip` + `SentencePlayModal` unchanged.

- [ ] **Step 1:** Extend `SentenceRow` type + the row mapping to carry `units`/`kind`/`playback` from the query.
- [ ] **Step 2:** In the sentence row (view mode), branch: `isSequence ? <div className="flex flex-wrap gap-2">{blocksFromUnits(row.units!, language).map((b,i) => <CompositionBlock key={i} block={b} />)}</div> : <ThumbnailStrip slots={row.slots} />`.
- [ ] **Step 3:** Play: keep a single `playTarget: SentenceRow | null`. Render — if `playTarget` and sequence → `<CompositionPlayModal isOpen blocks={blocksFromUnits(playTarget.units!, language)} voiceId={voiceId} onClose={...} />`; else the existing `<SentencePlayModal .../>`.
- [ ] **Step 4:** `npx tsc --noEmit` clean; `curl` `/en/sentences` → 307. Manual: save a sentence (word+phrase) from the talker into a group; open Sentences → the row shows the phrase as a zinc block; Play → block modal with glow. A Sentences-page-created sentence still shows thumbnails + TTS. Commit `Play blocks: saved sequence sentences render + play as blocks`.

---

### Task 6: Unit-aware editing for sequence sentences

**Files:**
- Modify: `convex/profileSentences.ts` (new `updateProfileSentenceUnits`)
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (a `UnitStrip` editor for sequence rows)

**Interfaces — Produces:** `updateProfileSentenceUnits({ profileSentenceId, units, propagateToPack? })` — patches `units`, regenerates `slots` (flatten each unit → word slots) so `slots` stays a valid back-compat/fluent-fallback view, bumps `updatedAt`.

**Approach:** Editing a sequence sentence operates on **units** (phrases stay atomic blocks). Word-units: tap to edit (symbol editor), X to remove, drag to reorder, "Add word" appends a word-unit. Phrase-units are atomic snapshots (drag/reorder, X remove, tap plays — no inner edit; a phrase is a frozen snapshot per ADR-015). Fluent rows keep the existing `SlotStrip`.

- [ ] **Step 1 (backend):** Add `updateProfileSentenceUnits` mirroring `updateProfileSentenceSlots` (auth/ownership via `requireCallerAccountId`, Pro gate as siblings do). Validator: `units: v.array(<compositionUnit shape>)` (reuse the `compositionUnitSchema` already added to `profileSentences.ts` for `createProfileSentence`). Handler: `patch({ units, slots: flattenUnitsToSlots(units), updatedAt })` where `flattenUnitsToSlots` mirrors the talker-save flatten (phrase → its words' imagePaths; word → its imagePath), reindexing `order`.
- [ ] **Step 2:** `npx tsc -p convex/tsconfig.json` clean.
- [ ] **Step 3 (frontend):** For sequence rows in edit mode, render a `UnitStrip` (dnd-kit `SortableContext`, `horizontalListSortingStrategy`, mirroring `SlotStrip`) where each item is a `CompositionBlock` wrapped with a sortable handle + an X remove badge; a trailing "Add word" button opens the symbol editor (sentenceSlot mode) and appends a `{kind:'word', order, imagePath, label}` unit. Reorder/remove/add rebuild the units array and call `updateProfileSentenceUnits`. Phrase-units render as the zinc block (draggable/removable, not inner-editable).
- [ ] **Step 4:** `npx tsc --noEmit` clean; `curl` `/en/sentences` → 307. Manual: edit a talker-saved sentence — reorder a phrase-block among words (it stays a block), remove/add a word, exit edit; reopen and confirm the phrase-block persisted and Play still steps it as one block. Commit `Play blocks: unit-aware editing for sequence sentences`.

---

### Task 7: i18n, cleanup, end-to-end verification

**Files:**
- Modify (maybe): remove `app/components/app/shared/modals/PlayModal.tsx` if grep (Task 4 Step 1) proved it unused; else leave.
- Modify: `messages/en.json` (any remaining keys — `sentences`/`talker` add-word/replay labels)

- [ ] **Step 1:** Remove now-dead code (old talker `PlayModal` + `PlayModalState` if unused). Keep `SentencePlayModal` (fluent path).
- [ ] **Step 2:** `npx tsc --noEmit` + `npx tsc -p convex/tsconfig.json` clean; `node -e` JSON-validate `en.json`; `curl` `/en/categories`, `/en/sentences` → 307.
- [ ] **Step 3:** Full manual pass (Verification below). Commit `Play blocks: cleanup + i18n`.

## Verification (authed manual, user runs after `npx convex deploy`)

1. **Talker play:** compose word + phrase + word; Play → all three blocks visible at once, yellow glow steps block-to-block in time with audio, phrase plays as one block; Replay restarts; tapping a block plays just it (and glows); clicking the dark backdrop closes.
2. **Save + view:** save that sentence into a sentence group; on Sentences the row shows the phrase as a zinc block (thumbnails + name), words as tiles.
3. **Saved play:** Play the saved sentence → same block modal + stepped glow.
4. **Unit edit:** edit the saved sentence — reorder the phrase-block among words, remove/add a word; exit + reopen → phrase-block survived; Play still treats it as one block.
5. **Fluent untouched:** a sentence created on the Sentences page still shows the flat thumbnail strip and plays whole-sentence TTS via the old modal.
6. Confirm no console errors; `pnpm lint`/`build` clean (user).

## Notes / decisions baked in
- **Scope:** block layout/play/edit apply only to `playback: 'sequence'` sentences (talker-saved). Fluent/legacy sentences keep `ThumbnailStrip` + `SentencePlayModal`.
- **Phrase snapshots are atomic in the sentence editor** (ADR-015 "structure frozen"): reorder/remove/play, no inner-word editing — to edit a phrase, rebuild it in the dropbar and re-add.
- **`slots[]` stays in sync** (flattened from units on every unit write) so the fluent fallback + any remaining slot readers keep working during the migration.
