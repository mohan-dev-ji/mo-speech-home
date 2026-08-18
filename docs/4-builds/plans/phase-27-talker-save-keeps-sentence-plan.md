# Phase 27 — Talker save keeps the sentence and confirms with a toast

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saving a sentence from the talker leaves the composition in the bar and shows a toast naming the group it went to, instead of silently clearing the bar.

**Architecture:** One component and two copy keys. `clearTalker()` comes out of `handleSaveConfirm`, and a `showToast` goes in after the successful create — inside the existing `try`, so a failed save still confirms nothing. The toast's group label is derived from the `GroupSelection` the user already made, all three cases of which are in scope at that point. `ToastProvider` is already mounted above `PersistentTalker`, so there is no new plumbing.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4

**Spec:** `docs/superpowers/specs/2026-08-17-talker-save-keeps-sentence-design.md`
**Builds on:** phase-26 (`GroupPicker` / `useResolveGroupSelection`)
**Relevant ADRs:** ADR-015 (talker save)

## Global Constraints

- **No test runner exists in this repo, and you must not add one.** The gate is `npx tsc --noEmit -p tsconfig.json` filtered to the touched file, `npx eslint <file>`, then browser verification.
- **`tsc` has 4 pre-existing unrelated errors** — three stale `.next/types/validator.ts` module-not-found entries and one `lib/stripe.ts` API-version mismatch. Never expect a clean exit; grep for the file you touched and expect **no output**.
- **UI copy:** never hard-code strings. Both new keys go in **`messages/en.json` only** — never hand-add to `hi.json`/`es.json`. `i18n/request.ts` merges each locale over `en.json`, and the translation pipeline only translates keys *absent* from a locale, so a hand-added value ships forever.
- **Theme tokens only:** no hard-coded colours, radii, spacing, or font sizes. This task adds no styling — the Toast component owns its own.
- **Do not modify the Toast component**, its position, tone set, or timing. This task only calls it.
- **Dev server is already running on http://localhost:3000.** Do **not** run `npm run dev`. **Never run `npx convex dev`.**
- **Browser verification uses signed-in Chrome** (the `claude-in-chrome` tools), not the in-app browser — the app requires a Clerk session.
- **Work on `main`.** Do not create a branch. Stage only the two paths the commit lists — never `git add -A`.

---

### Task 1: Keep the composition, confirm with a toast

**Files:**
- Modify: `messages/en.json` (two new keys in the `talker` object)
- Modify: `app/components/app/shared/sections/PersistentTalker.tsx` (imports ~line 30; translations/hooks ~line 58; a new helper above `handleSaveConfirm` ~line 124; `handleSaveConfirm`'s tail ~line 188)

**Interfaces:**
- Consumes: `useToast()` from `@/app/components/app/shared/ui/Toast` — returns `{ showToast, dismissToast }`, where `showToast({ tone: 'info' | 'warning'; title: string; body?: string; dedupeKey?: string })`. `GroupSelection` from `@/app/components/app/shared/ui/GroupPicker` (already imported in this file). `displayString` and `DEFAULT_LOCALE` (already imported). `sentenceFolders` (already queried in this component).
- Produces: nothing — single-task plan.

---

- [ ] **Step 1: Add the two copy keys**

In `messages/en.json`, inside the **`talker`** object, add these two keys next to the existing `saveConfirm` / `saveSaving` keys:

```json
    "saveToastTitle": "Saved to {group}",
    "saveToastTitleGeneric": "Sentence saved",
```

`{group}` is a next-intl interpolation — the group's name is passed at call time.

**`en.json` only.** Do not touch `hi.json`, `es.json`, or `pa.json`.

- [ ] **Step 2: Verify the JSON still parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Import the toast hook**

In `app/components/app/shared/sections/PersistentTalker.tsx`, add to the import block (next to the other `shared/ui` imports):

```tsx
import { useToast } from '@/app/components/app/shared/ui/Toast';
```

- [ ] **Step 4: Add the hook and the second translations namespace**

The component currently has:

```tsx
  const t = useTranslations('talker');
```

Add these two lines directly below it:

```tsx
  // The Drafts label lives in the picker's namespace, since that's the row the
  // user actually chose.
  const tGroup = useTranslations('groupPicker');
  const { showToast } = useToast();
```

- [ ] **Step 5: Add the destination-label helper**

Insert this function directly **above** `async function handleSaveConfirm(` (which sits after `handleSaveOpen`):

```tsx
  // Where the sentence just went, for the save confirmation. All three cases are
  // already in scope: a picked folder resolves against the same `sentenceFolders`
  // the picker rendered from, a new group is the name just typed, and Drafts uses
  // the picker's own label. A folder we can't resolve falls back to the generic
  // title — "Saved to ." would be a worse failure than a plain confirmation.
  function savedToastTitle(sel: GroupSelection): string {
    let group: string | undefined;
    if (sel.kind === 'drafts') {
      group = tGroup('drafts');
    } else if (sel.kind === 'new') {
      group = sel.name.trim();
    } else {
      const match = (sentenceFolders ?? []).find((f) => f._id === sel.id);
      group = match ? displayString(match.name, language, DEFAULT_LOCALE) : undefined;
    }
    return group ? t('saveToastTitle', { group }) : t('saveToastTitleGeneric');
  }
```

- [ ] **Step 6: Keep the bar and show the toast**

At the tail of `handleSaveConfirm`, these two lines currently follow the `await createProfileSentence({ … })` call:

```tsx
      clearTalker();
      setSaveDialogOpen(false);
```

Replace them with:

```tsx
      // The bar is deliberately NOT cleared. The composition stays so it can be
      // filed into a second group without rebuilding, and the toast — rather than
      // the symbols vanishing — is what confirms the save. This sits after the
      // await and inside the existing try, so a failed save confirms nothing.
      showToast({ tone: 'info', title: savedToastTitle(saveSelection) });
      setSaveDialogOpen(false);
```

Leave the `finally { setIsSaving(false); }` below exactly as it is, and do **not** add a `catch`.

- [ ] **Step 7: Confirm `clearTalker` is still used**

Removing the call must **not** remove it from the `useTalker()` destructure — the bar's manual clear button still passes it.

```bash
grep -n "clearTalker" app/components/app/shared/sections/PersistentTalker.tsx
```

Expected: exactly two lines — the `useTalker()` destructure (~line 60) and `onClear={clearTalker}` (~line 224). If only one remains, you deleted too much; restore the destructure.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "PersistentTalker|Toast|GroupPicker"
```

Expected: **no output**. (The 4 pre-existing unrelated errors are filtered out — see Global Constraints.)

- [ ] **Step 9: Lint**

```bash
npx eslint app/components/app/shared/sections/PersistentTalker.tsx
```

Expected: no errors.

- [ ] **Step 10: Browser verification**

In signed-in Chrome on **http://localhost:3000**, on a talker-capable page — `/en/categories` works — with the Talker toggle on. Build a short sentence by tapping symbols, then use the save (disk) button.

| Do this | Expected |
|---|---|
| Save → pick an existing group → Save | Toast bottom-right reads **"Saved to \<that group\>"**, and **the symbols are still in the bar**. The sentence is in that group on `/en/sentences` |
| Without rebuilding, Save again → pick a *different* group | Second toast names the second group; both sentences exist, one in each group |
| Save with **Drafts** selected | Toast reads **"Saved to Drafts"** |
| Save into a group created with "+ New group" | Toast names the name you typed, and the group exists with the sentence in it |
| Wait ~8 seconds after a toast | It auto-dismisses. The X button also dismisses it immediately |
| Press the bar's own clear control | Still empties the bar, as before |

**Delete every test sentence and test group afterwards** — this is the owner's live content and they are recording marketing footage from it. Wait for each save to land before pressing again; an earlier agent hit a race by double-clicking.

If you cannot reach a signed-in session, say so and mark NOT VERIFIED — do not infer or round up results.

- [ ] **Step 11: Commit**

```bash
git add messages/en.json app/components/app/shared/sections/PersistentTalker.tsx
git commit -F- <<'MSG'
feat(talker): keep the sentence after saving, and confirm with a toast

Saving cleared the bar and said nothing, so the only signal of success was
the composition disappearing — indistinguishable from an accidental clear.
Worse, filing the same sentence into a second group meant rebuilding it
symbol by symbol.

The bar now keeps its symbols and a toast names the destination, which is
the one thing you can't see for yourself. The toast sits inside the existing
try after the create, so a failed save still confirms nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Done criteria

- Saving from the talker leaves the composition in the bar.
- A toast names the destination group — an existing group, one created inline, or Drafts.
- Saving the same bar twice into two groups produces two sentences, one in each.
- A failed save shows no toast and leaves the dialog open.
- The bar's manual clear control still works.
- `npx tsc --noEmit -p tsconfig.json` reports nothing beyond the 4 known pre-existing errors.

## Follow-ups (explicitly out of scope)

- Preventing or warning about duplicate saves — repeat saves are allowed by design, and are what make save-to-two-groups work.
- Undo from the toast.
- Any change to the Toast component, its position, tone set, or timing.
- Applying the same keep-and-confirm treatment to other save surfaces.
