# Phase 24 — Auto-match symbols in the create-sentence modal (MOS-13)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Auto-match" checkbox to the right of the create-sentence name input that splits the typed sentence into words and pre-fills the sentence's slot strip with each word's top symbol-search hit, in order.

**Architecture:** The auto-match search contract moves out of `lib/categories/` into a neutral `lib/symbols/` home (it is no longer category-specific) and its `SearchHit` gains `imagePath`. A new pure module `lib/sentences/autoMatchSlots.ts` turns typed text into `{ order, imagePath? }` slot specs using only the `search` half of that contract — fluent sentences speak the whole utterance, so there is no per-slot TTS. `SentencesModeContent.handleCreate` resolves the slots *before* calling `createProfileSentence`, which already accepts `slots[]`, so there is no schema or Convex change.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4

**Spec:** `docs/superpowers/specs/2026-08-16-sentence-auto-match-design.md`
**Precedent:** `docs/4-builds/plans/_done/phase-17-auto-match-symbols-plan.md` (the categories/lists equivalent)

## Global Constraints

- **No test runner exists in this repo, and you must not add one.** Per-task gate is `npx tsc --noEmit -p tsconfig.json` filtered to the touched files, `npx eslint <files>`, then browser verification.
- **`tsc` has 4 pre-existing unrelated errors** — three stale `.next/types/validator.ts` module-not-found entries and one `lib/stripe.ts` API-version mismatch. Never expect a clean exit; always grep for the files you touched and expect **no output**.
- **Dev server is already running on http://localhost:3000.** Do **not** run `npm run dev`.
- **Never run `npx convex dev`.** Verify Convex-facing types with `npx tsc -p convex/tsconfig.json`.
- **Browser verification uses signed-in Chrome** (the `claude-in-chrome` tools), not the in-app browser — the app requires a Clerk session.
- **UI copy:** never hard-code strings. Every key goes in **`messages/en.json` only** — never hand-add to `hi.json`/`es.json` (the pipeline skips keys that already have a value and would ship the placeholder forever).
- **Theme tokens only:** no hard-coded colours, radii, spacing, or font sizes. Use `--theme-*` vars and `text-theme-*` / `rounded-theme-*` utilities.
- **Work on `main`.** Do not create a branch.
- Commit after each task.

---

### Task 1: Move the shared auto-match contract to `lib/symbols/`

`SearchHit` and `AutoMatchDeps` currently live in `lib/categories/autoMatchSymbols.ts`, but sentences need them too. Move just those two types to a neutral home and add `imagePath` to the hit. `buildCreateSymbols`, `AudioOverride`, and `CreateSymbolSpec` stay where they are — they are genuinely category-only.

**Take extra care with the two category importers** (`useCreateCategory`, `useAddSymbolsToCategory`). Both are live paths — category creation and add-list-to-core-words — and both must be re-verified in the browser at the end of this task, not just type-checked.

**Files:**
- Create: `lib/symbols/autoMatchDeps.ts`
- Create: `app/lib/symbols/useAutoMatchDeps.ts`
- Delete: `app/lib/categories/useAutoMatchDeps.ts`
- Modify: `lib/categories/autoMatchSymbols.ts:1-31` (header + type block)
- Modify: `app/lib/categories/useCreateCategory.ts:8` (import line)
- Modify: `app/lib/categories/useAddSymbolsToCategory.ts:8` (import line)

**Interfaces:**
- Consumes: `api.symbols.searchSymbols` (Convex query — returns full symbol docs, each with `_id`, `words`, `imagePath`), `voiceForLanguage` from `@/lib/audio/resolveVoiceId`.
- Produces: `SearchHit` (`{ _id: Id<'symbols'>; words: Record<string, string>; imagePath: string }`) and `AutoMatchDeps` (`{ search(term, language): Promise<SearchHit | null>; resolveTts(text, language): Promise<string | null> }`) from `@/lib/symbols/autoMatchDeps`; the hook `useAutoMatchDeps(): AutoMatchDeps` from `@/app/lib/symbols/useAutoMatchDeps`. Tasks 2 and 4 both import from these paths.

---

- [ ] **Step 1: Create the shared contract module**

Create `lib/symbols/autoMatchDeps.ts`:

```ts
// The search + TTS contract every auto-match builder needs. Lives here rather
// than under `lib/categories/` because it is not category-specific: categories,
// core-word lists (`lib/categories/autoMatchSymbols.ts`) and sentences
// (`lib/sentences/autoMatchSlots.ts`) all resolve a typed word to its top hit.
// The concrete implementation is injected by `app/lib/symbols/useAutoMatchDeps.ts`
// so the builders stay pure.
import type { Id } from '@/convex/_generated/dataModel';

export type SearchHit = {
  _id: Id<'symbols'>;
  words: Record<string, string>;
  // R2 path of the SymbolStix artwork. Always present on a symbol row
  // (`symbols.imagePath` is `v.string()`); sentence slots store it directly,
  // where categories go via `symbolId` and let the mutation resolve it.
  imagePath: string;
};

export type AutoMatchDeps = {
  // Top hit for a word in the given language, or null if none.
  search: (term: string, language: string) => Promise<SearchHit | null>;
  // Resolve spoken text to an R2 key via /api/tts, or null on failure.
  resolveTts: (text: string, language: string) => Promise<string | null>;
};
```

- [ ] **Step 2: Strip the moved types out of the categories builder**

In `lib/categories/autoMatchSymbols.ts`, replace lines 1–31 (the header comment, the `Id` import, and the `SearchHit` / `AudioOverride` / `CreateSymbolSpec` / `AutoMatchDeps` type block) with:

```ts
// Turn create-modal rows into ordered symbol specs for createProfileCategory.
// For an auto-match row, look up the word's top SymbolStix hit and (per phase-16
// audio-follows-label) attach a tts override only when the typed word differs
// from the symbol's own word for the board language. Pure orchestration — the
// caller injects the Convex search and the /api/tts resolve.
import type { Id } from '@/convex/_generated/dataModel';
import type { AutoMatchDeps } from '@/lib/symbols/autoMatchDeps';

export type AudioOverride = {
  type: 'tts';
  path: string;
  ttsText: string;
  language: string;
};

export type CreateSymbolSpec = {
  label: Record<string, string>;
  symbolId?: Id<'symbols'>;
  audio?: Record<string, AudioOverride>;
};
```

Leave `buildCreateSymbols` (from `export async function buildCreateSymbols` to end of file) **completely untouched** — it already references `AutoMatchDeps` by name, which now resolves to the import.

- [ ] **Step 3: Create the hook at its new path**

Create `app/lib/symbols/useAutoMatchDeps.ts`:

```ts
"use client";

import { useConvex } from 'convex/react';
import { useMemo } from 'react';
import { api } from '@/convex/_generated/api';
import { voiceForLanguage } from '@/lib/audio/resolveVoiceId';
import type { AutoMatchDeps, SearchHit } from '@/lib/symbols/autoMatchDeps';

/**
 * The search + TTS resolvers the auto-match builders need to match a typed word
 * to its top SymbolStix hit. Shared by every host that turns typed words into
 * content: create-category, add-list-to-core-words, and create-sentence.
 *
 * `limit: 1` gives the same first result the search page shows — the exact
 * whole-word boost in `convex/symbols.ts:searchSymbols` runs either way, so
 * short function words ("is", "go") resolve to their canonical symbol rather
 * than a longer prefix match.
 */
export function useAutoMatchDeps(): AutoMatchDeps {
  const convex = useConvex();
  return useMemo<AutoMatchDeps>(() => ({
    search: async (term, lang): Promise<SearchHit | null> => {
      const results = await convex.query(api.symbols.searchSymbols, {
        searchTerm: term, language: lang, limit: 1,
      });
      const first = results?.[0];
      return first
        ? { _id: first._id, words: first.words, imagePath: first.imagePath }
        : null;
    },
    resolveTts: async (text, lang): Promise<string | null> => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceId: voiceForLanguage(lang) }),
        });
        if (!res.ok) return null;
        const { r2Key } = (await res.json()) as { r2Key: string };
        return r2Key ?? null;
      } catch {
        return null;
      }
    },
  }), [convex]);
}
```

- [ ] **Step 4: Delete the old hook**

```bash
git rm app/lib/categories/useAutoMatchDeps.ts
```

- [ ] **Step 5: Repoint the two category importers**

In **`app/lib/categories/useCreateCategory.ts`**, change line 8 from:

```ts
import { useAutoMatchDeps } from '@/app/lib/categories/useAutoMatchDeps';
```

to:

```ts
import { useAutoMatchDeps } from '@/app/lib/symbols/useAutoMatchDeps';
```

In **`app/lib/categories/useAddSymbolsToCategory.ts`**, change line 8 the exact same way. Leave every other line in both files alone — the `buildCreateSymbols` import on line 7 still points at `@/lib/categories/autoMatchSymbols`, which is correct.

- [ ] **Step 6: Verify no stale references remain**

```bash
rg -n "app/lib/categories/useAutoMatchDeps" --glob '!node_modules' --glob '!docs'
```

Expected: **no output**. If anything matches, repoint it before continuing.

- [ ] **Step 7: Type-check the touched files**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "autoMatchDeps|autoMatchSymbols|useAutoMatchDeps|useCreateCategory|useAddSymbolsToCategory"
```

Expected: **no output**. (The 4 pre-existing unrelated errors are filtered out by the grep — see Global Constraints.)

- [ ] **Step 8: Lint the touched files**

```bash
npx eslint lib/symbols/autoMatchDeps.ts lib/categories/autoMatchSymbols.ts app/lib/symbols/useAutoMatchDeps.ts app/lib/categories/useCreateCategory.ts app/lib/categories/useAddSymbolsToCategory.ts
```

Expected: no errors.

- [ ] **Step 9: Browser regression — the two live category paths**

This step is the reason the task exists as its own gate. In signed-in Chrome on **http://localhost:3000**:

1. **Categories page → "New category".** Type a name, type 3 words (e.g. `apple`, `dog`, `run`), tick auto-match on all three, Create. Expected: the category opens with all three symbols showing SymbolStix artwork and their labels — identical to before the move.
2. **Talker dropbar → "Add a list" into core words.** Type 2 words, tick auto-match, submit. Expected: both symbols appear in the core-words grid with artwork.

If either fills blanks where it used to fill artwork, the move broke `search` — check that `imagePath` is being read off the raw Convex doc in the hook.

- [ ] **Step 10: Commit**

```bash
git add lib/symbols/autoMatchDeps.ts app/lib/symbols/useAutoMatchDeps.ts lib/categories/autoMatchSymbols.ts app/lib/categories/useCreateCategory.ts app/lib/categories/useAddSymbolsToCategory.ts
git commit -m "refactor(symbols): move the auto-match contract to lib/symbols

SearchHit + AutoMatchDeps are no longer category-specific — sentences are
about to use them. SearchHit gains imagePath (always present on a symbol
row) so a consumer can fill an image-only slot without a second lookup.

buildCreateSymbols and the category-only spec types stay put.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The pure slot builder

A pure module that turns typed sentence text into ordered slot specs. No React, no Convex — the search is injected, mirroring why `buildCreateSymbols` is structured the way it is.

Note the signature takes `Pick<AutoMatchDeps, 'search'>`, not the whole contract. That is deliberate: a fluent sentence speaks the whole utterance through one clip, so there is no per-slot text to voice and `resolveTts` is genuinely not needed here. The type says so rather than accepting a dependency it ignores.

**Files:**
- Create: `lib/sentences/autoMatchSlots.ts`

**Interfaces:**
- Consumes: `AutoMatchDeps` from `@/lib/symbols/autoMatchDeps` (Task 1).
- Produces: `SlotSpec` (`{ order: number; imagePath?: string }`), `splitSentenceWords(text: string, max?: number): string[]`, and `buildSentenceSlots(text: string, language: string, deps: Pick<AutoMatchDeps, 'search'>): Promise<SlotSpec[]>`. Task 4 calls `buildSentenceSlots`.

---

- [ ] **Step 1: Create the module**

Create `lib/sentences/autoMatchSlots.ts`:

```ts
// Turn a typed sentence into ordered image-only slots for createProfileSentence.
//
// Sentences made in the create modal are FLUENT: their strip is `slots[]`, which
// carry an imagePath and nothing else (no label, no audio) — the whole utterance
// is spoken by one sentence-level clip. So this resolves an image per word and
// never touches TTS, which is why it takes only the `search` half of the deps.
// Contrast `lib/categories/autoMatchSymbols.ts`, where each symbol is its own
// speakable tile and needs audio-follows-label.
//
// Pure orchestration — the caller injects the Convex search.
import type { AutoMatchDeps } from '@/lib/symbols/autoMatchDeps';

export type SlotSpec = {
  order: number;
  imagePath?: string;
};

/** Max slots one auto-match run creates. The sentence name keeps every word. */
const MAX_SLOTS = 30;

/**
 * Split a sentence into searchable words: whitespace-separated, with leading and
 * trailing punctuation stripped ("home." → "home", "(hello)" → "hello").
 *
 * Inner punctuation is deliberately kept, so contractions and hyphenated words
 * stay whole ("don't", "sit-down") — they are single searchable words, and
 * splitting them would produce meaningless tiles. Tokens that strip to nothing
 * (a lone "—") are dropped. Unicode-aware, so Hindi and Spanish text survive.
 */
export function splitSentenceWords(text: string, max: number = MAX_SLOTS): string[] {
  return text
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/[^\p{L}\p{N}]+$/u, ''),
    )
    .filter((word) => word.length > 0)
    .slice(0, max);
}

/**
 * One slot per word, in order, each carrying its top search hit's artwork.
 *
 * A word with no hit — or whose search throws — yields a slot with no imagePath:
 * the blank tile the instructor taps to fill. Never a MISSING slot. Tile
 * positions have to stay aligned with the words of the sentence, because a
 * fluent slot has no label of its own and position is the only thing that tells
 * you which word a blank belongs to.
 *
 * Lookups fan out in parallel and are caught individually, so one failed word
 * can't collapse the rest of the row.
 */
export async function buildSentenceSlots(
  text: string,
  language: string,
  deps: Pick<AutoMatchDeps, 'search'>,
): Promise<SlotSpec[]> {
  const words = splitSentenceWords(text);
  return Promise.all(
    words.map(async (word, order): Promise<SlotSpec> => {
      try {
        const hit = await deps.search(word, language);
        return hit ? { order, imagePath: hit.imagePath } : { order };
      } catch {
        return { order };
      }
    }),
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "autoMatchSlots"
```

Expected: **no output**.

- [ ] **Step 3: Lint**

```bash
npx eslint lib/sentences/autoMatchSlots.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/sentences/autoMatchSlots.ts
git commit -m "feat(sentences): pure builder for auto-matched sentence slots

Splits typed text into words (trailing punctuation stripped, contractions
and hyphens kept whole) and resolves each to its top hit's artwork.

Unmatched and failed words keep a blank slot rather than being skipped —
fluent slots have no label, so position is the only thing tying a tile
back to its word.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The checkbox in the create-sentence modal

Add the affordance and its copy. The checkbox is opt-in via `showAutoMatch` so the talker dropbar's "Create Phrase" reuse of this modal is untouched — phrases store `words[]` with per-word labels and clips, which this fill does not produce.

`onCreate` widens to `(name, autoMatch)`. This does **not** break either caller: a function declared with fewer parameters is assignable to a wider signature in TypeScript, so `handleCreatePhrase(name: string)` in `TalkerDropdown` stays valid with no edit.

After this task the checkbox renders and reports its state, but the sentences page still ignores the flag — the strip stays empty. Task 4 wires it. That split is intentional: the UI and the fill are separately reviewable.

**Files:**
- Modify: `messages/en.json` (the `sentences` block)
- Modify: `app/components/app/sentences/modals/CreateSentenceModal.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces: `CreateSentenceModal` prop `showAutoMatch?: boolean` (default `false`) and the widened `onCreate: (name: string, autoMatch: boolean) => Promise<void>`. Task 4 passes `showAutoMatch` and reads the second argument.

---

- [ ] **Step 1: Add the copy keys**

In `messages/en.json`, inside the **`sentences`** object, add these three keys next to the existing `createModalCreate`:

```json
"createModalAutoMatch": "Auto-match",
"createModalAutoMatchAria": "Auto-match each word to a symbol",
"createModalAutoMatching": "Auto-matching your words…"
```

**`en.json` only.** Do not add them to `hi.json` or `es.json` — `i18n/request.ts` merges each locale over `en.json`, and the translation pipeline only translates keys that are *absent* from a locale.

- [ ] **Step 2: Verify the JSON still parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Widen the props**

In `app/components/app/sentences/modals/CreateSentenceModal.tsx`, replace the `Props` type (lines 12–21) with:

```tsx
type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, autoMatch: boolean) => Promise<void>;
  // Show the auto-match checkbox. Off by default: the talker dropbar reuses this
  // modal for "Create Phrase", and a phrase stores words[] with per-word labels
  // and clips — a different shape this fill doesn't produce.
  showAutoMatch?: boolean;
  // Optional copy overrides — default to the sentence strings. The talker
  // dropbar reuses this modal for "Create Phrase" and passes phrase copy.
  title?: string;
  nameLabel?: string;
  placeholder?: string;
};
```

- [ ] **Step 4: Add the checkbox state and widen the submit**

Replace the component signature and the `reset` / `handleSubmit` block (lines 23–44) with:

```tsx
export function CreateSentenceModal({ isOpen, onClose, onCreate, showAutoMatch = false, title, nameLabel, placeholder }: Props) {
  const t = useTranslations('sentences');
  const [name, setName] = useState('');
  const [autoMatch, setAutoMatch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  function reset() {
    setName('');
    setAutoMatch(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, autoMatch);
      reset();
      onClose();
    } finally {
      setIsCreating(false);
    }
  }
```

Leave `handleOpenChange` below it unchanged — it already calls `reset()`.

- [ ] **Step 5: Widen the dialog**

Change line 55 from:

```tsx
      <DialogContent className="max-w-sm">
```

to:

```tsx
      <DialogContent className="max-w-md">
```

(`CreateListModal` is already `max-w-md`; `max-w-sm` would squeeze the input once the checkbox sits beside it.)

- [ ] **Step 6: Put the checkbox to the right of the input**

Replace the input block (lines 65–77, the `<input type="text" …/>` element) with an input-plus-checkbox row:

```tsx
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder ?? t('createModalNamePlaceholder')}
                autoFocus
                className="flex-1 min-w-0 px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                style={{
                  background: 'var(--theme-symbol-bg)',
                  color: 'var(--theme-text)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
              {/* Auto-match: fills one image-only slot per word from each word's
                  top search hit. Styling matches SymbolListFields' select-all. */}
              {showAutoMatch && (
                <label
                  className="flex items-center gap-2 text-theme-xs cursor-pointer shrink-0"
                  style={{ color: 'var(--theme-secondary-text)' }}
                >
                  {t('createModalAutoMatch')}
                  <input
                    type="checkbox"
                    checked={autoMatch}
                    onChange={(e) => setAutoMatch(e.target.checked)}
                    aria-label={t('createModalAutoMatchAria')}
                    className="w-6 h-6 shrink-0 accent-[var(--theme-brand-primary)] cursor-pointer"
                  />
                </label>
              )}
            </div>
```

Note the input's class changed from `w-full` to `flex-1 min-w-0` so it shares the row.

- [ ] **Step 7: Show the auto-matching label while it runs**

Change line 95 (the submit button's children) from:

```tsx
              {isCreating ? t('creating') : t('createModalCreate')}
```

to:

```tsx
              {isCreating
                ? (autoMatch ? t('createModalAutoMatching') : t('creating'))
                : t('createModalCreate')}
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "CreateSentenceModal|SentencesModeContent|TalkerDropdown"
```

Expected: **no output**. (Both callers pass a 1-parameter `onCreate`, which stays assignable to the 2-parameter type — no error is expected from either.)

- [ ] **Step 9: Lint**

```bash
npx eslint app/components/app/sentences/modals/CreateSentenceModal.tsx
```

Expected: no errors.

- [ ] **Step 10: Browser check**

In signed-in Chrome on **http://localhost:3000**:

1. Sentences page → create button. Expected: **no checkbox yet** (`showAutoMatch` isn't passed until Task 4), dialog is wider, creating a sentence still works exactly as before.
2. Talker dropbar → "Create Phrase". Expected: no checkbox, phrase creation unchanged.

- [ ] **Step 11: Commit**

```bash
git add messages/en.json app/components/app/sentences/modals/CreateSentenceModal.tsx
git commit -m "feat(sentences): auto-match checkbox in the create-sentence modal

Opt-in via showAutoMatch so the talker's Create Phrase reuse is untouched.
Unticked on open and reset on close, so create is unchanged for anyone who
ignores it. Wiring lands next.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the fill into sentence creation

Resolve the slots **before** the create mutation so the sentence never exists in a half-filled state, then pass them straight through — `createProfileSentence` already accepts `slots[]` and its `displayProps` is optional, so `{ order, imagePath }` validates as-is. No schema or Convex change.

**There are three callers of `CreateSentenceModal`, not two.** Besides the Sentences page and the talker dropbar, the **Home page's quick-create card** opens it too. Home's create-a-list and create-a-category cards already auto-match, so leaving its sentence card out would make it the only one of the three that doesn't — it gets the same wiring. The talker's Create Phrase stays untouched.

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (imports; the hook call near `createSentence` at ~line 822; `handleCreate` at ~line 924; the `<CreateSentenceModal>` usage at ~line 1376)
- Modify: `app/components/app/home/sections/HomeContent.tsx` (imports; hook call near `createSentence` at ~line 64; `handleCreateSentence` at ~line 107; the `<CreateSentenceModal>` usage at ~line 149)

**Interfaces:**
- Consumes: `buildSentenceSlots` from `@/lib/sentences/autoMatchSlots` (Task 2), `useAutoMatchDeps` from `@/app/lib/symbols/useAutoMatchDeps` (Task 1), `showAutoMatch` on `CreateSentenceModal` (Task 3).
- Produces: nothing downstream — this is the last task.

---

- [ ] **Step 1: Add the imports**

In `app/components/app/sentences/sections/SentencesModeContent.tsx`, add these two lines to the import block, next to the existing `CreateSentenceModal` import (~line 57):

```tsx
import { buildSentenceSlots } from '@/lib/sentences/autoMatchSlots';
import { useAutoMatchDeps } from '@/app/lib/symbols/useAutoMatchDeps';
```

- [ ] **Step 2: Call the hook**

Immediately after the `createSentence` mutation line (~line 822):

```tsx
  const createSentence   = useMutation(api.profileSentences.createProfileSentence);
```

add:

```tsx
  // MOS-13 — search resolver for the create modal's auto-match checkbox.
  const autoMatchDeps    = useAutoMatchDeps();
```

It must sit at component top level with the other hooks, not inside `handleCreate`.

- [ ] **Step 3: Fill the slots in `handleCreate`**

Replace `handleCreate` (~lines 924–937) in full with:

```tsx
  async function handleCreate(name: string, autoMatch: boolean) {
    // MOS-13 — auto-match: one image-only slot per word, in order, each carrying
    // its top search hit's artwork (unmatched words keep a blank slot so tiles
    // stay aligned with the text). Resolved BEFORE the create so the sentence is
    // never persisted half-filled, and so a slow search shows on the button
    // rather than as a sentence that fills in late.
    const slots = autoMatch
      ? await buildSentenceSlots(name, language, autoMatchDeps)
      : undefined;
    // Phase 15: key the name by the CURRENT board language (you're authoring in it),
    // and stamp authoredLanguage — consistent with the talker save. The old hardcoded
    // `en` mislabelled every created sentence as English regardless of board.
    await createSentence({
      name: { [language]: name },
      authoredLanguage: language,
      ...(realFolderId ? { folderId: realFolderId } : {}),
      ...(slots ? { slots } : {}),
    });
    // Drop straight into edit mode so the new sentence's empty slots and
    // audio affordances are visible immediately — same pattern as list
    // creation, just no navigation since sentences live inline on this page.
    setIsEditing(true);
  }
```

The board `language` is both the search language and the stamped `authoredLanguage` — auto-match matches words in whatever language the board is in.

- [ ] **Step 4: Turn the checkbox on for this host**

At the `<CreateSentenceModal>` usage (~line 1376), add the prop:

```tsx
      <CreateSentenceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
        showAutoMatch
      />
```

- [ ] **Step 5: Do the same for the Home quick-create card**

In `app/components/app/home/sections/HomeContent.tsx`, add the same two imports to the import block (~line 17):

```tsx
import { buildSentenceSlots } from "@/lib/sentences/autoMatchSlots";
import { useAutoMatchDeps } from "@/app/lib/symbols/useAutoMatchDeps";
```

After the `createSentence` mutation line (~line 64), add the hook:

```tsx
  // MOS-13 — search resolver for the create-sentence card's auto-match checkbox.
  const autoMatchDeps = useAutoMatchDeps();
```

Replace `handleCreateSentence` (~lines 107–113) in full with:

```tsx
  async function handleCreateSentence(name: string, autoMatch: boolean) {
    // MOS-13 — auto-match: one image-only slot per word, resolved BEFORE the
    // create so the sentence is never persisted half-filled. Brings this card
    // in line with the create-a-list and create-a-category cards beside it,
    // which already auto-match.
    const slots = autoMatch
      ? await buildSentenceSlots(name, language, autoMatchDeps)
      : undefined;
    // Key the name by the CURRENT board language (you're authoring in it) and
    // stamp authoredLanguage — consistent with the Sentences-page + talker saves
    // (ADR-016). Hardcoding `en` mislabelled every quick-created sentence.
    await createSentence({
      name: { [language]: name },
      authoredLanguage: language,
      ...(slots ? { slots } : {}),
    });
    router.push(`/${locale}/sentences`);
  }
```

Note Home resolves its list auto-match with an inline `convex.query(...)`; **do not copy that pattern** — use `buildSentenceSlots` + `useAutoMatchDeps` so both sentence hosts share one implementation.

Then add the prop to the `<CreateSentenceModal>` usage (~line 149):

```tsx
      <CreateSentenceModal
        isOpen={sentenceOpen}
        onClose={() => setSentenceOpen(false)}
        onCreate={handleCreateSentence}
        showAutoMatch
      />
```

Leave the `<CreateListModal>` and `<CreateCategoryModal>` usages above it alone.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SentencesModeContent|HomeContent|autoMatchSlots|useAutoMatchDeps"
```

Expected: **no output**.

- [ ] **Step 7: Lint**

```bash
npx eslint app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/home/sections/HomeContent.tsx
```

Expected: no errors.

- [ ] **Step 8: Browser verification — the full table**

In signed-in Chrome on **http://localhost:3000**, Sentences page. Create each of these and check the strip that results. Delete each test sentence after checking it.

| Typed into the modal | Tick? | Expected |
|---|---|---|
| `I want to go home` | yes | 5 tiles with artwork, in word order; page drops into edit mode |
| `I want to go home.` | yes | Still 5 tiles — the trailing `.` is stripped, there is no 6th tile |
| `don't sit-down now` | yes | 3 tiles — contraction and hyphen searched whole |
| `I want zzzqx now` | yes | 4 tiles, the 3rd blank, the rest filled |
| A 35-word sentence | yes | Exactly 30 tiles; the sentence text below still shows all 35 words |
| `I want to go home` | no | No tiles at all — today's behaviour |

Then confirm the checkbox resets: create one with it ticked, reopen the modal, and check it is unticked again.

Then the **Home page** quick-create card: create a sentence with the box ticked. Expected: the checkbox is present, and after the redirect to `/sentences` the new sentence's strip is filled (you may need to enter edit mode to see the tiles — Home routes without `?edit=1`).

Finally, talker dropbar → "Create Phrase": still no checkbox, phrase creation unchanged.

- [ ] **Step 9: Commit**

```bash
git add app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/home/sections/HomeContent.tsx
git commit -m "feat(sentences): fill the slot strip from the sentence text (MOS-13)

Ticking auto-match resolves each word's top search hit before the create
mutation, so the new sentence lands in edit mode with its strip already
populated instead of needing a symbol picked per word by hand.

Wired on both hosts that create sentences — the Sentences page and the Home
quick-create card, which already auto-matched lists and categories.

Slots resolve in the board language, which is also the stamped
authoredLanguage.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done criteria

- Ticking auto-match on the Sentences create modal produces one tile per word, in order, with artwork where a symbol matched and a blank tile where none did.
- Unticked create is byte-for-byte the old behaviour.
- The talker dropbar's "Create Phrase" modal shows no checkbox and behaves exactly as before.
- Category creation and add-list-to-core-words still auto-match symbols *and* audio (the file-move regression check).
- `npx tsc --noEmit -p tsconfig.json` reports nothing beyond the 4 known pre-existing errors.

## Follow-ups (explicitly out of scope)

- Auto-matching phrase `words[]` in the talker dropbar.
- Building `units[]` word blocks from the create modal (would change fluent → sequence playback).
- Any preview or confirm step before the write.
- Persisting the checkbox state across sessions.
