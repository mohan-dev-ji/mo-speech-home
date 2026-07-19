# Variant Lifecycle Stages 3 & 4 (Revert + Whole-item Delete) + 1-word Phrases — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Design spec:** [`docs/superpowers/specs/2026-07-19-variant-delete-revert-design.md`](../../superpowers/specs/2026-07-19-variant-delete-revert-design.md).
> **Execute on `main`** (owner runs `npx convex dev` → Convex auto-deploys). Not a worktree.

**Goal:** Make the trash button delete a variant-group's whole logical item in one action, add a Revert control that removes just the current board's variant, and allow 1-word phrases — all with personal-recording R2 cleanup that never touches shared TTS.

**Architecture:** New Convex group-delete mutations (resolve `variantGroupId ?? _id`, delete every sibling) + existing single-row deletes, both returning personal-recording R2 keys. A thin `/api/delete-composed` route runs the mutation then deletes those keys from R2 (mirrors `delete-profile-symbol`). The UI trash button routes to a *group* delete (heavy confirm); a new edit-mode ↩ icon routes to a *variant* delete (light confirm), shown only on a board displaying a real variant. A one-line filter relax makes 1-word phrases valid.

**Tech Stack:** Convex 1.x, Next.js 16 route handlers, React 19, TypeScript, `@/lib/r2-storage`, lucide-react, next-intl.

## Global Constraints

- **No unit-test runner exists.** Verify each task with: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit` (Convex) and `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"` (app), plus the live Claude-in-Chrome behavioral checks named per task. Owner confirms durable Convex/R2 state.
- **Deploy ordering (critical, same as the tts-cache fix):** land all Convex changes (Task 1, and Task 6's list mutation) FIRST, confirm `convex dev` pushed (watch the terminal, or `npx convex function-spec` shows the new function), THEN wire the route + UI that call them. A client calling a not-yet-deployed mutation throws `ArgumentValidationError`.
- **Never delete shared audio.** Only R2 keys passing `isPersonalAssetKey` (prefix `accounts/` or `profiles/`) may be deleted. Shared `audio/<voice>/tts/…`, `symbols/…`, `ai-cache/…` are cross-user and never deleted.
- **UI copy → `en.json` only** (real English), under the component's existing `useTranslations` namespace. Never hard-code copy; never hand-add keys to `hi.json`/`es.json`.
- **Convex mutation auth pattern (every mutation below):** `const { accountId, user } = await requireCallerAccountId(ctx); requireProTier(user);` then `const row = await ctx.db.get(id); if (!row || row.accountId !== accountId) throw new Error("Not authorised");`.

---

### Task 1: Convex — personal-key collector + group-delete mutations + single-row deletes return keys

**Files:**
- Modify: `convex/lib/contentModuleDelete.ts` (add `collectPhraseOrphanKeys`)
- Modify: `convex/profileSentences.ts:309-321` (`deleteProfileSentence` returns keys) + add `deleteSentenceGroup`
- Modify: `convex/profilePhrases.ts:200-209` (`deleteProfilePhrase` returns keys) + add `deletePhraseGroup`

**Interfaces (Produces):**
- `collectPhraseOrphanKeys(phrase: { words: ReadonlyArray<{ imagePath?: string; audioPath?: string }>; audioPath?: string; recordedAudioPath?: string }): string[]`
- `deleteProfileSentence({ profileSentenceId }) => string[]` (personal keys of the one deleted row)
- `deleteSentenceGroup({ profileSentenceId }) => string[]` (personal keys across all deleted siblings)
- `deleteProfilePhrase({ profilePhraseId }) => string[]`
- `deletePhraseGroup({ profilePhraseId }) => string[]`

**Consumes:** `variantGroupIdOf` (`convex/lib/variantAuthoring.ts`), `collectSentenceOrphanKeys` + `collectPhraseOrphanKeys` + `isPersonalAssetKey` (`convex/lib/contentModuleDelete.ts`).

- [ ] **Step 1: Add `collectPhraseOrphanKeys`** to `convex/lib/contentModuleDelete.ts` (after `collectSentenceOrphanKeys`, before the private `dedupe`):

```ts
/** Personal R2 keys on a profilePhrases row (word images/recordings + a phrase recording). */
export function collectPhraseOrphanKeys(phrase: {
  words: ReadonlyArray<{ imagePath?: string; audioPath?: string }>;
  audioPath?: string;
  recordedAudioPath?: string;
}): string[] {
  const keys: string[] = [];
  for (const w of phrase.words) {
    if (isPersonalAssetKey(w.imagePath)) keys.push(w.imagePath);
    if (isPersonalAssetKey(w.audioPath)) keys.push(w.audioPath);
  }
  if (isPersonalAssetKey(phrase.recordedAudioPath)) keys.push(phrase.recordedAudioPath);
  if (isPersonalAssetKey(phrase.audioPath)) keys.push(phrase.audioPath);
  return dedupe(keys);
}
```

- [ ] **Step 2: Make `deleteProfileSentence` collect + return personal keys.** Replace its handler body (`convex/profileSentences.ts:313-320`):

```ts
  handler: async (ctx, args): Promise<string[]> => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) throw new Error("Not authorised");
    const orphanKeys = collectSentenceOrphanKeys(sentence);
    await ctx.db.delete(args.profileSentenceId);
    return orphanKeys;
  },
```

- [ ] **Step 3: Add `deleteSentenceGroup`** immediately after `deleteProfileSentence` in `convex/profileSentences.ts`:

```ts
// Stage 4 — delete the WHOLE logical item: the source + every sibling variant in
// the group (variantGroupId ?? _id). Returns the personal-recording R2 keys the
// caller (route) should delete; shared TTS is never included. Fixes the
// delete-one-collapsed-row bug (siblings no longer re-surface).
export const deleteSentenceGroup = mutation({
  args: { profileSentenceId: v.id("profileSentences") },
  handler: async (ctx, args): Promise<string[]> => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const row = await ctx.db.get(args.profileSentenceId);
    if (!row || row.accountId !== accountId) throw new Error("Not authorised");
    const groupId = variantGroupIdOf(row);
    const rows = await ctx.db
      .query("profileSentences")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const group = rows.filter((s) => (s.variantGroupId ?? s._id) === groupId);
    const orphanKeys: string[] = [];
    for (const s of group) {
      orphanKeys.push(...collectSentenceOrphanKeys(s));
      await ctx.db.delete(s._id);
    }
    return Array.from(new Set(orphanKeys));
  },
});
```

- [ ] **Step 4: Add the `variantGroupIdOf` + collector imports** to `convex/profileSentences.ts` if not already imported. Confirm the top-of-file imports include `findVariantInGroup` (already there); add `variantGroupIdOf` to that same import from `"./lib/variantAuthoring"`, and `collectSentenceOrphanKeys` from `"./lib/contentModuleDelete"`.

- [ ] **Step 5: Mirror Steps 2-4 for phrases** in `convex/profilePhrases.ts`. Replace `deleteProfilePhrase`'s handler (`:202-208`) to return `collectPhraseOrphanKeys(phrase)`:

```ts
  handler: async (ctx, args): Promise<string[]> => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const phrase = await ctx.db.get(args.profilePhraseId);
    if (!phrase || phrase.accountId !== accountId) throw new Error("Not authorised");
    const orphanKeys = collectPhraseOrphanKeys(phrase);
    await ctx.db.delete(args.profilePhraseId);
    return orphanKeys;
  },
```
and add `deletePhraseGroup` after it:

```ts
// Stage 4 — delete the whole phrase item (source + every sibling variant).
export const deletePhraseGroup = mutation({
  args: { profilePhraseId: v.id("profilePhrases") },
  handler: async (ctx, args): Promise<string[]> => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const row = await ctx.db.get(args.profilePhraseId);
    if (!row || row.accountId !== accountId) throw new Error("Not authorised");
    const groupId = variantGroupIdOf(row);
    const rows = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const group = rows.filter((p) => (p.variantGroupId ?? p._id) === groupId);
    const orphanKeys: string[] = [];
    for (const p of group) {
      orphanKeys.push(...collectPhraseOrphanKeys(p));
      await ctx.db.delete(p._id);
    }
    return Array.from(new Set(orphanKeys));
  },
});
```
Add `variantGroupIdOf` + `collectPhraseOrphanKeys` to the imports in `convex/profilePhrases.ts`.

- [ ] **Step 6: Verify Convex tsc:** `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`. Expected: clean (no output).

- [ ] **Step 7: Confirm `convex dev` deployed** the four new/changed functions before any client work. Run `npx convex function-spec | grep -E "deleteSentenceGroup|deletePhraseGroup"` — expected: both names present. (This is the deploy-order gate for Tasks 2-4.)

- [ ] **Step 8: Commit.**
```bash
git add convex/lib/contentModuleDelete.ts convex/profileSentences.ts convex/profilePhrases.ts
git commit -m "feat(variant-lifecycle): group-delete mutations + deletes return personal orphan keys (Stage 4 backend)"
```

---

### Task 2: API route `/api/delete-composed` (group + variant scope, personal-key R2 cleanup)

**Files:**
- Create: `app/api/delete-composed/route.ts`

**Interfaces (Produces):** `POST /api/delete-composed` with JSON body `{ kind: 'sentence' | 'phrase'; id: string; scope: 'group' | 'variant' }` → `{ filesDeleted: number; filesFailed: number }` (or `{ error }` with status). **Consumes:** the four Task 1 mutations; `deleteFile`, `isConfigured` from `@/lib/r2-storage`.

- [ ] **Step 1: Create the route** (models `app/api/delete-profile-symbol/route.ts` — Clerk gate, convex token, mutation, best-effort R2 delete):

```ts
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteFile, isConfigured } from "@/lib/r2-storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Delete composed content (sentence/phrase) with personal-recording R2 cleanup.
 * scope "group"   → the whole logical item across all languages (Stage 4).
 * scope "variant" → just this board's variant row (Stage 3, Revert).
 * The mutation returns the personal R2 keys to delete; shared TTS is never touched.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await getToken({ template: "convex" });
  if (!token) return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });

  let body: { kind?: string; id?: string; scope?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { kind, id, scope } = body;
  if ((kind !== "sentence" && kind !== "phrase") || !id || (scope !== "group" && scope !== "variant")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  let orphanKeys: string[];
  try {
    if (kind === "sentence") {
      const sid = id as Id<"profileSentences">;
      orphanKeys =
        scope === "group"
          ? await convex.mutation(api.profileSentences.deleteSentenceGroup, { profileSentenceId: sid })
          : await convex.mutation(api.profileSentences.deleteProfileSentence, { profileSentenceId: sid });
    } else {
      const pid = id as Id<"profilePhrases">;
      orphanKeys =
        scope === "group"
          ? await convex.mutation(api.profilePhrases.deletePhraseGroup, { profilePhraseId: pid })
          : await convex.mutation(api.profilePhrases.deleteProfilePhrase, { profilePhraseId: pid });
    }
  } catch (e) {
    console.error("[delete-composed] mutation failed", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  const results = await Promise.allSettled(orphanKeys.map((k) => deleteFile(k)));
  let filesDeleted = 0;
  let filesFailed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") filesDeleted++;
    else { filesFailed++; console.error("[delete-composed] R2 delete failed:", r.reason); }
  }
  return NextResponse.json({ filesDeleted, filesFailed });
}
```

- [ ] **Step 2: Verify app tsc:** `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"`. Expected: clean.

- [ ] **Step 3: Commit.**
```bash
git add app/api/delete-composed/route.ts
git commit -m "feat(variant-lifecycle): /api/delete-composed route (group/variant delete + personal R2 cleanup)"
```

---

### Task 3: Wire whole-item Delete (trash button → group scope) in Sentences + Phrases

**Files:**
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx:961-970` (delete confirm) + `:1343-1350` (confirm copy)
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx:426-432` (delete confirm) + `:884` (confirm copy)
- Modify: `messages/en.json` (heavy-confirm copy keys)

**Interfaces (Consumes):** `POST /api/delete-composed` (Task 2).

- [ ] **Step 1: Add en.json keys** under the sentences namespace and the `talker` namespace (find each via the component's `useTranslations('…')` at the top; add to `en.json` ONLY):
```jsonc
// sentences namespace
"deleteConfirmAllLanguages": "Delete \"{name}\" everywhere? This removes it on every board and can't be undone.",
// talker namespace
"phraseDeleteConfirmAllLanguages": "Delete \"{name}\" everywhere? This removes it on every board and can't be undone."
```

- [ ] **Step 2: Sentences — route the delete confirm to a group delete.** Replace `handleDeleteConfirm` (`SentencesModeContent.tsx:961-970`):
```ts
  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-composed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sentence', id: pendingDelete.id, scope: 'group' }),
      });
      if (!res.ok) throw new Error('delete failed');
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }
```
Then remove the now-unused `deleteSentence` mutation binding (`:796`) if nothing else uses it (grep first; keep it if another caller remains).

- [ ] **Step 3: Sentences — heavy confirm copy.** At `:1350` change the dialog body key from `t('deleteConfirm', …)` to `t('deleteConfirmAllLanguages', { name: pendingDelete?.name ?? '' })`.

- [ ] **Step 4: Phrases — route the delete confirm to a group delete.** Replace the `deleteProfilePhrase` call in the phrase-delete confirm handler (`TalkerDropdown.tsx:426-432`) with the same `fetch('/api/delete-composed', … { kind: 'phrase', id: pendingPhraseDelete.id, scope: 'group' })` pattern; at `:884` swap `t('phraseDeleteConfirm', …)` → `t('phraseDeleteConfirmAllLanguages', …)`. Remove the unused `deleteProfilePhrase` binding (`:155`) only if no other caller remains after Task 4 (Revert reuses the route, not the mutation directly).

- [ ] **Step 5: Verify app tsc** (command as Global Constraints). Expected: clean.

- [ ] **Step 6: Verify in Chrome (deploy is live on :3000).** Author a sentence with an EN + a HI variant (or use an existing grouped item). On the EN board, open edit mode → trash → confirm. Assert: the item disappears, and switching to the HI board shows it gone too (ONE delete cleared both). Capture the `/api/delete-composed` response `{ filesDeleted, filesFailed }`. Repeat for a phrase group.

- [ ] **Step 7: Owner confirms** in Convex: all siblings of that `variantGroupId` are gone; a shared `ttsCache` row for the item's text still exists.

- [ ] **Step 8: Commit.**
```bash
git add app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/shared/ui/TalkerDropdown.tsx messages/en.json
git commit -m "feat(variant-lifecycle): trash button deletes whole item across languages (Stage 4 UI)"
```

---

### Task 4: Revert control (edit-mode ↩) in Sentences + Phrases

**Files:**
- Modify: `lib/languages/variants.ts` (add `isRevertableVariant`)
- Modify: `app/components/app/sentences/sections/SentencesModeContent.tsx` (EditPanel `:636-664`, row-props, pendingRevert state, confirm dialog, handler)
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx` (phrase card `onRevert` `:1014-1018` + `:599`, pendingPhraseRevert state, confirm, handler)
- Modify: `messages/en.json` (revert copy)

**Interfaces (Produces):** `isRevertableVariant(row: { _id: string; variantGroupId?: string }): boolean`. **Consumes:** `POST /api/delete-composed` with `scope: 'variant'`.

- [ ] **Step 1: Add the predicate** to `lib/languages/variants.ts` (next to `variantGroupKey`):
```ts
/**
 * A collapsed row is revertable iff it is a NON-SOURCE sibling variant — i.e. the
 * board is showing a real board-language version over a surviving origin. Hidden
 * on the origin board and on an untranslated fallback (both show the source).
 */
export function isRevertableVariant(row: { _id: string; variantGroupId?: string }): boolean {
  return row.variantGroupId != null && row.variantGroupId !== row._id;
}
```

- [ ] **Step 2: Add en.json keys** (sentences + talker namespaces, en.json only):
```jsonc
// sentences namespace
"rowRevert": "Use original",
"revertConfirm": "Remove this board's version of \"{name}\"? The original will show here instead — you can re-author it anytime.",
// talker namespace
"phraseRevert": "Use original",
"phraseRevertConfirm": "Remove this board's version of \"{name}\"? The original will show here instead — you can re-author it anytime."
```

- [ ] **Step 3: Sentences — add the ↩ IconButton** in the EditPanel, before the Trash2 button (`SentencesModeContent.tsx:637`). Import `RotateCcw` from `lucide-react` (add to the existing lucide import block at `:27`). Thread an `onRevertRequest(id, name)` prop into the row component alongside `onDeleteRequest`:
```tsx
{isRevertableVariant(sentence) && (
  <IconButton
    size="sm"
    variant="neutral"
    icon={<RotateCcw />}
    label={t('rowRevert')}
    onClick={(e) => { e.stopPropagation(); onRevertRequest(sentence._id, name); }}
  />
)}
```
Import `isRevertableVariant` from `@/lib/languages/variants`.

- [ ] **Step 4: Sentences — pendingRevert state + wiring + handler.** Add `const [pendingRevert, setPendingRevert] = useState<PendingDelete>(null);` beside `pendingDelete` (`:770`). Wire `onRevertRequest={(id, name) => setPendingRevert({ id, name })}` where the row is rendered (beside `onDeleteRequest`, ~`:1267`). Add the handler:
```ts
  async function handleRevertConfirm() {
    if (!pendingRevert) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-composed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sentence', id: pendingRevert.id, scope: 'variant' }),
      });
      if (!res.ok) throw new Error('revert failed');
    } finally {
      setIsDeleting(false);
      setPendingRevert(null);
    }
  }
```

- [ ] **Step 5: Sentences — revert confirm dialog.** Duplicate the delete `Dialog` block (`:1343-1350`) as a second dialog bound to `pendingRevert`, body `t('revertConfirm', { name: pendingRevert?.name ?? '' })`, confirm → `handleRevertConfirm`. Keep it a plain (light) confirm — no extra warning styling.

- [ ] **Step 6: Phrases — add `onRevert` to the phrase card.** In `PhraseDropdownCard` (`TalkerDropdown.tsx`), add an optional `onRevert?: () => void` prop and render a ↩ button next to the delete button (mirror the `editing && onDelete` block at `:1014-1018`, guard `editing && onRevert`, icon `RotateCcw`, label `t('phraseRevert')`). At the call site (`:599`), pass `onRevert` only when revertable:
```tsx
onRevert={isRevertableVariant(p) ? () => setPendingPhraseRevert({ id: p._id, name }) : undefined}
```

- [ ] **Step 7: Phrases — pendingPhraseRevert state + confirm + handler.** Add `pendingPhraseRevert` state beside `pendingPhraseDelete` (`:124`); add a second confirm `Dialog` (mirror `:880-884`) bound to it with body `t('phraseRevertConfirm', …)`; handler posts `{ kind: 'phrase', id: pendingPhraseRevert.id, scope: 'variant' }` to `/api/delete-composed`.

- [ ] **Step 8: Verify app tsc.** Expected: clean.

- [ ] **Step 9: Verify in Chrome.** On a sentence with an EN source + a HI variant: on the **HI** board in edit mode, confirm the ↩ shows; tap it → confirm → the HI board now shows the EN source with the "Made in EN" badge, and the EN board is unchanged. Confirm the ↩ is **absent** on the EN (origin) board and on a board showing an untranslated fallback. Repeat for a phrase. Owner confirms in Convex: only the HI sibling row was deleted; the source + other siblings remain.

- [ ] **Step 10: Commit.**
```bash
git add lib/languages/variants.ts app/components/app/sentences/sections/SentencesModeContent.tsx app/components/app/shared/ui/TalkerDropdown.tsx messages/en.json
git commit -m "feat(variant-lifecycle): Revert control removes this board's variant (Stage 3)"
```

---

### Task 5: Allow 1-word phrases

**Files:**
- Modify: `app/components/app/shared/ui/TalkerDropdown.tsx:610` and `:577`
- Modify: `app/components/app/sentences/sections/InlinePhraseEditor.tsx:68`

- [ ] **Step 1: Relax the tappable-bank filter.** `TalkerDropdown.tsx:610`: change `p.words.length >= 2` → `p.words.length >= 1`. Update the adjacent comment ("only ready phrases (2+ symbols)") to "(1+ symbols) — a variant may legitimately be a single word".

- [ ] **Step 2: Relax the incomplete/warning threshold.** `TalkerDropdown.tsx:577`: `p.words.length < 2` → `p.words.length < 1`. `InlinePhraseEditor.tsx:68`: `unit.words.length < 2` → `unit.words.length < 1`. (Only an empty 0-word phrase is now "incomplete".)

- [ ] **Step 3: Audit for any other min-word guard** (a builder Save disabled at `< 2`): run
```bash
grep -rn --include="*.ts" --include="*.tsx" -e "words.length >= 2" -e "words.length < 2" -e "length === 1" app lib | grep -iv "\.test\."
```
Expected after Steps 1-2: no remaining `>= 2` / `< 2` phrase-word guards. If any save-path guard appears, relax it to `>= 1` / `< 1` the same way and note it in the commit.

- [ ] **Step 4: Verify app tsc.** Expected: clean.

- [ ] **Step 5: Verify in Chrome.** On a HI board, edit a phrase variant down to a single word → confirm it stays visible and tappable in the phrase bank with no warning border; the EN 2-word sibling on the EN board is unaffected.

- [ ] **Step 6: Commit.**
```bash
git add app/components/app/shared/ui/TalkerDropdown.tsx app/components/app/sentences/sections/InlinePhraseEditor.tsx
git commit -m "feat(variant-lifecycle): allow 1-word phrases (variant may be a single word)"
```

---

### Task 6: List label Revert (stripLocaleKey) — separable, do last

**Files:**
- Create/Modify: `lib/languages/variants.ts` (add `stripLocaleKey`)
- Modify: `convex/profileLists.ts` (add `revertProfileListLanguage`)
- Modify: `app/components/app/lists/sections/ListsModeContent.tsx` (list edit toolbar `:169` region + pendingRevert + confirm + call)
- Modify: `messages/en.json`

**Interfaces (Produces):** `stripLocaleKey(rec, locale)` (record→record without the key; passes strings/undefined through); `revertProfileListLanguage({ profileListId, language }) => void`.

- [ ] **Step 1: Add `stripLocaleKey`** to `lib/languages/variants.ts`:
```ts
/** Drop one locale's key from a localised record; strings/undefined pass through unchanged. */
export function stripLocaleKey(
  rec: Record<string, string> | string | undefined,
  locale: string,
): Record<string, string> | string | undefined {
  if (rec == null || typeof rec === 'string') return rec;
  const { [locale]: _drop, ...rest } = rec;
  return rest;
}
```

- [ ] **Step 2: Add the Convex mutation** `revertProfileListLanguage` to `convex/profileLists.ts` (strips the board key from `name` + each item `description`; auth pattern per Global Constraints). Because it touches only per-language text keys (not R2 assets), it returns nothing:
```ts
export const revertProfileListLanguage = mutation({
  args: { profileListId: v.id("profileLists"), language: v.string() },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) throw new Error("Not authorised");
    const name = stripLocaleKey(list.name, args.language);
    const items = list.items.map((it) => ({
      ...it,
      ...(it.description !== undefined
        ? { description: stripLocaleKey(it.description, args.language) }
        : {}),
    }));
    await ctx.db.patch(args.profileListId, { name, items, updatedAt: Date.now() });
  },
});
```
Import `stripLocaleKey` from `"../lib/languages/variants"`. **Verify Convex tsc + confirm `convex dev` pushed `revertProfileListLanguage` before wiring the UI** (deploy-order gate).

- [ ] **Step 3: List Revert visibility + UI.** Show the ↩ in the list edit toolbar (beside the delete button, `ListsModeContent.tsx:169`) only when `typeof list.name === 'object' && list.name[language] != null && Object.keys(list.name).some((k) => k !== language)` (a board key over a surviving origin key). On tap → `setPendingRevert({ id, name })`; a light confirm dialog (mirror `:661-668`) → call `revertProfileListLanguage({ profileListId, language })`. Add en.json keys `lists.rowRevert` / `lists.revertConfirm` (mirror Task 4 copy).

- [ ] **Step 4: Verify app tsc.** Expected: clean.

- [ ] **Step 5: Verify in Chrome.** On a HI board, rename a list (adds a HI `name` key) → the ↩ appears; tap it → the list falls back to its origin label; the origin board is unchanged.

- [ ] **Step 6: Commit.**
```bash
git add lib/languages/variants.ts convex/profileLists.ts app/components/app/lists/sections/ListsModeContent.tsx messages/en.json
git commit -m "feat(variant-lifecycle): list label Revert strips this board's language key (Stage 3, lists)"
```

---

### Task 7: Docs — ADR-016 addendum + stage tracker + 1-word note

**Files:**
- Modify: `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`
- Modify: `docs/superpowers/specs/2026-07-18-language-variant-lifecycle-design.md` (stage tracker)

- [ ] **Step 1:** Add "Addendum J — Stages 3 & 4 (Revert + whole-item Delete)" to ADR-016 recording: Delete = whole item (group mutations + `/api/delete-composed` + heavy confirm), Revert = this-board variant (edit-mode ↩ + light confirm), personal-recording-only R2 cleanup (shared TTS never deleted), and the 1-word-phrase relaxation. State it **supersedes §5** ("Delete semantics — delete-one-variant + promote-source").

- [ ] **Step 2:** In the lifecycle design spec, flip the Stage 3 & 4 tracker rows to ✅ (shipped `main`, 2026-07-19).

- [ ] **Step 3: Move this plan to `_done/`** and commit:
```bash
git mv docs/4-builds/plans/phase-15.6-variant-lifecycle-3-4-delete-revert.md docs/4-builds/plans/_done/
git add -A
git commit -m "docs(variant-lifecycle): ADR-016 Addendum J (Stages 3&4) + stage tracker; move plan to _done"
```

---

## Self-review — spec coverage

- Spec Thread 1 (Delete whole-item) → Tasks 1-3. Personal-recording cleanup, never shared TTS → Task 1 collectors + Task 2 route (`isPersonalAssetKey` gate). Heavy confirm → Task 3. Lists unchanged (delete) → confirmed no change; list DELETE stays as-is per spec.
- Spec Thread 2 (Revert) → Task 4 (composed) + Task 6 (lists). Predicate `variantGroupId set && !== _id` → Task 4 Step 1. Light confirm, edit-toolbar ↩, origin/fallback hiding → Task 4 Steps 3/5/9.
- Spec Thread 3 (1-word phrases) → Task 5 (filter `>=2`→`>=1`, incomplete `<2`→`<1`, guard audit).
- Deploy ordering, en-json-only, shared-TTS-never-deleted → Global Constraints + per-task gates.
- Verification (tsc + Chrome + owner Convex/R2) → every task's verify steps, matching the no-test-runner reality.
