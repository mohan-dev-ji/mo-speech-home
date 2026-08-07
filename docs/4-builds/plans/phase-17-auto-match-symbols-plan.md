# Auto-match Symbols on Create Category — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher tick words in the Create Category modal to auto-match each to its top SymbolStix result, producing fully-formed symbols (correct image + label + audio-follows-label), while the fast placeholder flow stays the default.

**Architecture:** The modal owns the checkbox UI (per-row + "Auto-match all" header) and a spinner. On submit it hands rows `[{label, autoMatch}]` to `handleCreate`, which — for ticked rows — runs the editor's `searchSymbols` query (top hit) and resolves audio through `/api/tts` in the browser (concurrently), builds an ordered `symbols` array, and persists it through an extended `createProfileCategory` mutation. Matching/resolve logic lives in a focused helper.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Convex (`searchSymbols` full-text query, `createProfileCategory` mutation), `/api/tts` route, Tailwind 4.

## Global Constraints

- **No test runner exists.** Gate per task: `npx tsc --noEmit -p tsconfig.json` (filter to touched files), `npx eslint <files>`, `node -e "JSON.parse(...)"` for JSON, and **browser verification** on **http://localhost:3000** (signed-in Chrome) + `npx convex run` data checks (prefix `source ~/.nvm/nvm.sh && nvm use 20.17.0`). Do **not** add a test runner.
- **Never** run `npm run dev` / `npx convex dev`. Dev server runs on :3000; `convex dev` runs on `main` (auto-push).
- **UI copy → `messages/en.json` only** (real English), via `useTranslations`. Never touch `hi.json`/`es.json`.
- **`/api/tts` must be called WITHOUT the `literal` flag** (preserve symbols-folder reuse; matches phase-16).
- **Audio-follows-label (phase-16):** a matched symbol whose typed word equals the symbol's own word for the board language stores **no** audio override; a diverged word stores a per-language `tts` override `{type:'tts', path, ttsText:word, language}`.
- **Label keying:** symbol labels (matched and placeholder) are keyed by the **authoring/board language**, `{ [language]: word }` — not hard-coded `en`.
- **Concurrency:** search + resolve across rows run with `Promise.all`, not sequentially.
- **Resilience:** no search result → placeholder (no error); `/api/tts` failure on a diverged word → matched symbol with no override (mismatch caught in edit mode), never blocks the batch.
- **Commit on `main`.** End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Spec: `docs/4-builds/plans/phase-17-auto-match-symbols-SPEC.md`.

---

## File Structure

| File | Responsibility | Create/Modify |
|---|---|---|
| `convex/profileSymbols.ts` | Export `audioSourceValidator` for reuse | Modify |
| `convex/profileCategories.ts` | `createProfileCategory` accepts an ordered `symbols` array (placeholder or fully-formed symbolstix) | Modify |
| `lib/categories/autoMatchSymbols.ts` | Pure async: rows + language + deps → ordered `CreateSymbolSpec[]` | **Create** |
| `app/lib/categories/useCreateCategory.ts` | Shared hook: wires real deps (Convex search, `/api/tts`), runs the helper, calls the mutation, returns the new id | **Create** |
| `app/components/app/categories/sections/CategoriesContent.tsx` | `handleCreate` uses the hook then routes | Modify |
| `app/components/app/home/sections/HomeContent.tsx` | `handleCreateCategory` uses the hook then routes (second mount of CreateCategoryModal) | Modify |
| `app/components/app/categories/modals/CreateCategoryModal.tsx` | Per-row + header checkboxes, spinner, new `onCreate` signature | Modify |
| `messages/en.json` | Copy (en only) | Modify |

> **Two callers:** `CreateCategoryModal` is mounted by BOTH `CategoriesContent` (Categories page) and `HomeContent` (Home page "Create a category" card). The `useCreateCategory` hook exists so both get identical auto-match behaviour without duplicated deps-wiring, and both must be updated when Task 4 changes `onCreate`'s signature.

---

## Task 1: Extend `createProfileCategory` to accept an ordered `symbols` array

**Files:**
- Modify: `convex/profileSymbols.ts` (export the validator, ~line 8)
- Modify: `convex/profileCategories.ts` (`createProfileCategory`, lines 310–365)

**Interfaces:**
- Produces: `createProfileCategory({ name, symbols?, surface? })` where `symbols: Array<{ label: Record<string,string>; symbolId?: Id<'symbols'>; audio?: Record<string, <audioSource>> }>`. Each entry with a non-empty label becomes: `symbolId` present → a `symbolstix` symbol (with optional `audio`); absent → a `placeholder`. Order = array index.

- [ ] **Step 1: Export the audio validator**

In `convex/profileSymbols.ts`, change line 8 from `const audioSourceValidator = v.object({` to:

```typescript
export const audioSourceValidator = v.object({
```

- [ ] **Step 2: Swap `symbolLabels` for `symbols` in the mutation args**

In `convex/profileCategories.ts`, add to the imports at top (near the other convex imports):

```typescript
import { audioSourceValidator } from "./profileSymbols";
```

Replace the `symbolLabels` arg (lines 313–318) with:

```typescript
    // Ordered symbol specs — one profileSymbol per entry with a non-empty label,
    // in array order. `symbolId` present → a fully-formed SymbolStix symbol
    // (auto-match); absent → a placeholder the instructor fills via the editor.
    // Empty-label entries are skipped. Labels are keyed by the authoring language.
    symbols: v.optional(
      v.array(
        v.object({
          label: v.record(v.string(), v.string()),
          symbolId: v.optional(v.id("symbols")),
          audio: v.optional(v.record(v.string(), audioSourceValidator)),
        })
      )
    ),
```

- [ ] **Step 3: Rewrite the seeding loop**

Replace the seeding block (lines 346–361, from `// Seed placeholder symbols` through the `for` loop) with:

```typescript
    // Seed symbols in array order. A non-empty label is required; a symbolId
    // makes a fully-formed SymbolStix symbol (with optional per-language audio
    // override), otherwise a placeholder. Order = index among the kept entries.
    const kept = (args.symbols ?? []).filter((s) =>
      Object.values(s.label).some((v) => (v ?? "").trim().length > 0)
    );
    for (let i = 0; i < kept.length; i++) {
      const s = kept[i];
      await ctx.db.insert("profileSymbols", {
        accountId,
        profileCategoryId: categoryId,
        order: i,
        imageSource: s.symbolId
          ? { type: "symbolstix" as const, symbolId: s.symbolId }
          : { type: "placeholder" as const },
        label: s.label,
        ...(s.audio ? { audio: s.audio } : {}),
        updatedAt: now,
      });
    }
```

- [ ] **Step 4: Update the other caller so it compiles**

The inline "+ New category" in `PropertiesPanel.tsx` calls `createCategory({ name: { en: name } })` with no labels — it needs no change (symbols is optional). Confirm no other caller passes `symbolLabels`:

Run: `grep -rn "symbolLabels" app convex` → expect only stale hits you are removing (none should remain in `convex/`; `CategoriesContent.tsx` is updated in Task 3).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "profileCategories|profileSymbols"`
Expected: no output. (`CategoriesContent.tsx` will error until Task 3 — that's expected; it is not in this grep.)

- [ ] **Step 6: Commit**

```bash
git add convex/profileSymbols.ts convex/profileCategories.ts
git commit -m "feat(categories): createProfileCategory accepts ordered symbols (placeholder or symbolstix)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Auto-match helper `lib/categories/autoMatchSymbols.ts`

**Files:**
- Create: `lib/categories/autoMatchSymbols.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure).
- Produces: `buildCreateSymbols(rows, language, deps): Promise<CreateSymbolSpec[]>` and the `CreateSymbolSpec` / `SearchHit` / `AutoMatchDeps` types.

- [ ] **Step 1: Write the helper**

```typescript
// Turn create-modal rows into ordered symbol specs for createProfileCategory.
// For an auto-match row, look up the word's top SymbolStix hit and (per phase-16
// audio-follows-label) attach a tts override only when the typed word differs
// from the symbol's own word for the board language. Pure orchestration — the
// caller injects the Convex search and the /api/tts resolve.
import type { Id } from '@/convex/_generated/dataModel';

export type SearchHit = {
  _id: Id<'symbols'>;
  words: Record<string, string>;
};

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

export type AutoMatchDeps = {
  // Top hit for a word in the given language, or null if none.
  search: (term: string, language: string) => Promise<SearchHit | null>;
  // Resolve spoken text to an R2 key via /api/tts, or null on failure.
  resolveTts: (text: string, language: string) => Promise<string | null>;
};

export async function buildCreateSymbols(
  rows: Array<{ label: string; autoMatch: boolean }>,
  language: string,
  deps: AutoMatchDeps,
): Promise<CreateSymbolSpec[]> {
  const trimmed = rows
    .map((r) => ({ label: r.label.trim(), autoMatch: r.autoMatch }))
    .filter((r) => r.label.length > 0);

  return Promise.all(
    trimmed.map(async (r): Promise<CreateSymbolSpec> => {
      const placeholder: CreateSymbolSpec = { label: { [language]: r.label } };
      if (!r.autoMatch) return placeholder;

      const hit = await deps.search(r.label, language);
      if (!hit) return placeholder; // no match → placeholder

      const spec: CreateSymbolSpec = {
        label: { [language]: r.label },
        symbolId: hit._id,
      };

      const symbolWord = (hit.words[language] ?? '').trim();
      if (r.label === symbolWord) return spec; // symbol's own clip already speaks it

      // Diverged word → resolve its audio so the tile speaks the label.
      const key = await deps.resolveTts(r.label, language);
      if (key) {
        spec.audio = { [language]: { type: 'tts', path: key, ttsText: r.label, language } };
      }
      return spec; // resolve failed → no override (mismatch surfaced in edit mode)
    }),
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "autoMatchSymbols"` → no output.
Run: `npx eslint lib/categories/autoMatchSymbols.ts` → clean.

- [ ] **Step 3: Commit**

```bash
git add lib/categories/autoMatchSymbols.ts
git commit -m "feat(categories): pure auto-match helper (rows -> ordered symbol specs)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `useCreateCategory` hook + wire both callers (Categories + Home)

**Files:**
- Create: `app/lib/categories/useCreateCategory.ts`
- Modify: `app/components/app/categories/sections/CategoriesContent.tsx` (`handleCreate` + drop the now-unused direct mutation)
- Modify: `app/components/app/home/sections/HomeContent.tsx` (`handleCreateCategory` + drop the now-unused direct mutation)

**Interfaces:**
- Consumes: `buildCreateSymbols` + `SearchHit` (Task 2); `createProfileCategory({ name, symbols })` (Task 1).
- Produces: `useCreateCategory(): (name: string, rows: Array<{ label: string; autoMatch: boolean }>) => Promise<Id<'profileCategories'>>`. Both callers' modal `onCreate` become `(name, rows) => Promise<void>`.

- [ ] **Step 1: Create the shared hook**

Create `app/lib/categories/useCreateCategory.ts`:

```typescript
"use client";

import { useConvex, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { voiceForLanguage } from '@/lib/audio/resolveVoiceId';
import { buildCreateSymbols, type SearchHit } from '@/lib/categories/autoMatchSymbols';

/**
 * Create a category from create-modal rows, auto-matching ticked words to their
 * top SymbolStix hit (image + label + audio-follows-label). Shared by the
 * Categories page and the Home page, which both mount CreateCategoryModal.
 * Returns the new category id; the caller handles routing.
 */
export function useCreateCategory() {
  const convex = useConvex();
  const createCategory = useMutation(api.profileCategories.createProfileCategory);
  const { language } = useProfile();

  return async function create(
    name: string,
    rows: Array<{ label: string; autoMatch: boolean }>,
  ): Promise<Id<'profileCategories'>> {
    const symbols = await buildCreateSymbols(rows, language, {
      search: async (term, lang): Promise<SearchHit | null> => {
        const results = await convex.query(api.symbols.searchSymbols, {
          searchTerm: term, language: lang, limit: 1,
        });
        const first = results?.[0];
        return first ? { _id: first._id, words: first.words } : null;
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
    });
    // Names never auto-translate; key by the board language (ADR-016 Addendum D).
    return createCategory({ name: { [language]: name }, symbols }) as Promise<Id<'profileCategories'>>;
  };
}
```

- [ ] **Step 2: Confirm `searchSymbols` returns `_id` + `words`**

Run: `grep -n "return\|_id\|words\|map(" convex/symbols.ts | sed -n '1,40p'` and confirm the `searchSymbols` result objects expose `_id` and `words`. If the query maps to a narrower shape, read the fields it exposes and adjust the `search` dep + `SearchHit` (Task 2) to match. Document what you found in the report.

- [ ] **Step 3: Wire `CategoriesContent`**

In `app/components/app/categories/sections/CategoriesContent.tsx`:
- Add import: `import { useCreateCategory } from '@/app/lib/categories/useCreateCategory';`
- Near the other hooks, add: `const createCategory = useCreateCategory();`
- Replace the whole `handleCreate` (currently ~lines 194–205) with:

```typescript
  async function handleCreate(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
    const id = await createCategory(name, rows);
    router.push(`/${locale}/categories/${id}?edit=1`);
  }
```

- Remove the now-unused direct mutation: delete the `const createCategoryMutation = useMutation(api.profileCategories.createProfileCategory);` line (~102) **only if** `grep -n "createCategoryMutation" app/components/app/categories/sections/CategoriesContent.tsx` shows no other use. If `useMutation`/`api` become unused, drop those imports too.

- [ ] **Step 4: Wire `HomeContent`**

In `app/components/app/home/sections/HomeContent.tsx`:
- Add import: `import { useCreateCategory } from '@/app/lib/categories/useCreateCategory';`
- Replace the `const createCategory = useMutation(api.profileCategories.createProfileCategory);` line (~59) with: `const createCategory = useCreateCategory();`
- Replace `handleCreateCategory` (~lines 64–67) with:

```typescript
  async function handleCreateCategory(name: string, rows: Array<{ label: string; autoMatch: boolean }>) {
    const id = await createCategory(name, rows);
    router.push(`/${locale}/categories/${id}?edit=1`);
  }
```

(This also fixes HomeContent's pre-existing hard-coded `{ en: name }` — the hook now keys the name by the board language, matching `handleCreateSentence` right below it.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "useCreateCategory|CategoriesContent|HomeContent"` → no output. (`CreateCategoryModal` still errors on the old `onCreate` type until Task 4 — expected, and not in this grep.)
Run: `npx eslint app/lib/categories/useCreateCategory.ts app/components/app/categories/sections/CategoriesContent.tsx app/components/app/home/sections/HomeContent.tsx` → no new problems.

- [ ] **Step 6: Commit**

```bash
git add app/lib/categories/useCreateCategory.ts app/components/app/categories/sections/CategoriesContent.tsx app/components/app/home/sections/HomeContent.tsx
git commit -m "feat(categories): useCreateCategory hook; wire Categories + Home create flows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: CreateCategoryModal — checkboxes, header toggle, spinner, new `onCreate`

**Files:**
- Modify: `app/components/app/categories/modals/CreateCategoryModal.tsx`
- Modify: `messages/en.json`

**Interfaces:**
- Consumes: `onCreate(name, rows: Array<{ label: string; autoMatch: boolean }>)` (Task 3).

- [ ] **Step 1: Add copy to `en.json`**

In `messages/en.json` `categories` namespace, add:

```json
    "createModalAutoMatchAll": "Auto-match all",
    "createModalAutoMatchRow": "Auto-match this word to a symbol",
    "createModalAutoMatching": "Auto-matching your words…",
```

- [ ] **Step 2: Change the `onCreate` prop type**

In `CreateCategoryModal.tsx`, change the `Props` type's `onCreate`:

```typescript
  onCreate: (name: string, rows: Array<{ label: string; autoMatch: boolean }>) => Promise<void>;
```

- [ ] **Step 3: Add auto-match state kept in sync with `symbols`**

After the `const [symbols, setSymbols] = useState<string[]>(INITIAL_SYMBOLS);` line, add:

```typescript
  const [autoMatch, setAutoMatch] = useState<boolean[]>(() => INITIAL_SYMBOLS.map(() => false));
  const allChecked = autoMatch.length > 0 && autoMatch.every(Boolean);
  const someChecked = autoMatch.some(Boolean);
  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);
```

(Add `useRef` to the existing `react` import if not already present.)

- [ ] **Step 4: Keep `autoMatch` in sync in every operation that changes `symbols`**

Update `addSymbol`, the paste handler, and `reset` so the two arrays stay the same length:

```typescript
  function addSymbol() {
    setSymbols((prev) => [...prev, '']);
    setAutoMatch((prev) => [...prev, allChecked]); // inherit the header state
  }

  function reset() {
    setName('');
    setSymbols(INITIAL_SYMBOLS);
    setAutoMatch(INITIAL_SYMBOLS.map(() => false));
  }
```

In `handleSymbolPaste`, after the existing `setSymbols(...)` call, mirror the same reshape onto `autoMatch`:

```typescript
    setAutoMatch((prev) => {
      const next = prev.slice(0, index);
      while (next.length < index) next.push(false);
      for (let k = 0; k < items.length; k++) next.push(allChecked); // pasted rows inherit header state
      return next;
    });
```

- [ ] **Step 5: Header "Auto-match all" checkbox**

Replace the Symbols `<label>` header (the `{t('createModalSymbolsLabel')}` label element) with a row that carries the toggle:

```tsx
            <div className="flex items-center justify-between">
              <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
                {t('createModalSymbolsLabel')}
              </label>
              <label className="flex items-center gap-2 text-theme-xs cursor-pointer" style={{ color: 'var(--theme-secondary-text)' }}>
                <input
                  ref={headerRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => setAutoMatch(symbols.map(() => e.target.checked))}
                  className="w-4 h-4 accent-[var(--theme-brand-primary)]"
                />
                {t('createModalAutoMatchAll')}
              </label>
            </div>
```

- [ ] **Step 6: Per-row checkbox**

Inside the `symbols.map((symbol, i) => ( ... ))` row, after the `<input>` text field (still inside the row's flex container), add:

```tsx
                  <input
                    type="checkbox"
                    checked={autoMatch[i] ?? false}
                    onChange={(e) =>
                      setAutoMatch((prev) => prev.map((v, k) => (k === i ? e.target.checked : v)))
                    }
                    aria-label={t('createModalAutoMatchRow')}
                    className="w-5 h-5 shrink-0 accent-[var(--theme-brand-primary)] cursor-pointer"
                  />
```

- [ ] **Step 7: Submit passes rows; spinner label reflects auto-match**

Change `handleSubmit` to build rows and keep the spinner meaning:

```typescript
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, symbols.map((label, i) => ({ label, autoMatch: autoMatch[i] ?? false })));
      reset();
      onClose();
    } finally {
      setIsCreating(false);
    }
  }
```

Change the submit button's busy label so it reads the auto-match state:

```tsx
                {isCreating ? (someChecked ? t('createModalAutoMatching') : t('creating')) : t('createModalCreate')}
```

- [ ] **Step 8: Typecheck + lint + JSON**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "CreateCategoryModal|CategoriesContent"` → no output.
Run: `npx eslint app/components/app/categories/modals/CreateCategoryModal.tsx` → no new problems.
Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"` → exit 0.

- [ ] **Step 9: Browser verification**

On :3000, signed in, Categories → Create category. Verify:
1. All row checkboxes start unchecked; "Auto-match all" unchecked.
2. Paste `rabbit\ncat\nzzzznotaword`; tick "Auto-match all" → all rows tick; untick one → header shows indeterminate.
3. Create → "Auto-matching your words…" spinner shows, then the category opens in edit mode: `rabbit` + `cat` are real symbol tiles with images; `zzzznotaword` is a placeholder.
4. Data check: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx convex run profileCategories:getProfileSymbols '{"profileCategoryId":"<newCatId>"}'` → `rabbit`/`cat` have `imageSource.type==="symbolstix"`, label keyed by board language, and `audio:null` when the word equals the symbol word.
5. With no boxes ticked, Create a second category → no spinner, placeholders only (fast flow unchanged).

- [ ] **Step 10: Commit**

```bash
git add app/components/app/categories/modals/CreateCategoryModal.tsx messages/en.json
git commit -m "feat(categories): auto-match checkboxes + select-all + spinner on create modal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: End-to-end verification + retire plan

- [ ] **Step 1: Acceptance sweep (browser + data)** — walk the spec §6 criteria: default unchanged; select-all + indeterminate; match quality; diverged word (label = typed word, `audio.<lang>` is a `tts` entry with `ttsText` = typed word); no-match → placeholder; order preserved; spinner only when ≥1 ticked. Capture a screenshot + a `getProfileSymbols` dump as evidence.

- [ ] **Step 2: Retire the plan and push**

```bash
git mv docs/4-builds/plans/phase-17-auto-match-symbols-plan.md docs/4-builds/plans/_done/phase-17-auto-match-symbols-plan.md
git commit -m "chore(plans): retire phase-17 auto-match plan to _done

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin HEAD
```

---

## Self-Review notes

- **Spec coverage:** §2 UX → Task 4 (checkboxes/header/spinner); §3 flow → Tasks 2+3 (search, resolve, build) + Task 1 (persist ordered); §4 architecture → Tasks 1–3 (client search/resolve, ordered `symbols` mutation, concurrent `Promise.all`); §5 edges → Task 2 (no-match/resolve-fail → placeholder/no-override) + Task 1 (empty-label skip); §6 acceptance → Tasks 4/5; §7 out-of-scope respected (top hit only, create-modal only, client-side).
- **`literal` flag:** never sent by `resolveTts` (Task 3).
- **Label keying:** `{ [language]: word }` everywhere (Tasks 1–3), fixing the old hard-coded `en`.
- **Type consistency:** `CreateSymbolSpec` / `SearchHit` / `AutoMatchDeps` (Task 2) match their use in Task 3; `createProfileCategory({name, symbols})` (Task 1) matches Task 3's call; `onCreate(name, rows)` (Task 4) matches Task 3's `handleCreate` signature.
