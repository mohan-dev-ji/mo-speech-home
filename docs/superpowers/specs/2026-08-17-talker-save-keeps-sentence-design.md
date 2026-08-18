# Talker save keeps the sentence, and confirms with a toast — design

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-17
**Context:** MOS-13 (Phase 4 · rebuild defaults for marketing). Found while testing phase-26's group
picker: saving from the talker works, but the sentence vanishes from the bar and nothing says it
succeeded.
**Touches:** ADR-015 (talker save). Builds on phase-26 (`GroupPicker` / `useResolveGroupSelection`).

---

## 1. Problem

Saving a sentence from the talker clears the bar (`clearTalker()`) and shows nothing. Two costs:

- **No confirmation.** The dialog closes and the symbols disappear. The disappearance is the only
  signal that anything happened, and it looks identical to an accidental clear.
- **The composition is gone.** Now that phase-26 lets you choose a group at save time, filing the
  same sentence into two places means rebuilding it symbol by symbol.

## 2. Decision

**The bar keeps its symbols after a save, and a toast confirms where the sentence went.**

### 2.1 The bar is no longer cleared

`clearTalker()` is removed from `handleSaveConfirm`. The dialog still closes; the composition stays.

### 2.2 The toast names the destination

Title-only, via the existing `useToast()`:

```
Saved to Everyday phrases
```

The destination is the part worth reading — it is the one thing you cannot see for yourself, since
the sentence itself is still in the bar in front of you. It also confirms the group picker did what
you expected, which matters most right after creating a group inline.

The group label is resolved from the selection the user already made; all three cases are in scope
at that point:

| Selection | Label |
|---|---|
| `{ kind: 'folder', id }` | `displayString(folder.name, …)`, found in `sentenceFolders` — the same array the picker rendered from |
| `{ kind: 'new', name }` | the trimmed name just typed |
| `{ kind: 'drafts' }` | the `groupPicker.drafts` string, so it reads "Saved to Drafts" |

### 2.3 Repeat saves are allowed

Save stays enabled, so pressing it again saves the composition again. That is deliberate: building
once and filing into two groups is a real authoring move, and it only works because the bar is no
longer cleared.

The accepted cost is that a double-press creates a duplicate, deleted from the Sentences page. The
alternatives were considered and rejected: disabling Save until the bar changes would block the
deliberate case and needs a new "changed since save?" flag to keep correct, and a confirm-on-repeat
dialog adds a step to a flow about to be used heavily for authoring.

## 3. Code shape

**Changed — `app/components/app/shared/sections/PersistentTalker.tsx`**

- `handleSaveConfirm`: drop `clearTalker()`; after the successful `createProfileSentence`, resolve
  the group label and `showToast({ tone: 'info', title })`.
- Add `useToast()` and a `useTranslations('groupPicker')` alongside the existing `talker` one (the
  Drafts label lives in the picker's namespace).
- `clearTalker` may become unused in the file — remove it from the `useTalker()` destructure only if
  nothing else references it.

**Changed — `messages/en.json`** (`en.json` only, per CLAUDE.md rule 1):

- `talker.saveToastTitle` = `"Saved to {group}"`
- `talker.saveToastTitleGeneric` = `"Sentence saved"`

The generic is a fallback for a folder lookup that misses. It should be unreachable — the folder was
just picked from a list rendered off the same query — but `"Saved to ."` is a worse failure than a
plain confirmation.

**Unchanged**: `ToastProvider` (already mounted by `AppProviders`, which wraps `PersistentTalker` in
`app/[locale]/(app)/layout.tsx`), the Toast component itself, `createProfileSentence`, the group
picker, and `useResolveGroupSelection`. No schema change, no new dependency.

## 4. Edge cases

| Case | Behaviour |
|---|---|
| Save fails | No toast. It sits after the `await` inside the existing `try`, so a throw skips it and the dialog stays open with nothing written — the same path the group picker relies on |
| Saved to Drafts | "Saved to Drafts", using the picker's own label |
| Saved to a group created inline | "Saved to <the name you typed>" |
| Folder lookup misses | "Sentence saved" — the generic fallback |
| Save pressed twice | Two sentences, two toasts. Deliberate (§2.3) |
| Toast still visible when another save lands | The Toast provider stacks up to 3 and auto-dismisses each after 8s |
| Bar cleared manually after saving | Unchanged — the existing clear control still works |

## 5. Verification

No test runner (see the phase-24 spec §6; phase-17 forbids adding one). Gate is
`npx tsc --noEmit -p tsconfig.json` grep-filtered to the touched file — the baseline carries 4
pre-existing unrelated errors — plus `npx eslint`, then signed-in Chrome on `:3000`.

Browser, on a talker-capable page (e.g. `/en/categories`) with the Talker toggle on:

| Do this | Expected |
|---|---|
| Build a sentence → Save → pick an existing group | Toast reads "Saved to <that group>"; **the symbols are still in the bar**; the sentence is in that group |
| Save the same bar again into a *different* group | Second toast names the second group; both sentences exist |
| Save with Drafts selected | Toast reads "Saved to Drafts" |
| Save into a group created inline | Toast names the typed name |
| Clear the bar manually afterwards | Still works |

## 6. Out of scope

- Preventing or warning about duplicate saves (§2.3).
- Undo from the toast.
- Any change to the Toast component, its position, tone set, or timing.
- Applying the same keep-and-confirm treatment to other save surfaces.
