# Audio-follows-label Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a symbol tile speak what its label says by default, with deliberate audio≠label authored in the Generate tab — eliminating the F-1 silent per-language mismatch.

**Architecture:** The symbol editor's audio becomes a per-language fork with three modes. **Default** resolves the label text through the existing `/api/tts` chain (symbols-folder → tts-cache → generate) on preview/save; **Generate** resolves its own decoupled text field; **Record** is unchanged. A per-language `labelDirty` flag protects hand-typed labels from being overwritten when the user clicks between symbols. Pure decision logic lives in a new `audioLogic.ts`; the React components orchestrate it.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Convex (`profileSymbols`), `/api/tts` route (Google TTS), Tailwind 4.

## Global Constraints

- **No unit-test harness exists in this repo.** Verification is: `npx tsc --noEmit -p tsconfig.json` (typecheck), `npx eslint <file>` (lint), and **browser verification** against the running dev server on **http://localhost:3000** via the signed-in Chrome (claude-in-chrome MCP). Do **not** add a test runner. Pure logic is extracted into `audioLogic.ts` so it is inspectable; verify behaviour in-browser.
- **Never run `npm run dev` or `npx convex dev`** — the user keeps `next dev` running on port 3000 and `convex dev` running on `main` (auto-push). Read live data with `npx convex run <fn> '<json>'` (prefix `source ~/.nvm/nvm.sh && nvm use 20.17.0` for Node 20).
- **UI copy → `messages/en.json` only** (real English). Never hand-add keys to `hi.json`/`es.json` — the merge + translate pipeline handles those. Use `useTranslations`.
- **AAC theme tokens only** — no hard-coded colours/spacing; use `--theme-*` / `bg-theme-*` etc.
- **`/api/tts` must be called WITHOUT the `literal` flag** — `literal: true` skips the symbols-folder reuse step. Preserve symbols-folder → tts-cache → generate order.
- **No Convex schema change** — `audioSourceValidator` already carries `ttsText` (`convex/profileSymbols.ts:8`).
- **Commit on `main`** (project convention — do not branch). End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Design spec: `docs/4-builds/plans/audio-follows-label-editor-redesign.md`.

---

## File Structure

| File | Responsibility | Create/Modify |
|---|---|---|
| `app/components/app/shared/modals/symbol-editor/audioLogic.ts` | Pure decision helpers: reopen mode derivation, label-dirty init, follow-label save plan | **Create** |
| `app/components/app/shared/modals/symbol-editor/types.ts` | Draft: add `symbolWords`, `labelDirty`, `generateText` | Modify |
| `app/components/app/shared/modals/symbol-editor/SymbolStixTab.tsx` | Label-on-pick dirty overwrite + capture `symbolWords` | Modify |
| `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx` | Label field sets dirty + reset affordance; Generate own field; Default hint + label-resolving preview | Modify |
| `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` | Reopen derivation; per-language resolve-on-save; block-on-failure + success; shared default-resolve helper | Modify |
| `messages/en.json` | New copy (en only) | Modify |
| `docs/4-builds/features/FEAT-007-audio-language-switching.md` | Mark §8 F-1 resolved on ship | Modify |

---

## Task 1: Draft fields + pure `audioLogic.ts`

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/types.ts`
- Create: `app/components/app/shared/modals/symbol-editor/audioLogic.ts`

**Interfaces:**
- Produces:
  - `Draft.symbolWords: Record<string, string>` (canonical words of the picked symbol; `{}` when none / non-symbolstix)
  - `Draft.labelDirty: Record<string, boolean>` (per-language "user typed this")
  - `Draft.generateText?: string` (the Generate tab's decoupled spoken text)
  - `StoredAudioEntry` type
  - `deriveAudioMode(entry, label): { mode, generateText?, generatedAudioPath?, recordedAudioPath? }`
  - `initLabelDirty(label, symbolWords, isPlaceholder): Record<string, boolean>`
  - `planFollowLabelAudio({ language, resolvedPath, symbolDefaultPath, spokenText }): AudioSavePlan`

- [ ] **Step 1: Add fields to `Draft` and `INITIAL_DRAFT`**

In `types.ts`, add to the `Draft` type (after `labelLoc: Record<string, string>;`):

```typescript
  // Canonical words of the currently-picked SymbolStix symbol, keyed by ISO
  // code. Empty for non-symbolstix sources (no canonical word). Used to decide
  // label-on-pick overwrite, the reset affordance, and whether audio needs a
  // per-language override.
  symbolWords: Record<string, string>;
  // Per-language "the user hand-typed this label" flag. A dirty language is not
  // overwritten when the user picks a different symbol.
  labelDirty: Record<string, boolean>;
  // Generate tab's own spoken text, decoupled from the label (the deferred
  // Proloquo-style pronunciation field, scoped to Generate). Seeded from the
  // label when the tab is first opened; then independently editable.
  generateText?: string;
```

In `INITIAL_DRAFT`, add after `labelLoc: {},`:

```typescript
  symbolWords: {},
  labelDirty: {},
```

- [ ] **Step 2: Create `audioLogic.ts`**

```typescript
// Pure decision helpers for the symbol-editor audio model (audio follows the
// label by default; Generate carries a decoupled spoken text). No React, no I/O
// — kept inspectable and side-effect-free so the components stay thin.
import type { AudioMode } from './types';

/** The subset of a stored per-language audio override the editor reads back. */
export type StoredAudioEntry = {
  type: 'r2' | 'tts' | 'recorded';
  path: string;
  ttsText?: string;
  alternates?: { default?: string; generated?: string; recorded?: string };
};

/**
 * Which editor audio tab a language's stored override maps to on reopen:
 *   none                             -> default (follow label)
 *   tts  & ttsText === current label -> default (cached follow-label clip)
 *   tts  & ttsText !== current label -> generate (decoupled custom text)
 *   recorded                         -> record
 *   r2  (author-time cache)          -> default (resolver ignores r2)
 */
export function deriveAudioMode(
  entry: StoredAudioEntry | undefined,
  label: string,
): { mode: AudioMode; generateText?: string; generatedAudioPath?: string; recordedAudioPath?: string } {
  if (!entry) return { mode: 'default' };
  if (entry.type === 'recorded') return { mode: 'record', recordedAudioPath: entry.path };
  if (entry.type === 'tts') {
    const text = (entry.ttsText ?? '').trim();
    if (text && text === label.trim()) return { mode: 'default' };
    return { mode: 'generate', generateText: entry.ttsText ?? '', generatedAudioPath: entry.path };
  }
  return { mode: 'default' };
}

/**
 * Initial per-language dirty flags. A label is dirty when it is non-empty AND
 * differs from the symbol's own word for that language (a genuine custom
 * label, to be protected). Placeholders (no symbol yet) start clean so the
 * first pick fills them.
 */
export function initLabelDirty(
  label: Record<string, string>,
  symbolWords: Record<string, string>,
  isPlaceholder: boolean,
): Record<string, boolean> {
  if (isPlaceholder) return {};
  const dirty: Record<string, boolean> = {};
  for (const [lang, text] of Object.entries(label)) {
    const t = (text ?? '').trim();
    if (t && t !== (symbolWords[lang] ?? '').trim()) dirty[lang] = true;
  }
  return dirty;
}

export type AudioSavePlan =
  | { action: 'delete' }
  | { action: 'store'; entry: { type: 'tts'; path: string; ttsText: string; language: string } };

/**
 * Decide whether to persist a per-language override once a clip is resolved.
 * If the resolved clip IS the symbol's own default (label matches the symbol
 * word, seeded), store nothing so render re-derives per board voice; otherwise
 * store a per-language tts override carrying the spoken text.
 */
export function planFollowLabelAudio(args: {
  language: string;
  resolvedPath: string;
  symbolDefaultPath?: string;
  spokenText: string;
}): AudioSavePlan {
  if (args.symbolDefaultPath && args.resolvedPath === args.symbolDefaultPath) {
    return { action: 'delete' };
  }
  return {
    action: 'store',
    entry: { type: 'tts', path: args.resolvedPath, ttsText: args.spokenText, language: args.language },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "audioLogic|types.ts"`
Expected: no output (INITIAL_DRAFT now satisfies the new required fields; helpers compile). If `Draft` is constructed elsewhere with object literals, those spots surface here — fix by adding `symbolWords: {}, labelDirty: {}` (they inherit from `...INITIAL_DRAFT` in `SymbolEditorModal`, so none expected).

- [ ] **Step 4: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/types.ts app/components/app/shared/modals/symbol-editor/audioLogic.ts
git commit -m "feat(symbol-editor): draft fields + pure audio-follows-label helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Reopen derivation — populate the new fields from the saved symbol

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` (the `existingSymbol` pre-populate effect, ~lines 288–375; the symbolstix seed ~174–189)

**Interfaces:**
- Consumes: `deriveAudioMode`, `initLabelDirty`, `StoredAudioEntry` (Task 1); `existingSymbol.symbolRecord?.words`, `existingSymbol.label`, `existingSymbol.audio`, `existingSymbol.imageSource.type`.
- Produces: on open, `draft.symbolWords`, `draft.labelDirty`, `draft.audioMode`, `draft.generateText`, `draft.generatedAudioPath`, `draft.recordedAudioPath` reflect the saved per-language state for the effective language.

- [ ] **Step 1: Import the helpers**

At the top of `SymbolEditorModal.tsx`, add:

```typescript
import { deriveAudioMode, initLabelDirty, type StoredAudioEntry } from './audioLogic';
```

- [ ] **Step 2: Derive mode + fields in the pre-populate effect**

In the `useEffect(() => { if (!existingSymbol) return; ... }, [existingSymbol])` block, **replace** the block that computes `langAudio`, `activeSource`, `generatedAudioPath`, `recordedAudioPath` (currently ~lines 300–320) with:

```typescript
    const effLang = ps.pinnedLanguage ?? language;
    const effLabel = (effLang === 'en' ? (ps.label.en ?? '') : (ps.label[effLang] ?? ps.label.en ?? ''));
    const symbolWords = (ps.symbolRecord?.words as Record<string, string> | undefined) ?? {};
    const langEntry = (ps.audio as Record<string, StoredAudioEntry> | undefined)?.[effLang];

    const symbolAudioMap =
      (ps.symbolRecord?.audio as Record<string, boolean> | undefined) ?? {};
    const englishWord = ps.symbolRecord?.words.en ?? '';
    const defaultPath =
      resolveSymbolAudioPath(
        voiceId,
        englishWord,
        symbolAudioMap[voiceId] === true,
        ps.symbolRecord?.audioBasename,
      ) ?? undefined;

    const derived = deriveAudioMode(langEntry, effLabel);
    const activeSource: Draft['activeAudioSource'] =
      derived.mode === 'record'   ? 'record'   :
      derived.mode === 'generate' ? 'generate' :
      (defaultPath ? 'default' : null);
    const generatedAudioPath = derived.generatedAudioPath;
    const recordedAudioPath = derived.recordedAudioPath;
```

- [ ] **Step 3: Seed the new draft fields in the same `setDraft`**

In the `setDraft({ ... })` call inside that effect, set `audioMode` from the derived mode and add the three new fields. Change the existing `audioMode: activeSource ?? 'default',` line to:

```typescript
      audioMode: derived.mode,
```

and add (alongside `labelLoc: { ...ps.label },`):

```typescript
      symbolWords,
      labelDirty: initLabelDirty(ps.label as Record<string, string>, symbolWords, ps.imageSource.type === 'placeholder'),
      generateText: derived.mode === 'generate' ? (derived.generateText ?? '') : undefined,
```

- [ ] **Step 4: Seed `symbolWords` on the search→editor symbolstix seed (create mode)**

In the `symbolstixSeed` object (~lines 174–189), the caller only passes `initialLabelHin`. Leave as-is — `symbolWords` for that path is filled when the symbol is (re)picked in Task 3, and `INITIAL_DRAFT.symbolWords = {}` covers the initial render. No change needed here beyond confirming `INITIAL_DRAFT` spread provides `symbolWords: {}` and `labelDirty: {}` (it does, via `...INITIAL_DRAFT`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "SymbolEditorModal"`
Expected: no output.

- [ ] **Step 6: Browser sanity — reopen shows the right tab**

Dev server is on :3000. In the signed-in Chrome, open a category, Edit, tap a symbol whose label equals its word → the Audio section opens on **Default**. (Full generate/record reopen is verified in Task 6 after those UIs exist.)

Run (data cross-check, optional): `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex run profileCategories:getProfileSymbols '{"profileCategoryId":"<catId>"}'` and confirm a diverged tile has `audio` with `ttsText`.

- [ ] **Step 7: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx
git commit -m "feat(symbol-editor): derive audio mode + label-dirty on reopen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Label-on-pick dirty overwrite + reset affordance

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolStixTab.tsx` (pick handler ~lines 56–88)
- Modify: `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx` (label field ~lines 265–301)
- Modify: `messages/en.json`

**Interfaces:**
- Consumes: `Draft.symbolWords`, `Draft.labelDirty` (Task 1).
- Produces: picking a symbol fills `symbolWords` and overwrites non-dirty labels; typing sets `labelDirty[lang]`; a reset control restores `label[lang]` to the symbol word.

- [ ] **Step 1: Rewrite the pick handler's label seeding**

In `SymbolStixTab.tsx`, **replace** the `patch({ ... })` call in the pick handler (~lines 67–88) with:

```typescript
    const words = sym.words as Record<string, string | undefined>;
    const currentLang = draft.pinnedLanguage ?? language;

    // Overwrite the label with the picked symbol's word UNLESS the user has
    // hand-typed this language (labelDirty). Placeholder / symbol-derived
    // labels are replaced so "clicking around" symbols keeps the label in sync;
    // a real edit is protected. Applies to every language the symbol provides.
    const nextLabelEng =
      draft.labelDirty['en'] ? draft.labelEng : (words.en ?? draft.labelEng);
    const nextLabelLoc: Record<string, string> = { ...draft.labelLoc };
    for (const [k, v] of Object.entries(words)) {
      if (k === 'en' || !v) continue;
      if (!draft.labelDirty[k]) nextLabelLoc[k] = v;
    }

    patch({
      symbolstixId: sym._id,
      symbolstixImagePath: sym.imagePath,
      symbolstixAudioEng: defaultAudio,
      symbolstixAudioHin: undefined,
      defaultAudioPath: defaultAudio,
      symbolWords: (sym.words as Record<string, string>),
      labelEng: nextLabelEng,
      labelLoc: nextLabelLoc,
      // Swapping the symbol must not clobber a generated/recorded clip the user
      // committed; only adopt 'default' when nothing is active yet.
      ...(draft.activeAudioSource ? {} : { activeAudioSource: 'default' as const, audioMode: 'default' as const }),
    });
    void currentLang; // retained for readability; per-language handled above
```

(Remove the now-unused IIFE that seeded `labelLoc` and the old `labelEng` conditional.)

- [ ] **Step 2: Label field marks the language dirty**

In `PropertiesPanel.tsx`, **replace** `setLabelField` (~lines 267–270) with:

```typescript
  const setLabelField = (v: string) => {
    const dirty = { ...draft.labelDirty, [labelFieldLang]: v.trim().length > 0 };
    if (labelFieldLang === 'en') patch({ labelEng: v, labelDirty: dirty });
    else patch({ labelLoc: { ...draft.labelLoc, [labelFieldLang]: v }, labelDirty: dirty });
  };
```

- [ ] **Step 3: Add reset copy to `en.json`**

In `messages/en.json`, in the `symbolEditor` namespace, add:

```json
    "labelResetToSymbol": "Reset to \"{word}\"",
    "labelFollowsSymbolHint": "Label and audio follow this symbol.",
```

(Place them near the other `label*` keys. en only.)

- [ ] **Step 4: Render the reset affordance under the label input**

In `PropertiesPanel.tsx`, immediately after the label `<input>`'s closing (inside the label `AccordionSection`, after the `<label>...</label>` wrapper), add:

```tsx
        {(() => {
          const word = (draft.symbolWords[labelFieldLang] ?? '').trim();
          if (!word || labelFieldValue.trim() === word) return null;
          return (
            <button
              type="button"
              onClick={() =>
                labelFieldLang === 'en'
                  ? patch({ labelEng: word, labelDirty: { ...draft.labelDirty, en: false } })
                  : patch({ labelLoc: { ...draft.labelLoc, [labelFieldLang]: word }, labelDirty: { ...draft.labelDirty, [labelFieldLang]: false } })
              }
              className="mt-1 text-theme-xs font-medium text-left"
              style={{ color: 'var(--theme-brand-primary)' }}
            >
              {t('labelResetToSymbol', { word })}
            </button>
          );
        })()}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SymbolStixTab|PropertiesPanel"` → no output.
Run: `npx eslint app/components/app/shared/modals/symbol-editor/SymbolStixTab.tsx app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx` → clean.

- [ ] **Step 6: Browser verification**

On :3000, signed in, create a category with a placeholder "rabbit", open it in edit → the editor. On the SymbolStix tab:
1. Pick "bunny" → label field shows **bunny** (placeholder overwritten). Pick another animal → label follows again.
2. Type "Flopsy" in the label → pick a different symbol → label stays **Flopsy**; a **Reset to "<word>"** link appears; click it → label returns to the symbol word and the link disappears.

Screenshot both states as proof.

- [ ] **Step 7: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/SymbolStixTab.tsx app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx messages/en.json
git commit -m "feat(symbol-editor): label follows symbol on pick unless hand-typed; reset affordance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Audio section — Default follows label; Generate gets its own field

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx` (`handleGenerate` ~152–197; Default tab ~387–407; Generate tab ~410–499)
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` (shared default-resolve helper for preview)
- Modify: `messages/en.json`

**Interfaces:**
- Consumes: `Draft.generateText`, `Draft.symbolWords` (Task 1); `voiceForLanguage`, `personaOf` (already imported in PropertiesPanel).
- Produces: `handleGenerate` synthesises `draft.generateText`; the Generate tab renders a text field; Default tab shows a "speaks the label" hint; a shared `resolveDefaultPlaybackKey()` in the modal resolves the label for Default preview.

- [ ] **Step 1: Add copy to `en.json`**

In `symbolEditor` namespace:

```json
    "audioDefaultFollowsLabel": "Speaks the label above.",
    "audioGenerateTextLabel": "Words to speak",
    "audioGenerateTextPlaceholder": "e.g. television room in our house",
    "audioGenerateNeedsText": "Enter the words to speak, then generate.",
    "saveSuccess": "Saved"
```

- [ ] **Step 2: `handleGenerate` reads `generateText`, not the label**

In `PropertiesPanel.tsx`, **replace** the top of `handleGenerate` (the `genLang`/`text` derivation, ~lines 156–160) with:

```typescript
    const genLang = draft.pinnedLanguage ?? language;
    const text = (draft.generateText ?? '').trim();
```

Leave the rest (`voiceForLanguage`, fetch, the `source === 'symbolstix' && r2Key === draft.defaultAudioPath` branch) unchanged — it already stores nothing when the custom text resolves to this tile's own symbol clip, and stores an override otherwise.

- [ ] **Step 3: Seed `generateText` when the Generate tab is opened**

In `PropertiesPanel.tsx`, find the audio segmented-control button `onClick={() => patch({ audioMode: mode })}` (~line 373). Replace with:

```tsx
                onClick={() => {
                  if (mode === 'generate' && !draft.generateText) {
                    const seed = (labelFieldLang === 'en' ? draft.labelEng : (draft.labelLoc[labelFieldLang] || draft.labelEng)).trim();
                    patch({ audioMode: mode, generateText: seed });
                  } else {
                    patch({ audioMode: mode });
                  }
                }}
```

- [ ] **Step 4: Default tab shows the follow-label hint**

In `PropertiesPanel.tsx`, in the `draft.audioMode === 'default'` block (~387–407), **replace** the hint paragraph text key `audioDefaultHint` with `audioDefaultFollowsLabel`, and remove the "Use default" button (Default now always means follow-label; there is no separate symbol-clip default to re-select). The block becomes:

```tsx
        {draft.audioMode === 'default' && (
          <div className="flex flex-col gap-2">
            <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
              {t('audioDefaultFollowsLabel')}
            </p>
          </div>
        )}
```

- [ ] **Step 5: Generate tab renders its own text field**

In `PropertiesPanel.tsx`, at the top of the `draft.audioMode === 'generate'` block (~410), insert the text field before the existing generate/preview buttons:

```tsx
            <label className="flex flex-col gap-1">
              <span className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                {t('audioGenerateTextLabel')}
              </span>
              <input
                type="text"
                value={draft.generateText ?? ''}
                onChange={(e) => patch({ generateText: e.target.value, generatedAudioPath: undefined })}
                placeholder={t('audioGenerateTextPlaceholder')}
                className="w-full rounded-theme-sm px-3 py-2 text-theme-s outline-none"
                style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)', border: '1px solid var(--theme-button-highlight)' }}
              />
            </label>
```

Then change the generate button's `disabled` guard from `!draft.labelEng.trim()` to `!draft.generateText?.trim()`, and the "needs label" hint key from `audioGenerateNeedsLabel` to `audioGenerateNeedsText` (both occurrences in that block).

- [ ] **Step 6: Shared default-resolve helper in the modal (for preview)**

In `SymbolEditorModal.tsx`, add imports:

```typescript
import { voiceForLanguage, personaOf } from '@/lib/audio/resolveVoiceId';
```

Add a helper inside the component (near `handlePreviewPlay`):

```typescript
  // Resolve the R2 key the Default (follow-label) audio should play/persist for
  // the effective language. Returns the symbol's own clip when the label matches
  // the symbol word; otherwise resolves the label through /api/tts (symbols
  // folder -> tts cache -> generate). No `literal` flag (keep symbols-folder reuse).
  async function resolveDefaultKey(): Promise<string | undefined> {
    const lang = draft.pinnedLanguage ?? language;
    const labelText = (lang === 'en' ? draft.labelEng : (draft.labelLoc[lang] || draft.labelEng)).trim();
    if (!labelText) return undefined;
    const symbolWord = (draft.symbolWords[lang] ?? '').trim();
    if (labelText === symbolWord) return draft.defaultAudioPath; // symbol's own clip
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: labelText, voiceId: voiceForLanguage(lang, personaOf(voiceId)) }),
    });
    if (!res.ok) throw new Error('tts');
    const { r2Key } = (await res.json()) as { r2Key: string };
    return r2Key;
  }
```

Then in `handlePreviewPlay`, change the `activeAudioSource === 'default'` branch to resolve on demand:

```typescript
    if (draft.activeAudioSource === 'default') {
      resolveDefaultKey()
        .then((key) => { if (key) { const a = new Audio(`/api/assets?key=${key}`); previewAudioRef.current = a; setIsPreviewPlaying(true); a.addEventListener('ended', () => setIsPreviewPlaying(false)); a.addEventListener('error', () => setIsPreviewPlaying(false)); a.play().catch(() => setIsPreviewPlaying(false)); } })
        .catch(() => setIsPreviewPlaying(false));
      return;
    }
```

(Leave the `generate`/`record` branches of `handlePreviewPlay` as they are.)

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "PropertiesPanel|SymbolEditorModal"` → no output.
Run: `npx eslint app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` → clean.

- [ ] **Step 8: Browser verification**

On :3000: open a symbol on Default → hint reads "Speaks the label above."; press the preview play in the status banner → audio plays. Change the label to a different real word → preview plays the new word (silent resolve). Switch to Generate → the text field appears seeded from the label; type "television room in our house", Generate, preview → hears the custom phrase. Screenshot the Generate tab with its field.

- [ ] **Step 9: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx messages/en.json
git commit -m "feat(symbol-editor): Default follows label; Generate gets its own text field

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Save — per-language resolve, block-on-failure, success flash

**Files:**
- Modify: `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` (categoryBoard branch of `handleSave`, ~648–824; add `saveSuccess` state)

**Interfaces:**
- Consumes: `planFollowLabelAudio` (Task 1), `resolveDefaultKey` (Task 4), `draft.audioMode`, `draft.generateText`, `draft.symbolWords`, `draft.defaultAudioPath`.
- Produces: on save, the effective language's audio is stored/deleted per the model; TTS failure blocks the save (editor stays open); success flashes "Saved" then closes.

- [ ] **Step 1: Add success state**

Near the other `useState` calls in `SymbolEditorModal.tsx`, add:

```typescript
  const [saveSuccess, setSaveSuccess] = useState(false);
```

- [ ] **Step 2: Replace the audio-building block in the categoryBoard save branch**

In `handleSave`'s categoryBoard branch, **replace** the audio override construction (the `type AR = {...}`, `audioLang`, `prevAudio`, `nextAudio`, `genOrRecPath`, the `if (genOrRecPath) {...} else {...}`, and the `const audio = ...` — currently ~702–741) with:

```typescript
      type AR = {
        type: 'r2' | 'tts' | 'recorded';
        path: string;
        ttsText?: string;
        language?: string;
        alternates?: { default?: string; generated?: string; recorded?: string };
      };
      const audioLang = draft.pinnedLanguage ?? language;
      const prevAudio = (existingSymbol?.audio as Record<string, AR> | undefined) ?? {};
      const nextAudio: Record<string, AR> = { ...prevAudio };

      // Resolve THIS language's audio per the selected tab. Other languages'
      // overrides are preserved untouched (per-language forks). A TTS failure
      // throws and is caught below, blocking the save.
      if (draft.audioMode === 'record' && recordedAudioPath) {
        nextAudio[audioLang] = { type: 'recorded', path: recordedAudioPath, language: audioLang };
      } else if (draft.audioMode === 'generate' && draft.generateText?.trim()) {
        const genVoiceId = voiceForLanguage(audioLang, personaOf(voiceId));
        const res = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: draft.generateText.trim(), voiceId: genVoiceId }),
        });
        if (!res.ok) throw new Error('tts');
        const { r2Key } = (await res.json()) as { r2Key: string };
        const plan = planFollowLabelAudio({ language: audioLang, resolvedPath: r2Key, symbolDefaultPath: draft.defaultAudioPath, spokenText: draft.generateText.trim() });
        if (plan.action === 'store') nextAudio[audioLang] = plan.entry; else delete nextAudio[audioLang];
      } else {
        // Default -> follow the label.
        const key = await resolveDefaultKey(); // throws on TTS failure
        const labelText = (audioLang === 'en' ? draft.labelEng : (draft.labelLoc[audioLang] || draft.labelEng)).trim();
        if (!key || !labelText) {
          delete nextAudio[audioLang];
        } else {
          const plan = planFollowLabelAudio({ language: audioLang, resolvedPath: key, symbolDefaultPath: draft.defaultAudioPath, spokenText: labelText });
          if (plan.action === 'store') nextAudio[audioLang] = plan.entry; else delete nextAudio[audioLang];
        }
      }
      const audio: Record<string, AR> | undefined =
        Object.keys(nextAudio).length ? nextAudio : undefined;
```

Add the import for `planFollowLabelAudio` to the existing `audioLogic` import line:

```typescript
import { deriveAudioMode, initLabelDirty, planFollowLabelAudio, type StoredAudioEntry } from './audioLogic';
```

- [ ] **Step 3: Success flash then close**

In `handleSave`, after `onSave(savedId);` **replace** the immediate `onClose();` (categoryBoard branch) with:

```typescript
      onSave(savedId);
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); onClose(); }, 700);
```

Guard the timeout against unmount: in the unmount cleanup effect (`useEffect(() => { return () => {...}; }, [])`), no change needed since `onClose` is idempotent; but ensure `isSaving` stays true through the flash by moving `setIsSaving(false)` out of the success path — leave the `finally { setIsSaving(false); }` as-is (it runs immediately; acceptable — the button shows "Saved" via `saveSuccess`).

- [ ] **Step 4: Save button reflects saving / saved**

In the Save `<button>` (~950), change its label expression to:

```tsx
                {isSaving ? t('saving') : saveSuccess ? t('saveSuccess') : t('save')}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "SymbolEditorModal"` → no output.
Run: `npx eslint app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` → clean.

- [ ] **Step 6: Browser + data verification**

On :3000, en board:
1. Edit a tile whose label == symbol word, save → button flashes "Saved", closes. Confirm no override: `npx convex run profileCategories:getProfileSymbols '{"profileCategoryId":"<catId>"}'` → that tile's `audio` is `null`.
2. Change the label to a different word, save → `audio.en` is a `tts` entry with `ttsText` == the new label.
3. Reset the label back to the symbol word, save → `audio.en` gone again.
4. Simulate failure: with DevTools offline (or block `/api/tts`), diverge a label and save → button does NOT close; inline error shows; re-query confirms nothing persisted.

- [ ] **Step 7: Commit**

```bash
git add app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx
git commit -m "feat(symbol-editor): resolve audio to label on save; block on TTS failure

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: End-to-end verification + FEAT-007 close-out

**Files:**
- Modify: `docs/4-builds/features/FEAT-007-audio-language-switching.md`

- [ ] **Step 1: Cross-language regression sweep (browser)**

On :3000, exercise the acceptance criteria from the spec §8:
1. **Defaults unchanged** — an untouched default tile stores no override; plays the symbol clip in en/es/hi.
2. **Diverge on en only** — es/hi still speak their own words; en speaks the label; nothing mis-speaks. Switch the board language between en/es/hi and tap.
3. **Custom Generate** — "television room in our house" spoken while label shows "TV room"; reopen shows the custom text in the Generate field (Default vs Generate derivation from Task 2).
4. **Record isolation** — record a clip, then edit the label; the recording survives.
5. **Reset** — reset restores the caption and the symbol's default audio.

Capture screenshots / `convex run` dumps as evidence for 1–3.

- [ ] **Step 2: Mark F-1 resolved in FEAT-007**

In `docs/4-builds/features/FEAT-007-audio-language-switching.md`:
- §8 F-1 **Status:** change to `✅ Resolved (audio-follows-label redesign)`.
- §7 audit table, Symbol-editor row: change `⏳ open gap` note to `✅ audio follows label (Default) / decoupled text (Generate)`.
- §3/§4: add a one-line note that Default audio now resolves the label (per-language `tts` override when diverged; none when it matches the symbol word).

- [ ] **Step 3: Commit**

```bash
git add docs/4-builds/features/FEAT-007-audio-language-switching.md
git commit -m "docs(feat-007): mark F-1 resolved by audio-follows-label redesign

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Move the plan to _done and push**

```bash
git mv docs/4-builds/plans/audio-follows-label-editor-redesign-plan.md docs/4-builds/plans/_done/audio-follows-label-editor-redesign-plan.md
git commit -m "chore(plans): retire audio-follows-label plan to _done

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin HEAD
```

---

## Self-Review notes

- **Spec coverage:** §2 model → Tasks 3/4/5; §3 label + dirty + reset → Task 3; §4 preview vs render → Task 4 (`resolveDefaultKey`) + Task 5 (persist at save); §5 save + block-on-failure → Task 5; §6 reopen derivation + `ttsText` → Tasks 1/2; §7 FEAT-007 → Task 6; §8 acceptance → Task 6; §9 out-of-scope (no always-on spoken-text field; the field lives only in the Generate tab) respected.
- **`literal` flag:** never passed by `resolveDefaultKey`, `handleGenerate`, or the save resolve — symbols-folder reuse preserved (Global Constraints).
- **No schema change** — all audio stored via the existing `audioSourceValidator` (`ttsText`, `language`).
- **Type consistency:** `deriveAudioMode` / `initLabelDirty` / `planFollowLabelAudio` signatures match their Task-1 definitions and their call sites in Tasks 2/5.
