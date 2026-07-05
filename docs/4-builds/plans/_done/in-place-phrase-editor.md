# In-Place Phrase Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Self-contained** — a fresh session can start cold. Design spec: [`FEAT-003-in-place-phrase-editor.md`](../../features/FEAT-003-in-place-phrase-editor.md).

**Goal:** Let an instructor edit a phrase in place while editing a talker-saved ("sequence") sentence — words, name, and audio — reusing the talker dropbar's phrase builder, with edits scoped to that one sentence's snapshot only.

**Architecture:** Extract the dropbar's inner phrase builder into a shared `PhraseBuilderBody` (pure props/callbacks); the dropbar's `PhraseEditCard` renders it inside its existing card (no behaviour change). A new `PhraseUnitEditorModal` renders the same body over a local copy of the phrase snapshot, hosting the same word editor + audio modal the dropbar uses. On save it returns the edited unit; the host (`SentencesModeContent`) persists via the already-shipped `updateProfileSentenceUnits`. No backend change.

**Tech Stack:** Next 16 / React 19 / TypeScript / Tailwind CSS 4 / Convex 1.x. dnd-kit (already used). Icons: lucide-react.

## Global Constraints

- **AAC theme tokens only** — no hard-coded colours/spacing/radii in AAC UI. `const ZINC = getCategoryColour('zinc')` (`app/lib/categoryColours.ts`) for the phrase box, matching the existing builder.
- **i18n:** new UI copy → `messages/en.json` **only** (never hand-add other locales). Reuse existing `talker.*` phrase keys; add missing modal keys under `sentences`.
- **No `npx convex dev`** in the worktree. There is **no backend change** in this plan, so `convex/tsconfig.json` is unaffected.
- **No JS component test runner exists** (same as the block-play plan). Per-task verification = `npx tsc --noEmit` clean (ignore the pre-existing `lib/stripe.ts` Stripe-version error) + `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/<route>` → 307 + the authed manual click-through. Do **not** invent a test framework or TDD steps.
- **Dev server** runs on :3000 (user's; preview MCP won't attach — use `curl` for compile checks, user does authed click-throughs).
- **Commit per task**, message `Phrase editor: <task>`, then `git push`.
- **Edits are local to the sentence snapshot** — never write to `profilePhrases` (the bank) or other sentences.

## Grounding — read before starting (no re-exploration needed)

- `app/components/app/shared/ui/TalkerDropdown.tsx`:
  - `WordChip` (~868–908): word tile (edit button + X delete badge). Used only by `PhraseEditCard`.
  - `PhraseEditCard` (~910–1049): `useSortable` outer wrapper → inner **card div** (`~971–1023`: word-chip row + add button, name `<input>` + audio button, incomplete warning) → below-card delete + drag-reorder (`~1025–1046`). Owns a name `draft` state (`~961–967`).
  - `ZINC = getCategoryColour('zinc')` (~62); icons `Plus, Volume2, Mic, X, Trash2, Move` from lucide (~16).
- `app/components/app/sentences/sections/SentencesModeContent.tsx`:
  - `UnitStrip` / `SortableUnitBlock` — block-level sentence editor. `SortableUnitBlock.onTap` routes word→`onEditWord`, phrase→`onPlayBlock` (from the block-play plan). **This plan** re-routes phrase→`onEditPhrase` and drops `onPlayBlock` from the strip.
  - `unitsOf(sentenceId)` + `persistUnits(sentenceId, units)` — reindex `order` + call `updateProfileSentenceUnits`. Reuse for phrase save.
  - `CompositionUnitClient` (from `composition/blocks.ts`) — client unit type; `displayString` / `DEFAULT_LOCALE` already imported.
  - `handlePlayBlock` + `onPlayBlock` prop threading — becomes dead after this plan; remove.
- `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` — `editorMode="sentenceSlot"` returns `SentenceSlotSaveResult = { imagePath?, displayProps? }` via `onSentenceSlotSave`.
- `app/components/app/sentences/modals/SentenceAudioModal.tsx` — props `{ isOpen, sentenceId: Id|null, accountId, initialValue?, title?, fieldLabel?, saveOverride?, onClose }`; `saveOverride(payload: { text: string; recordedAudioPath?: string | null })`. Recording → key; chose-TTS → `null`.
- `convex/schema.ts` `compositionUnit` phrase shape: `{ kind:'phrase', order, name:{..}, audioPath?, recordedAudioPath?, librarySourceId?, words:[{order, imagePath?, audioPath?, label?, displayProps?}] }`.
- Modal shell: use the same `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter`/`DialogClose` primitives `SentencesModeContent` already imports from `@/app/components/app/shared/ui/Dialog` (grep its imports).

---

### Task 1: Extract `PhraseBuilderBody` (+ `WordChip`) from the dropbar — no behaviour change

**Files:**
- Create: `app/components/app/shared/ui/composition/PhraseBuilderBody.tsx`
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx` (remove `WordChip` + inner card block + name `draft` state from `PhraseEditCard`; import + render `PhraseBuilderBody`)

**Interfaces — Produces:**
- `PhraseBuilderBody` component + `WordChip` (co-located), props:
  ```ts
  type PhraseBuilderWord = { imagePath?: string; label: string };
  function PhraseBuilderBody(props: {
    name: string;
    words: PhraseBuilderWord[];
    hasAudio: boolean;
    incomplete: boolean;
    incompleteLabel: string;
    audioReadyLabel: string;
    audioGenerateLabel: string;
    renameLabel: string;
    addLabel: string;
    removeLabel: string;
    onRename: (value: string) => void;
    onWordAdd: () => void;
    onWordEdit: (index: number) => void;
    onWordDelete: (index: number) => void;
    onAudio: () => void;
  }): JSX.Element
  ```

- [ ] **Step 1:** Create `app/components/app/shared/ui/composition/PhraseBuilderBody.tsx` with the exact content below (this is `WordChip` + the inner card block + the name-draft state, moved verbatim from `TalkerDropdown`):

```tsx
"use client";
import { useState, useEffect } from 'react';
import { Plus, Volume2, Mic, X } from 'lucide-react';
import { getCategoryColour } from '@/app/lib/categoryColours';

const ZINC = getCategoryColour('zinc');

export type PhraseBuilderWord = { imagePath?: string; label: string };

// A single word tile inside the phrase builder — edit on tap, X to remove.
export function WordChip({
  imagePath, label, removeLabel, onEdit, onDelete,
}: { imagePath?: string; label: string; removeLabel: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onEdit}
        aria-label={label}
        className="w-16 h-16 rounded-theme-sm overflow-hidden flex items-center justify-center"
        style={{ background: ZINC.c100 }}
      >
        {imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/api/assets?key=${imagePath}`} alt={label} className="w-full h-full object-contain p-1" draggable={false} />
        ) : (
          <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{label}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={removeLabel}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// The inner phrase builder: word chips + add-word, a name field, and the phrase
// audio button. Pure props/callbacks — shared by the talker dropbar's
// PhraseEditCard and the sentence PhraseUnitEditorModal, so both edit a phrase
// identically. The host owns the actual word/audio sub-editors + persistence.
export function PhraseBuilderBody({
  name, words, hasAudio, incomplete,
  incompleteLabel, audioReadyLabel, audioGenerateLabel, renameLabel, addLabel, removeLabel,
  onRename, onWordAdd, onWordEdit, onWordDelete, onAudio,
}: {
  name: string;
  words: PhraseBuilderWord[];
  hasAudio: boolean;
  incomplete: boolean;
  incompleteLabel: string;
  audioReadyLabel: string;
  audioGenerateLabel: string;
  renameLabel: string;
  addLabel: string;
  removeLabel: string;
  onRename: (value: string) => void;
  onWordAdd: () => void;
  onWordEdit: (index: number) => void;
  onWordDelete: (index: number) => void;
  onAudio: () => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    else setDraft(name);
  }

  return (
    <div
      className="flex flex-col gap-3 p-3 rounded-theme-card border-2 border-dashed"
      style={{ background: ZINC.c500, borderColor: incomplete ? 'var(--theme-warning)' : 'var(--theme-enter-mode)' }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {words.map((w, i) => (
          <WordChip
            key={i}
            imagePath={w.imagePath}
            label={w.label}
            removeLabel={removeLabel}
            onEdit={() => onWordEdit(i)}
            onDelete={() => onWordDelete(i)}
          />
        ))}
        <button
          type="button"
          onClick={onWordAdd}
          aria-label={addLabel}
          className="w-16 h-16 rounded-theme-sm border-2 border-dashed border-theme-enter-mode flex items-center justify-center transition-opacity hover:opacity-80 shrink-0"
        >
          <Plus className="w-6 h-6" style={{ color: 'var(--theme-enter-mode)' }} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
          }}
          aria-label={renameLabel}
          className="flex-1 min-w-0 text-caption font-medium rounded-full px-3 py-1 outline-none"
          style={{ background: ZINC.c700, color: '#fff', border: '2px dashed var(--theme-enter-mode)' }}
        />
        <button
          type="button"
          onClick={onAudio}
          className="flex items-center gap-1 text-caption font-medium rounded-full px-2.5 py-1 shrink-0"
          style={{ background: ZINC.c700, color: '#fff' }}
        >
          {hasAudio ? <Volume2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {hasAudio ? audioReadyLabel : audioGenerateLabel}
        </button>
      </div>

      {incomplete && (
        <span className="text-caption" style={{ color: 'var(--theme-warning)' }}>{incompleteLabel}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** In `TalkerDropdown.tsx`, delete the local `WordChip` function (~868–908) and add an import at the top with the other UI imports:

```tsx
import { PhraseBuilderBody } from '@/app/components/app/shared/ui/composition/PhraseBuilderBody';
```

- [ ] **Step 3:** In `PhraseEditCard` (`TalkerDropdown.tsx`), replace the inner card block **and** the name-draft state with a `PhraseBuilderBody`. Concretely: remove the `const [draft, setDraft] = useState(name); useEffect(...); function commitName()...` lines, and replace the inner card `<div … style={{ background: ZINC.c500, borderColor … }}>…</div>` (word chips + add + name input + audio button + incomplete warning) with:

```tsx
      <PhraseBuilderBody
        name={name}
        words={words}
        hasAudio={hasAudio}
        incomplete={incomplete}
        incompleteLabel={incompleteLabel}
        audioReadyLabel={audioReadyLabel}
        audioGenerateLabel={audioGenerateLabel}
        renameLabel={renameLabel}
        addLabel={addLabel}
        removeLabel={removeLabel}
        onRename={onRename}
        onWordAdd={onWordAdd}
        onWordEdit={onWordEdit}
        onWordDelete={onWordDelete}
        onAudio={onAudio}
      />
```

Keep `PhraseEditCard`'s outer `useSortable` wrapper `<div ref={setNodeRef} …>` and the below-card delete + drag-reorder `<div>` (`~1025–1046`) exactly as-is. Remove any now-unused imports in `TalkerDropdown` (e.g. `useEffect` if it was only used by the moved state — grep first; leave it if still used).

- [ ] **Step 4:** Verify no behaviour change. `npx tsc --noEmit` → clean (ignore stripe). `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/categories` → 307. **Manual (user):** open the talker Phrases tab → Edit → confirm word add/remove/edit, phrase rename, and the audio button all still work exactly as before.

- [ ] **Step 5:** Commit `Phrase editor: extract shared PhraseBuilderBody`, then `git push`.

---

### Task 2: `PhraseUnitEditorModal`

**Files:**
- Create: `app/components/app/sentences/modals/PhraseUnitEditorModal.tsx`
- Modify: `messages/en.json` (add `sentences.phraseEditorTitle`, `sentences.phraseEditorSave`, `sentences.phraseEditorCancel`)

**Interfaces — Consumes:** `PhraseBuilderBody`, `SymbolEditorModal` (`sentenceSlot`), `SentenceAudioModal`, `CompositionUnitClient`, `displayString`/`DEFAULT_LOCALE`, the `Dialog` primitives. **Produces:**
```ts
// PhraseUnit = the phrase branch of CompositionUnitClient (kind:'phrase')
function PhraseUnitEditorModal(props: {
  isOpen: boolean;
  unit: PhraseUnit;               // the phrase unit being edited
  language: string;
  accountId: Id<'users'>;
  voiceId: string;
  onSave: (updated: PhraseUnit) => void;   // caller persists to the sentence
  onClose: () => void;
}): JSX.Element | null
```

**Approach:** Hold a local editable copy of the phrase (`name`, `words`, `audioPath`, `recordedAudioPath`, preserved `librarySourceId`/`order`). Render `PhraseBuilderBody` in a `Dialog`, plus a Save (disabled while `words.length < 2`) + Cancel footer. Host the word editor (`SymbolEditorModal` `sentenceSlot`) and phrase-audio editor (`SentenceAudioModal` `sentenceId={null}` + `saveOverride`) internally, mutating local state. Save calls `onSave(rebuiltUnit)`.

- [ ] **Step 1:** Add i18n keys to `messages/en.json` under `sentences` (English only). Place beside the existing `rowAddWord` key:

```json
    "phraseEditorTitle": "Edit phrase",
    "phraseEditorSave": "Done",
    "phraseEditorCancel": "Cancel",
```

Validate: `node -e "require('./messages/en.json'); console.log('ok')"`.

- [ ] **Step 2:** Create `app/components/app/sentences/modals/PhraseUnitEditorModal.tsx`:

```tsx
"use client";
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Id } from '@/convex/_generated/dataModel';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { PhraseBuilderBody } from '@/app/components/app/shared/ui/composition/PhraseBuilderBody';
import { SymbolEditorModal, type SentenceSlotSaveResult } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import { SentenceAudioModal } from '@/app/components/app/sentences/modals/SentenceAudioModal';
import type { CompositionUnitClient } from '@/app/components/app/shared/ui/composition/blocks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/app/components/app/shared/ui/Dialog';

// Narrow to the phrase branch of the unit union.
type PhraseUnit = Extract<CompositionUnitClient, { kind: 'phrase' }>;
type PhraseWord = PhraseUnit['words'][number];

// Edit a phrase snapshot IN PLACE (local to one sentence — ADR-015). Reuses the
// dropbar's PhraseBuilderBody + the same word/audio sub-editors, but all edits
// stay in local state until Save, which hands the rebuilt unit back to the host
// to persist via updateProfileSentenceUnits. Never touches the phrase bank.
export function PhraseUnitEditorModal({
  isOpen, unit, language, accountId, voiceId, onSave, onClose,
}: {
  isOpen: boolean;
  unit: PhraseUnit;
  language: string;
  accountId: Id<'users'>;
  voiceId: string;
  onSave: (updated: PhraseUnit) => void;
  onClose: () => void;
}) {
  const t = useTranslations('sentences');
  const tTalker = useTranslations('talker');

  // Local editable copy, reseeded whenever a different phrase opens.
  const [name, setName] = useState<Record<string, string>>(unit.name);
  const [words, setWords] = useState<PhraseWord[]>(unit.words);
  const [audioPath, setAudioPath] = useState<string | undefined>(unit.audioPath);
  const [recordedAudioPath, setRecordedAudioPath] = useState<string | undefined>(unit.recordedAudioPath);
  const [wordEditor, setWordEditor] = useState<{ index: number } | null>(null);   // index -1 = append
  const [audioOpen, setAudioOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(unit.name);
    setWords(unit.words);
    setAudioPath(unit.audioPath);
    setRecordedAudioPath(unit.recordedAudioPath);
    setWordEditor(null);
    setAudioOpen(false);
  }, [isOpen, unit]);

  const nameStr = displayString(name, language, DEFAULT_LOCALE);
  const builderWords = words.map((w) => ({
    imagePath: w.imagePath,
    label: displayString(w.label ?? {}, language, DEFAULT_LOCALE),
  }));
  const hasAudio = !!(recordedAudioPath ?? audioPath);
  const incomplete = words.length < 2;

  // ── Word edits (mirror TalkerDropdown.handlePhraseWordSave) ────────────────
  function handleWordSave(result: SentenceSlotSaveResult) {
    setWords((prev) => {
      const next = [...prev];
      if (!wordEditor) return prev;
      if (wordEditor.index === -1) {
        next.push({ order: next.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
      } else if (next[wordEditor.index]) {
        next[wordEditor.index] = { ...next[wordEditor.index], imagePath: result.imagePath, displayProps: result.displayProps };
      }
      return next.map((w, i) => ({ ...w, order: i }));
    });
    setWordEditor(null);
  }
  function handleWordDelete(index: number) {
    setWords((prev) => prev.filter((_, i) => i !== index).map((w, i) => ({ ...w, order: i })));
  }

  // ── Phrase audio + name (SentenceAudioModal saveOverride) ──────────────────
  // A new recording wins. If there's no recording after this save, drop the
  // stale TTS clip (audioPath) so playback re-resolves TTS from the (possibly
  // renamed) phrase name instead of speaking the old name.
  async function handleAudioSave(payload: { text: string; recordedAudioPath?: string | null }) {
    if (payload.text) setName((prev) => ({ ...prev, [language]: payload.text }));
    let nextRecorded = recordedAudioPath;
    if (typeof payload.recordedAudioPath === 'string') nextRecorded = payload.recordedAudioPath;
    else if (payload.recordedAudioPath === null) nextRecorded = undefined;
    setRecordedAudioPath(nextRecorded);
    if (!nextRecorded) setAudioPath(undefined);
  }

  function handleSave() {
    if (words.length < 2) return;
    const updated: PhraseUnit = {
      ...unit,                 // preserves kind, order, librarySourceId
      name,
      words: words.map((w, i) => ({ ...w, order: i })),
      ...(audioPath ? { audioPath } : { audioPath: undefined }),
      ...(recordedAudioPath ? { recordedAudioPath } : { recordedAudioPath: undefined }),
    };
    onSave(updated);
  }

  const existingWordImagePath =
    wordEditor && wordEditor.index >= 0 ? words[wordEditor.index]?.imagePath : undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('phraseEditorTitle')}</DialogTitle>
          </DialogHeader>

          <PhraseBuilderBody
            name={nameStr}
            words={builderWords}
            hasAudio={hasAudio}
            incomplete={incomplete}
            incompleteLabel={tTalker('phraseNeedsTwo')}
            audioReadyLabel={tTalker('phraseAudioReady')}
            audioGenerateLabel={tTalker('phraseAudioGenerate')}
            renameLabel={tTalker('phraseRename')}
            addLabel={tTalker('phraseAddSymbol')}
            removeLabel={tTalker('phraseRemoveSymbol')}
            onRename={(v) => setName((prev) => ({ ...prev, [language]: v }))}
            onWordAdd={() => setWordEditor({ index: -1 })}
            onWordEdit={(i) => setWordEditor({ index: i })}
            onWordDelete={handleWordDelete}
            onAudio={() => setAudioOpen(true)}
          />

          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold"
                style={{ background: 'var(--theme-line)', color: 'var(--theme-text)' }}
              >
                {t('phraseEditorCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleSave}
              disabled={incomplete}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {t('phraseEditorSave')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Word editor — image-only (sentenceSlot); a phrase plays as one clip. */}
      {wordEditor && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="sentenceSlot"
          initialImagePath={existingWordImagePath}
          onClose={() => setWordEditor(null)}
          onSave={() => {}}
          onSentenceSlotSave={handleWordSave}
        />
      )}

      {/* Phrase audio — reuses the sentence audio modal via saveOverride. */}
      {audioOpen && (
        <SentenceAudioModal
          isOpen
          sentenceId={null}
          accountId={accountId}
          initialValue={nameStr}
          title={tTalker('phraseEditTitle')}
          fieldLabel={tTalker('phraseFieldLabel')}
          onClose={() => setAudioOpen(false)}
          saveOverride={handleAudioSave}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3:** Verify `PhraseUnitEditorModal` compiles: `npx tsc --noEmit` → clean (ignore stripe). (No route to curl yet — it's not wired in until Task 3.)

- [ ] **Step 4:** Commit `Phrase editor: PhraseUnitEditorModal`, then `git push`.

---

### Task 3: Wire the modal into the sentence editor (tap-to-edit) + drop tap-to-play

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx`

**Interfaces — Consumes:** `PhraseUnitEditorModal`, `unitsOf`/`persistUnits`, `CompositionUnitClient`.

**Approach:** A phrase block in the sentence **edit** strip now opens `PhraseUnitEditorModal` instead of playing. Save replaces that unit and persists via `persistUnits`. Remove the now-dead `onPlayBlock`/`handlePlayBlock` play-in-edit path.

- [ ] **Step 1:** Import the modal at the top of `SentencesModeContent.tsx`:

```tsx
import { PhraseUnitEditorModal } from '@/app/components/app/sentences/modals/PhraseUnitEditorModal';
```

- [ ] **Step 2:** In `UnitStripProps`, replace `onPlayBlock` with `onEditPhrase`:

```tsx
  onEditPhrase: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
```
Remove the `onPlayBlock: (block: PlayBlock) => void;` line. Update the `UnitStrip` destructure accordingly (`onEditPhrase` in, `onPlayBlock` out). If `PlayBlock` is no longer referenced anywhere in the file after this task, drop it from the `blocks` import (grep `PlayBlock` in the file first — it may still be used by `handlePlayBlock` until Step 5).

- [ ] **Step 3:** In `UnitStrip`'s `SortableUnitBlock` render, route a **phrase** tap to edit (word taps stay on `onEditWord`):

```tsx
              onTap={() => (b.kind === 'word' ? onEditWord(sentenceId, i) : onEditPhrase(sentenceId, i))}
```

- [ ] **Step 4:** In `SortableSentenceRowProps`, replace the `onPlayBlock` prop with `onEditPhrase` (same signature as Step 2), update the `SortableSentenceRow` destructure, and pass it through to `UnitStrip`:

```tsx
                  onEditPhrase={onEditPhrase}
```
(remove the `onPlayBlock={onPlayBlock}` line on the `UnitStrip`).

- [ ] **Step 5:** In the main component, add state + the edit/save handlers and remove the dead play handler:

```tsx
  const [phraseEditTarget, setPhraseEditTarget] =
    useState<{ sentenceId: Id<'profileSentences'>; unitIndex: number } | null>(null);

  function handleEditPhrase(sentenceId: Id<'profileSentences'>, unitIndex: number) {
    setPhraseEditTarget({ sentenceId, unitIndex });
  }

  function handlePhraseSave(updated: CompositionUnitClient) {
    if (!phraseEditTarget) return;
    const units = [...unitsOf(phraseEditTarget.sentenceId)];
    if (units[phraseEditTarget.unitIndex]?.kind === 'phrase') {
      units[phraseEditTarget.unitIndex] = updated;
    }
    persistUnits(phraseEditTarget.sentenceId, units);
    setPhraseEditTarget(null);
  }
```
Delete the `handlePlayBlock` function (added in the block-play plan) — it is now unused. It was the only consumer of `playKey`/`playTts` in this file, so also **remove that import** (`import { playKey, playTts } from '@/lib/audio/playTts';`) to avoid an unused-import lint/build failure.

- [ ] **Step 6:** Update the `<SortableSentenceRow …>` render props: remove `onPlayBlock={handlePlayBlock}` and add `onEditPhrase={handleEditPhrase}`.

- [ ] **Step 7:** Derive the phrase unit for the modal and render it. Place the derivation beside `editingUnit` (the word-editor seed):

```tsx
  const editingPhraseUnit = (() => {
    if (!phraseEditTarget) return undefined;
    const u = sentences?.find((s) => s._id === phraseEditTarget.sentenceId)?.units?.[phraseEditTarget.unitIndex];
    return u && u.kind === 'phrase' ? u : undefined;
  })();
```
Then, next to the unit (word) editor render:

```tsx
      {phraseEditTarget && editingPhraseUnit && accountId && (
        <PhraseUnitEditorModal
          isOpen
          unit={editingPhraseUnit}
          language={language}
          accountId={accountId}
          voiceId={voiceId}
          onSave={handlePhraseSave}
          onClose={() => setPhraseEditTarget(null)}
        />
      )}
```

- [ ] **Step 8:** Verify. `npx tsc --noEmit` → clean (ignore stripe). `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/sentences` → 307. **Manual (user):** edit a talker-saved sentence → tap a phrase block → editor opens with its words/name/audio → add a word, rename, record/generate audio, remove a word (Save disabled at 1 word, enabled at 2+) → Save → reopen: the phrase changed **only here**; the phrase bank + other sentences are unchanged; Play still steps it as one block with the new audio. Confirm the talker Phrases-tab builder still works (Task 1 regression).

- [ ] **Step 9:** Commit `Phrase editor: sentence-edit tap opens the phrase editor`, then `git push`.

---

## Verification (authed manual, user runs)

1. **Dropbar unchanged:** talker Phrases tab → Edit → add/remove/edit words, rename, set audio — all identical to before.
2. **Open editor:** edit a talker-saved sentence → tap a phrase block → the phrase editor opens seeded with the phrase's words, name, and audio state.
3. **Edit words:** add a word (image-only editor), edit a word's image, remove a word. Save disabled at <2 words, enabled at 2+.
4. **Rename + audio:** rename the phrase; open the audio editor, record or choose TTS; the audio pill reflects "ready" vs "add audio".
5. **Save is local:** Save → the sentence's phrase reflects the edits; the **bank phrase** and **any other sentence** using that phrase are unchanged.
6. **Playback:** Play the sentence → the phrase still plays as one block; a rename with no recording now speaks the new name (stale TTS cleared); a recording plays the recording.
7. **Cancel:** reopen, make changes, Cancel → nothing persisted.
8. No console errors; `pnpm lint`/`build` clean (user).

## Notes / decisions baked in

- **Local-only** edits (ADR-015): the snapshot is edited; the bank + other sentences are never written. No backend change — reuses `updateProfileSentenceUnits`.
- **Phrase inner words are image-only** (`sentenceSlot` editor): a phrase plays as one clip, so per-word audio is unused.
- **Name/audio nuance:** a rename with no active recording clears the stale `audioPath` so playback TTS-resolves the new name; a recording always wins.
- **<2 words blocks Save** (mirrors the builder's own rule).
- **Tap-to-edit replaces tap-to-play** for phrase blocks in the edit strip; play lives on the editor's audio button.
```
