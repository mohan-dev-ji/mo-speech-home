# Voice-follows-text Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Untranslated composed content speaks in its authored ("made-in") language's voice — persona-matched — instead of the active board accent, and the `ttsCache` rows already polluted with wrong-voice clips are removed.

**Architecture:** Extract the existing "voice follows the resolved text language" pattern (already inline in phrases and sentences) into one shared helper (`lib/audio/resolveSpokenVoice.ts`), point all four composed-content play paths at it, and fix lists (the outlier) to match. Then clean the polluted cache via a one-off `_id` hit-list script that deletes rows (Convex) and their R2 objects (S3).

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Convex 1.x, Cloudflare R2 (`@aws-sdk/client-s3`), next-intl. **No unit-test runner exists in this repo** (no vitest/jest/test files) — verification is TypeScript type-check + ESLint + observed playback in the running dev server via the existing `[TTS]` console log. This is a deliberate adaptation to the codebase; do not add a test framework.

## Global Constraints

- **Work on `main`.** Do not create a branch or worktree unless asked (per project convention).
- **Do NOT run `npm run dev`.** The dev server is already running on **port 3001**; reuse it.
- **Do NOT run `npx convex dev`.** Type-check Convex with `npx tsc -p convex/tsconfig.json`. Convex is deployed from `main` (auto-push) — the cleanup script's `npx convex run` targets that live deployment.
- **Convex CLI needs Node 20+.** Prefix CLI/script commands with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **AAC theme tokens only** — not relevant here (no UI/style changes), but do not introduce hard-coded colours/spacing.
- **Never hard-code UI copy** — not relevant here (no new user-facing strings).
- **Browser verification uses claude-in-chrome** (real signed-in Chrome), not the in-app browser.
- **Voice ids in scope:** `en-GB-News-M`, `en-GB-News-G` (English M/F); `es-US-Wavenet-C`, `es-US-Wavenet-A` (Spanish M/F); `hi-IN-Wavenet-F`, `hi-IN-Wavenet-E` (Hindi M/F). Pollution lives only under the non-English (`hi-IN-*`, `es-US-*`) `tts/` folders.
- **Hit-list file:** `docs/4-builds/prompts/tts-hit-list.md` — one `ttsCache` `_id` per line, 76 unique ids (one duplicate line, deduped by the script).

---

### Task 1: Shared `resolveSpokenVoice` helper

The single chokepoint that maps a text's resolved language → a persona-matched voice. Every play path calls this after Task 1, so the voice can never again diverge from the spoken text's language.

**Files:**
- Create: `lib/audio/resolveSpokenVoice.ts`

**Interfaces:**
- Consumes:
  - `resolvedLocale(value: Record<string, unknown> | undefined, currentLang: string, defaultLang?: string): string | undefined` from `lib/languages/displayValue`
  - `DEFAULT_LOCALE` (`"en"`) from `lib/languages/registry`
  - `personaOf(voiceId): VoicePersona` and `voiceForLanguage(lang: string, persona?: VoicePersona): VoiceId` from `lib/audio/resolveVoiceId`
- Produces (later tasks rely on these exact signatures):
  - `voiceForResolvedLocale(locale: string | undefined, activeVoiceId: string): string`
  - `resolveSpokenVoice(record: Record<string, string> | undefined, activeLang: string, activeVoiceId: string): { locale?: string; voiceId: string }`

- [ ] **Step 1: Create the helper file**

Create `lib/audio/resolveSpokenVoice.ts`:

```ts
import { resolvedLocale } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";
import { personaOf, voiceForLanguage } from "@/lib/audio/resolveVoiceId";

/**
 * The single rule: the voice follows the language the text resolved to.
 *
 * Given the locale a text actually resolved to (via `resolvedLocale`) and the
 * active board voice, return a persona-matched voice IN that locale's language.
 * When `locale` is undefined (no per-language record, or an empty one), the
 * active voice is returned unchanged — there is nothing to remap.
 *
 * This is the chokepoint every composed-content play path funnels through, so a
 * cross-language (text-language ≠ voice-language) clip can never be synthesised
 * or cached again. See ADR-018.
 */
export function voiceForResolvedLocale(
  locale: string | undefined,
  activeVoiceId: string,
): string {
  return locale ? voiceForLanguage(locale, personaOf(activeVoiceId)) : activeVoiceId;
}

/**
 * Record-based convenience wrapper: resolve which locale a localized text record
 * falls back to on the active board, then map it to a persona-matched voice.
 *
 * Untranslated content → the authored ("made-in") language's voice: a record
 * authored only in English, viewed on a Hindi board, resolves to `en` and speaks
 * in an English voice matching the board voice's persona — never English words in
 * a Hindi accent. Returns both the resolved `locale` (for callers that also need
 * it) and the `voiceId` to speak with.
 */
export function resolveSpokenVoice(
  record: Record<string, string> | undefined,
  activeLang: string,
  activeVoiceId: string,
): { locale?: string; voiceId: string } {
  const locale = record ? resolvedLocale(record, activeLang, DEFAULT_LOCALE) : undefined;
  return { locale, voiceId: voiceForResolvedLocale(locale, activeVoiceId) };
}
```

- [ ] **Step 2: Type-check the helper**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `tsc` reports pre-existing unrelated errors elsewhere, confirm none reference `lib/audio/resolveSpokenVoice.ts`.

- [ ] **Step 3: Lint the helper**

Run: `npx eslint lib/audio/resolveSpokenVoice.ts`
Expected: no errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add lib/audio/resolveSpokenVoice.ts
git commit -m "feat(audio): shared resolveSpokenVoice helper (voice follows text language)

The single chokepoint mapping a resolved text locale to a persona-matched
voice. Adopted by every composed-content play path in following tasks so the
voice can never diverge from the spoken text's language (ADR-018).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Fix list-item playback (the bug)

Replace the Option 2 logic (raw board voice + `literal` flipped on translation-exists) with the shared helper: always speak the exact text, always `literal: true`, in the voice of the language the text resolved to.

**Files:**
- Modify: `app/components/app/lists/sections/ListDetailDisplay.tsx` (imports near line 7; `ListItemPlayModal` mount effect lines ~92–101)

**Interfaces:**
- Consumes: `resolveSpokenVoice` from Task 1.

- [ ] **Step 1: Add the helper import**

In `app/components/app/lists/sections/ListDetailDisplay.tsx`, the current import (line 7) is:

```ts
import { playKey, playTts } from '@/lib/audio/playTts';
```

Add directly beneath it:

```ts
import { resolveSpokenVoice } from '@/lib/audio/resolveSpokenVoice';
```

- [ ] **Step 2: Replace the Option 2 branch**

Find this block (lines ~92–102) inside the `useEffect`:

```ts
      } else if (item.description) {
        // Audio follows the item's text. If the item HAS an authored translation
        // in the active language, speak it exactly (literal) in the board voice.
        // If it DOESN'T (the resolved string fell back to another language), go
        // non-literal so the English word resolves the symbol's seeded localized
        // clip — like a category tap — instead of speaking the English fallback
        // in the active voice.
        const hasLocalised = !!item.descriptionRecord?.[language]?.trim();
        audioRef.current = null;
        playTts(item.description, voiceId, undefined, { literal: hasLocalised });
      }
```

Replace it with:

```ts
      } else if (item.description) {
        // Voice follows the resolved text's language (ADR-018). An untranslated
        // item (its description fell back to the authored language) speaks in that
        // language's voice — e.g. English "put on your shoes" on a Hindi board is
        // spoken by an English voice, not English words in a Hindi accent. Always
        // literal: speak the exact authored text, skipping the SymbolStix
        // per-language default lookup (matches how phrases/sentences behave).
        const { voiceId: spokenVoice } = resolveSpokenVoice(
          item.descriptionRecord,
          language,
          voiceId,
        );
        audioRef.current = null;
        playTts(item.description, spokenVoice, undefined, { literal: true });
      }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. `language` and `voiceId` are already in the effect's dependency array (line ~105) and remain used, so no unused-var errors.

- [ ] **Step 4: Lint**

Run: `npx eslint app/components/app/lists/sections/ListDetailDisplay.tsx`
Expected: no errors.

- [ ] **Step 5: Browser-verify the fix (the core proof)**

The dev server is already on port 3001. Using claude-in-chrome (real signed-in Chrome):
1. Open a **Hindi** board and a list containing an item whose description is **untranslated** (English text, no `hi` key) — e.g. "put on your shoes".
2. Tap the item to open the play modal.
3. Read the server console (the `next dev` terminal) for the `[TTS]` line, or the Network tab for the `/api/tts` request body.

Expected: `voiceId` is now an **English** voice (`en-GB-News-M`/`en-GB-News-G`, persona-matched to the board voice), **not** `hi-IN-*`. Before this fix it logged `hi-IN-Wavenet-*`. Also confirm a **translated** Hindi item still logs a `hi-IN-*` voice (no regression).

- [ ] **Step 6: Commit**

```bash
git add app/components/app/lists/sections/ListDetailDisplay.tsx
git commit -m "fix(lists): untranslated items speak the made-in voice, not the board accent

Adopt resolveSpokenVoice + always literal; retire Option 2's symbol-localized
detour for untranslated list items. English fallback text now speaks in an
English voice (persona-matched) instead of English-words-in-a-Hindi-accent,
and no cross-language ttsCache row is written (ADR-018).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Refactor phrase play paths onto the helper

Behaviour-preserving DRY: `PersistentTalker.playItem` and `CompositionPlayModal` (`playOne` + `playFluent`) already compute `voiceForLanguage(loc, personaOf(voiceId))` inline. Route them through the shared helper so all paths share one chokepoint.

**Files:**
- Modify: `app/components/app/shared/sections/PersistentTalker.tsx` (imports lines 27–30; `playItem` lines ~89–93)
- Modify: `app/components/app/shared/modals/CompositionPlayModal.tsx` (imports lines 10–11; `playOne` line ~57; `playFluent` line ~109)

**Interfaces:**
- Consumes: `resolveSpokenVoice`, `voiceForResolvedLocale` from Task 1.

- [ ] **Step 1: PersistentTalker — swap inline resolution for the helper**

In `app/components/app/shared/sections/PersistentTalker.tsx`, the imports (lines 27–30) are:

```ts
import { displayString, resolvedLocale } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { playTts } from '@/lib/audio/playTts';
import { personaOf, voiceForLanguage } from '@/lib/audio/resolveVoiceId';
```

`displayString` is used elsewhere in the file — keep it. `resolvedLocale`, `DEFAULT_LOCALE`, `personaOf`, `voiceForLanguage` become unused after this edit. Change these four lines to:

```ts
import { displayString } from '@/lib/languages/displayValue';
import { playTts } from '@/lib/audio/playTts';
import { resolveSpokenVoice } from '@/lib/audio/resolveSpokenVoice';
```

Then in `playItem` (lines ~89–93), replace:

```ts
      const loc = item.phraseNameRecord
        ? resolvedLocale(item.phraseNameRecord, language, DEFAULT_LOCALE)
        : undefined;
      const voice = loc ? voiceForLanguage(loc, personaOf(voiceId)) : voiceId;
      void playTts(item.phraseName ?? item.label, voice);
```

with:

```ts
      // Voice follows the resolved text's language (ADR-018) via the shared helper.
      const { voiceId: voice } = resolveSpokenVoice(item.phraseNameRecord, language, voiceId);
      void playTts(item.phraseName ?? item.label, voice);
```

> Note: if `tsc` in Step 4 reports `resolvedLocale` or `DEFAULT_LOCALE` is still used elsewhere in this file, restore only the still-needed import rather than removing it. (Grep first: `grep -n "resolvedLocale\|DEFAULT_LOCALE\|personaOf\|voiceForLanguage" app/components/app/shared/sections/PersistentTalker.tsx` — expect matches only in the lines you are editing.)

- [ ] **Step 2: CompositionPlayModal — swap both inline sites for `voiceForResolvedLocale`**

In `app/components/app/shared/modals/CompositionPlayModal.tsx`, the import (line 11) is:

```ts
import { personaOf, voiceForLanguage } from '@/lib/audio/resolveVoiceId';
```

Replace it with:

```ts
import { voiceForResolvedLocale } from '@/lib/audio/resolveSpokenVoice';
```

In `playOne` (line ~57), replace:

```ts
      const blockVoice = b.locale ? voiceForLanguage(b.locale, personaOf(voiceId)) : voiceId;
```

with:

```ts
      const blockVoice = voiceForResolvedLocale(b.locale, voiceId);
```

In `playFluent` (line ~109), replace:

```ts
    const voice = locale ? voiceForLanguage(locale, personaOf(voiceId)) : voiceId;
```

with:

```ts
    const voice = voiceForResolvedLocale(locale, voiceId);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. No unused-import errors (verify with the grep in Step 1's note if needed).

- [ ] **Step 4: Lint both files**

Run: `npx eslint app/components/app/shared/sections/PersistentTalker.tsx app/components/app/shared/modals/CompositionPlayModal.tsx`
Expected: no errors (in particular, no `no-unused-vars`).

- [ ] **Step 5: Browser sanity-check (no behaviour change)**

Using the running dev server: tap a talker phrase chip and play a composed sentence via the block modal on a non-English board. Confirm the `[TTS]` voice for an English-authored phrase/block is still an English voice (unchanged from before — this task is behaviour-preserving) and Hindi-authored content still Hindi.

- [ ] **Step 6: Commit**

```bash
git add app/components/app/shared/sections/PersistentTalker.tsx app/components/app/shared/modals/CompositionPlayModal.tsx
git commit -m "refactor(audio): route phrase play paths through resolveSpokenVoice

Behaviour-preserving DRY — PersistentTalker.playItem and CompositionPlayModal
(playOne + playFluent) now share the single voice-follows-text chokepoint
instead of duplicating resolvedLocale/voiceForLanguage inline (ADR-018).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Refactor sentence play path onto the helper

`SentencePlayModal` already receives a resolved `textLocale` prop and computes `effVoice` inline. Route it through `voiceForResolvedLocale`. Behaviour-preserving.

**Files:**
- Modify: `app/components/app/sentences/modals/SentencePlayModal.tsx` (import line 12; `effVoice` line ~66)

**Interfaces:**
- Consumes: `voiceForResolvedLocale` from Task 1.

- [ ] **Step 1: Swap the import**

In `app/components/app/sentences/modals/SentencePlayModal.tsx`, line 12 is:

```ts
import { personaOf, voiceForLanguage } from '@/lib/audio/resolveVoiceId';
```

Replace it with:

```ts
import { voiceForResolvedLocale } from '@/lib/audio/resolveSpokenVoice';
```

- [ ] **Step 2: Swap the `effVoice` computation**

At line ~66, replace:

```ts
  // Voice follows the resolved text's language (Phase 15, 3e).
  const effVoice = textLocale ? voiceForLanguage(textLocale, personaOf(voiceId)) : voiceId;
```

with:

```ts
  // Voice follows the resolved text's language (ADR-018) via the shared helper.
  const effVoice = voiceForResolvedLocale(textLocale, voiceId);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (`personaOf`/`voiceForLanguage` were only used on this line; confirm with `grep -n "personaOf\|voiceForLanguage" app/components/app/sentences/modals/SentencePlayModal.tsx` → no remaining matches.)

- [ ] **Step 4: Lint**

Run: `npx eslint app/components/app/sentences/modals/SentencePlayModal.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/app/sentences/modals/SentencePlayModal.tsx
git commit -m "refactor(audio): route SentencePlayModal through voiceForResolvedLocale

Behaviour-preserving — the sentence play modal now shares the single
voice-follows-text chokepoint instead of computing the voice inline (ADR-018).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Convex cleanup functions

Two internal Convex functions (admin-run via `npx convex run`): a read-only preview and a delete-and-return-keys mutation. Rows are deleted first; their `r2Key`s are returned so the script deletes the R2 objects after (row-before-object safety).

**Files:**
- Modify: `convex/migrations.ts` (append two functions; `mutation`/`query`/`internalMutation`/`internalQuery`/`v` are already imported at the top)

**Interfaces:**
- Produces (Task 6 relies on these):
  - `internal.migrations.getTtsCacheRowsByIds({ ids: Id<"ttsCache">[] })` → `Array<{ _id, r2Key, text, voiceId, tone?: string }>` (missing ids are silently omitted)
  - `internal.migrations.purgeTtsCacheRowsByIds({ ids: Id<"ttsCache">[] })` → `{ deletedKeys: string[]; deleted: number; missing: number }`

- [ ] **Step 1: Append the preview query and purge mutation**

Add to the end of `convex/migrations.ts`:

```ts
// ─── One-off: purge wrong-voice ttsCache rows (ADR-018 cache hygiene) ──────────
// Removes rows polluted with cross-language clips (e.g. English text synthesised
// under a hi-IN/es-US voice). Driven by an owner-curated _id hit-list run through
// scripts/purge-tts-cache.mjs. Internal — admin-only via `npx convex run`.

/** Read-only preview: return the rows for these ids (for a dry run). */
export const getTtsCacheRowsByIds = internalQuery({
  args: { ids: v.array(v.id("ttsCache")) },
  handler: async (ctx, { ids }) => {
    const rows: Array<{
      _id: Id<"ttsCache">;
      r2Key: string;
      text: string;
      voiceId: string;
      tone?: string;
    }> = [];
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (!doc) continue; // already gone — idempotent
      rows.push({
        _id: doc._id,
        r2Key: doc.r2Key,
        text: doc.text,
        voiceId: doc.voiceId,
        tone: doc.tone,
      });
    }
    return rows;
  },
});

/**
 * Delete the given ttsCache rows and return their R2 keys so the caller can
 * delete the objects (row-before-object: the rows are gone before any object is
 * removed, so no live play can hit a row pointing at a deleted file). Idempotent:
 * ids that no longer exist are counted as `missing`, not errors.
 */
export const purgeTtsCacheRowsByIds = internalMutation({
  args: { ids: v.array(v.id("ttsCache")) },
  handler: async (ctx, { ids }) => {
    const deletedKeys: string[] = [];
    let missing = 0;
    for (const id of ids) {
      const doc = await ctx.db.get(id);
      if (!doc) {
        missing++;
        continue;
      }
      deletedKeys.push(doc.r2Key);
      await ctx.db.delete(id);
    }
    return { deletedKeys, deleted: deletedKeys.length, missing };
  },
});
```

- [ ] **Step 2: Type-check Convex**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json`
Expected: PASS (no errors). `Id` is already imported (`import type { Doc, Id, TableNames } from "./_generated/dataModel";`).

- [ ] **Step 3: Commit**

```bash
git add convex/migrations.ts
git commit -m "feat(migrations): internal ttsCache purge-by-ids functions (ADR-018)

getTtsCacheRowsByIds (dry-run preview) + purgeTtsCacheRowsByIds (delete rows,
return R2 keys for object cleanup). Internal, admin-run via npx convex run.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Cleanup script (`scripts/purge-tts-cache.mjs`)

Reads the hit-list, previews by default, and on `--commit` deletes the rows (Convex) then their R2 objects (S3). Follows the repo's existing script patterns: `npx convex run` for Convex (per `backfill-audio-basenames.mjs`), a direct `S3Client` for R2 (per `checkR2Audio.mjs`).

**Files:**
- Create: `scripts/purge-tts-cache.mjs`

**Interfaces:**
- Consumes: `internal.migrations.getTtsCacheRowsByIds`, `internal.migrations.purgeTtsCacheRowsByIds` from Task 5; the hit-list at `docs/4-builds/prompts/tts-hit-list.md`.

- [ ] **Step 1: Create the script**

Create `scripts/purge-tts-cache.mjs`:

```js
/**
 * One-off cache hygiene (ADR-018): delete ttsCache rows polluted with
 * cross-language clips (English text synthesised under a hi-IN/es-US voice),
 * plus their R2 objects. Ids come from the owner-curated hit-list.
 *
 * Dry run (default) — prints what WOULD be deleted, changes nothing:
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   node --env-file=.env.local scripts/purge-tts-cache.mjs
 *
 * Commit the deletion (rows first, then R2 objects):
 *   node --env-file=.env.local scripts/purge-tts-cache.mjs --commit
 *
 * Idempotent: re-running after a commit reports the ids as already gone.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const HIT_LIST = process.env.HIT_LIST ?? "docs/4-builds/prompts/tts-hit-list.md";
const COMMIT = process.argv.includes("--commit");

// ── Parse + dedupe the hit-list ───────────────────────────────────────────────
const ids = [
  ...new Set(
    readFileSync(HIT_LIST, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  ),
];
if (ids.length === 0) {
  console.error(`❌ No ids found in ${HIT_LIST}`);
  process.exit(1);
}
console.log(`📖 ${ids.length} unique ids from ${HIT_LIST}`);

// ── Helper: call a Convex function via the CLI (admin), args via temp file ─────
function convexRun(fnRef, argsObj) {
  const tmpFile = join(tmpdir(), `purge-tts-${Date.now()}.json`);
  writeFileSync(tmpFile, JSON.stringify(argsObj));
  try {
    const stdout = execSync(`npx convex run ${fnRef} "$(cat ${tmpFile})"`, {
      encoding: "utf8",
    });
    return JSON.parse(stdout);
  } finally {
    unlinkSync(tmpFile);
  }
}

// ── Dry run: preview only ─────────────────────────────────────────────────────
if (!COMMIT) {
  const rows = convexRun("migrations:getTtsCacheRowsByIds", { ids });
  console.log(`\n🔎 DRY RUN — ${rows.length} rows would be deleted:\n`);
  for (const r of rows) {
    console.log(`  ${r.voiceId}  "${r.text}"  →  ${r.r2Key}`);
  }
  const missing = ids.length - rows.length;
  if (missing > 0) console.log(`\n  (${missing} ids not found — already gone)`);
  console.log(`\nRe-run with --commit to delete rows + R2 objects.`);
  process.exit(0);
}

// ── Commit: delete rows first (Convex), then R2 objects ───────────────────────
console.log(`\n🗑  Deleting ${ids.length} ttsCache rows…`);
const { deletedKeys, deleted, missing } = convexRun(
  "migrations:purgeTtsCacheRowsByIds",
  { ids }
);
console.log(`   rows deleted: ${deleted}   already gone: ${missing}`);

// R2 client (same construction as scripts/checkR2Audio.mjs).
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error(
    "❌ Rows deleted, but R2 env vars are missing — objects NOT removed. " +
      "Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME and re-run --commit " +
      "(rows are already gone, so only the orphaned objects remain — harmless, but re-run to reclaim them)."
  );
  process.exit(1);
}
const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

console.log(`\n🪣 Deleting ${deletedKeys.length} R2 objects from ${bucketName}…`);
let objDeleted = 0;
for (const key of deletedKeys) {
  // R2 DeleteObject is idempotent — a missing key is not an error.
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
  objDeleted++;
}

console.log(`\n✅ Done. rows=${deleted} objects=${objDeleted} alreadyGone=${missing}`);
```

- [ ] **Step 2: Lint the script**

Run: `npx eslint scripts/purge-tts-cache.mjs`
Expected: no errors. (If ESLint's config does not cover `scripts/*.mjs`, skip — the other `scripts/*.mjs` files are plain Node modules; do not add config for them.)

- [ ] **Step 3: Commit**

```bash
git add scripts/purge-tts-cache.mjs
git commit -m "chore(scripts): purge-tts-cache one-off for ADR-018 cache hygiene

Reads the _id hit-list, previews by default, and on --commit deletes the
ttsCache rows (Convex, row-first) then their R2 objects (S3). Idempotent.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Run the cleanup and verify end-to-end

This task is operational (runs the script against the live `main` deployment) — the owner (Mo) should run or confirm the commit step, since it deletes live cache rows + R2 objects.

**Files:** none (execution + verification only).

- [ ] **Step 1: Dry run — preview the hit-list**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
node --env-file=.env.local scripts/purge-tts-cache.mjs
```

Expected: a list of rows, each showing a **non-English voice** (`hi-IN-*`/`es-US-*`) against **Latin-script English text** (the pollution signature). Sanity-check a few lines confirm the mismatch. If any row looks like a *correct* clip (e.g. `hi-IN-*` against Devanagari text, or an English voice), note it — but recall a mis-flag is self-healing (the row regenerates correctly on next play), so it is safe to proceed.

- [ ] **Step 2: Commit the deletion (owner-run)**

Run:

```bash
node --env-file=.env.local scripts/purge-tts-cache.mjs --commit
```

Expected: `✅ Done. rows=<n> objects=<n> alreadyGone=0` (or a small `alreadyGone` if any were already cleared).

- [ ] **Step 3: Confirm idempotency**

Re-run the dry run:

```bash
node --env-file=.env.local scripts/purge-tts-cache.mjs
```

Expected: `0 rows would be deleted` and `(<n> ids not found — already gone)`.

- [ ] **Step 4: Browser-verify no re-infection**

Using the running dev server (port 3001) + claude-in-chrome:
1. Re-open the Hindi board list item that previously played the wrong voice.
2. Tap it. First tap regenerates (the row was purged): the `[TTS]` log shows `source:"generated"` (or `"symbolstix"` for a matched word) under an **English** voice.
3. Tap again: `source:"cache"` under the **same English** voice — the newly cached row is correct-voice, proving re-infection can't recur.

- [ ] **Step 5: Final verification sweep**

Run the full type-check and lint once more across the change:

```bash
npx tsc --noEmit
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json
npx eslint lib/audio/resolveSpokenVoice.ts app/components/app/lists/sections/ListDetailDisplay.tsx app/components/app/shared/sections/PersistentTalker.tsx app/components/app/shared/modals/CompositionPlayModal.tsx app/components/app/sentences/modals/SentencePlayModal.tsx
```

Expected: all PASS.

- [ ] **Step 6: Investigate + document the auto-matched-item record shape (spec §6 open question)**

Determine whether an auto-matched list item stores just `{ en: "eat" }` or inherits the symbol's full `{ en, hi, es }` labels. Inspect a real auto-matched item's `descriptionRecord` (Convex dashboard, or a `checkMany`-style read) on a fresh auto-matched list item. Record the finding as a one-line note in `docs/4-builds/decisions/ADR-018-voice-follows-text-fallback.md` (append under Consequences): whether auto-matched symbol words speak the localized clip (record inherited) or the made-in voice (English-only record). No code change — the rule holds either way; this only documents the observed behaviour. Commit the doc note.

---

## Self-Review

**Spec coverage:**
- §2 the one rule + §2.2 shared foundation → **Task 1** (`resolveSpokenVoice` + `voiceForResolvedLocale`). ✓
- §3.2 list fix (adopt helper, always literal, delete Option 2) → **Task 2**. ✓
- §3 scope: phrases refactored → **Task 3**; sentences refactored → **Task 4**; categories untouched (no task, correct — they're out of scope by design). ✓
- §4 targeted `_id` hit-list cleanup (rows + R2 objects, row-before-object) → **Tasks 5 + 6 + 7**. ✓
- §4.1 mis-flags self-heal → verified operationally in **Task 7 Step 1 note + Step 4**. ✓
- §5 re-infection prevention (single chokepoint) → structurally guaranteed by Tasks 1–4; proven in **Task 7 Step 4**. ✓
- §6 open question (auto-matched record shape) → **Task 7 Step 6**. ✓
- §7 deliverables all mapped; §8 non-goals respected (no category change, no text-record change, no recorded-audio change, no mass wipe/prefix delete). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every verify step gives an exact command + expected result. ✓

**Type consistency:** `voiceForResolvedLocale(locale, activeVoiceId): string` and `resolveSpokenVoice(record, activeLang, activeVoiceId): { locale?, voiceId }` are used with those exact names/shapes in Tasks 2–4. Convex refs `internal.migrations.getTtsCacheRowsByIds` / `purgeTtsCacheRowsByIds` and their arg shape `{ ids }` match between Task 5 (definition) and Task 6 (`migrations:getTtsCacheRowsByIds` / `migrations:purgeTtsCacheRowsByIds` via `convex run`). ✓
