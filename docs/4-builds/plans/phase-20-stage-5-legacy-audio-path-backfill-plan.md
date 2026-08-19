# Phase 20 — Stage 5: retire persisted `audio/eng/default/` paths

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to work through this task-by-task. Steps use `- [ ]` checkboxes.

> **For a fresh session:** this plan is self-contained — you do NOT need any prior conversation. Read it top to bottom, then execute task by task.

**Written:** 2026-08-15 · **Owner:** Mo · **Status:** ready to execute (not started)
**Follows:** `docs/4-builds/plans/_done/phase-20-en-gb-news-m-reseed-plan.md` (Stages 0–3 + 4a shipped; 4b deliberately not done)

**Goal:** stop Home from serving symbol audio out of the legacy `audio/eng/default/` prefix, by fixing the *persisted* paths that phase-20's resolver cutover left behind.

**Architecture:** two complementary fixes. (1) A read-time guard that treats any stored path under `audio/eng/default/` as a stale cache and re-resolves it by convention — self-healing, no migration, covers rows we haven't enumerated. (2) A one-off backfill for surfaces the client reads verbatim (list items, sentence units, phrases), where nothing re-resolves on read.

**Tech Stack:** Convex 1.x · Node 20.17.0 · Cloudflare R2 (`@aws-sdk/client-s3`) · TypeScript.

---

## Background — why this exists

Phase-20 Stage 3 flipped `resolveSymbolAudioPath` off its `en-GB-News-M` special case, so symbol audio now resolves to `audio/en-GB-News-M/symbols/<words.en>.mp3`. That was a pure code change, correctly described in the phase-20 plan as having "no data change to undo".

What it missed: several tables **persist a resolved audio path** rather than resolving on read. Rows written before the cutover still hold `audio/eng/default/<audioBasename>.mp3`, and they are served verbatim.

Observed on `main` after the cutover — note the two filename shapes interleaved:

```
GET /api/assets?key=audio/en-GB-News-M/symbols/go.mp3          ← live resolution
GET /api/assets?key=audio/en-GB-News-M/symbols/turn.mp3        ← live resolution
GET /api/assets?key=audio/eng/default/symbol00197645.mp3       ← persisted, stale
GET /api/assets?key=audio/eng/default/symbol00199933.mp3       ← persisted, stale
```

Word-named keys come from live resolution. SymbolStix-basename keys can only come from `symbols.audioBasename`, which **no runtime code reads any more** (post Stage 4a it survives only in `convex/schema.ts:358` and `convex/migrations.ts`). So each one is a string being read out of the database.

### Severity: not broken audio

Both observed objects still exist in R2 (`symbol00197645.mp3` 5376 bytes, `symbol00199933.mp3` 4992 bytes) and phase-20 deliberately never deletes `audio/eng/default/` because the live MVP serves it. **Playback works today.** The defects are:

- Affected items are **frozen** — they ignore voice switching and language switching, because nothing re-resolves them.
- Phase-20's acceptance criterion *"Home no longer depends on `audio/eng/default/`"* is **not actually met**.
- It blocks ever retiring the legacy prefix or `audioBasename` for Home.

**This means the migration is safe to do incrementally and safe to leave partially complete** — any row not yet rewritten keeps playing from the legacy object. There is no window where audio breaks. Use that: prefer leaving a row alone over guessing at a rewrite.

### The one fact that makes the read-time fix safe

From `lib/r2-paths.ts:30-38`, generated TTS is stored at `audio/<voiceId>/tts/<uuid>.mp3`, and human recordings under `profiles/<id>/audio/…` or `accounts/<id>/audio/…`.

Therefore **a stored path under `audio/eng/default/` is always the SymbolStix default clip** — never custom TTS, never a recording. Re-resolving it by convention yields the same spoken content from the new path. This is why we can skip a stale entry and fall through to `resolveSymbolAudioPath` without changing what any tile says.

### The affected surfaces

| # | Surface | Where | Re-resolves on read? |
|---|---|---|---|
| 1 | `profileSymbols.audio[lang]` entries (`type:'tts'`) | served verbatim at `convex/profileCategories.ts:229` | No — but *can* be made to |
| 2 | `profileLists.items[].audioPath` / `.defaultAudioPath` | `convex/profileLists.ts:136,140`; client reads directly | No |
| 3 | `profileSentences.units[]` (word `audioPath`; phrase `audioPath` + nested `words[].audioPath`) | `compositionUnit` / `compositionWord`, `convex/schema.ts:230-257` | No |
| 4 | `profilePhrases.audioPath` + `.words[].audioPath` | `convex/schema.ts` `profilePhrases` | No |
| 5 | `libraryModules` sentence/phrase content arrays | `libraryModuleSentenceItems`, `libraryModulePhraseItems` | No — **and these seed every new account** |

Surface 5 matters most if it is non-empty: a legacy path baked into the default manifest is not a legacy-data problem but an ongoing one, re-seeded into every account created from here on. Task 1 tells us whether it is real.

`recordedAudioPath` is never affected (recordings live under `accounts/`/`profiles/`). Do not touch it.

### The rewrite rule

```
audio/eng/default/<basename>.mp3   →   audio/en-GB-News-M/symbols/<words.en>.mp3
```

Resolve `<basename>` → `words.en` by matching `symbols.audioBasename === <basename>`.

Two wrinkles, both real:

- **Not every basename is a SymbolStix id.** `scripts/checkR2Audio.mjs:29-32` shows plain-word legacy keys too (`hello.mp3`, `yes.mp3`, `no.mp3`). If no symbol matches by `audioBasename`, fall back to matching a symbol whose `words.en` equals the basename; if that also fails, **leave the row untouched and report it**.
- **Gate on seeded + present.** Only rewrite when the target symbol has `audio["en-GB-News-M"] === true` AND the new R2 object actually exists. Phase-20 Stage 2 reported 0 missing, so this should always hold — but verify rather than assume, because a wrong rewrite turns working audio into silence, which is strictly worse than the stale path we started with.

This is also why phase-20 Stage 4b ("remove `audioBasename`") must stay un-done until Stage 5 completes: **the backfill depends on `audioBasename` as its reverse-lookup key.** Note that in the plan doc when you finish.

---

## Global Constraints

- **Where to work:** `main`. Tasks 3–5 add Convex functions that must be deployed to run, and `npx convex dev` runs on `main` only. A worktree cannot execute this plan's migrations. If `main` is busy, wait rather than branching.
- **Never run `npx convex dev`** yourself — the owner already runs it. It would create an anonymous local backend and rewrite `.env.local`.
- **Never run `npm run dev`** — the owner keeps the dev server on port 3001.
- **Node 20+** for every command: prefix with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **No unit-test runner exists.** Verification is: `npx tsc --noEmit` · `npx tsc -p convex/tsconfig.json` · `npx eslint <files>` · script dry-run reports · R2 HEAD checks · owner-run browser acceptance.
- **Type-check baseline:** `npx tsc --noEmit` emits exactly one pre-existing, unrelated error — `lib/stripe.ts(8,3): error TS2322` (Stripe API-version literal). That is the baseline. `npx tsc -p convex/tsconfig.json` is clean and must stay clean.
- **Back up before any mass mutation** (per CLAUDE.md) — Task 3 Step 1.
- **Never delete `audio/eng/default/` objects from R2.** The live MVP (100+ users) serves them.
- Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Task 1: Audit — count what is actually affected (read-only)

No behaviour change. Establishes real scope before anything is rewritten, and decides whether Task 4 is needed at all.

**Files:**
- Modify: `convex/migrations.ts` (append a new export)

- [ ] **Step 1: Add the shared legacy-key predicate**

In `lib/audio/resolveAudioPath.ts`, append below `resolveSymbolAudioPath`:

```ts
/** The pre-phase-20 SymbolStix prefix. Retired for Home; the live MVP still serves it. */
export const LEGACY_SYMBOL_AUDIO_PREFIX = "audio/eng/default/";

/**
 * True when `key` is a persisted pre-phase-20 SymbolStix default clip.
 *
 * Such a key is ALWAYS the symbol's own default audio — generated TTS lives at
 * `audio/<voiceId>/tts/<uuid>.mp3` and recordings under `profiles/`/`accounts/`
 * (see lib/r2-paths.ts). So a legacy key can always be safely discarded and
 * re-resolved by convention without changing what is spoken.
 */
export function isLegacySymbolAudioKey(key: string | undefined | null): boolean {
  return typeof key === "string" && key.startsWith(LEGACY_SYMBOL_AUDIO_PREFIX);
}
```

- [ ] **Step 2: Add the audit query**

Append to `convex/migrations.ts` (it already imports from `../lib/audio/resolveAudioPath` indirectly via other modules — add the import at the top if absent):

```ts
import { isLegacySymbolAudioKey } from "../lib/audio/resolveAudioPath";

/**
 * Phase-20 Stage 5 audit. Counts persisted `audio/eng/default/` paths per
 * surface. Read-only — safe to run any time.
 */
export const auditLegacyAudioPaths = query({
  args: {},
  handler: async (ctx) => {
    const hits: Record<string, number> = {
      profileSymbols: 0,
      profileListItems: 0,
      profileSentenceUnits: 0,
      profilePhrases: 0,
      libraryModules: 0,
    };
    const samples: string[] = [];
    const note = (k: string) => {
      if (samples.length < 20 && !samples.includes(k)) samples.push(k);
    };

    for (const s of await ctx.db.query("profileSymbols").collect()) {
      const map = (s.audio as Record<string, { path?: string } | undefined>) ?? {};
      for (const entry of Object.values(map)) {
        if (isLegacySymbolAudioKey(entry?.path)) { hits.profileSymbols++; note(entry!.path!); }
      }
    }

    for (const l of await ctx.db.query("profileLists").collect()) {
      for (const it of l.items ?? []) {
        for (const p of [it.audioPath, it.defaultAudioPath]) {
          if (isLegacySymbolAudioKey(p)) { hits.profileListItems++; note(p!); }
        }
      }
    }

    for (const s of await ctx.db.query("profileSentences").collect()) {
      if (isLegacySymbolAudioKey(s.audioPath)) { hits.profileSentenceUnits++; note(s.audioPath!); }
      for (const u of s.units ?? []) {
        if (isLegacySymbolAudioKey(u.audioPath)) { hits.profileSentenceUnits++; note(u.audioPath!); }
        if (u.kind === "phrase") {
          for (const w of u.words ?? []) {
            if (isLegacySymbolAudioKey(w.audioPath)) { hits.profileSentenceUnits++; note(w.audioPath!); }
          }
        }
      }
    }

    for (const p of await ctx.db.query("profilePhrases").collect()) {
      if (isLegacySymbolAudioKey(p.audioPath)) { hits.profilePhrases++; note(p.audioPath!); }
      for (const w of p.words ?? []) {
        if (isLegacySymbolAudioKey(w.audioPath)) { hits.profilePhrases++; note(w.audioPath!); }
      }
    }

    for (const m of await ctx.db.query("libraryModules").collect()) {
      const blob = JSON.stringify(m);
      const found = blob.match(/audio\/eng\/default\/[^"]+\.mp3/g) ?? [];
      hits.libraryModules += found.length;
      found.forEach(note);
    }

    return { hits, samples, total: Object.values(hits).reduce((a, b) => a + b, 0) };
  },
});
```

- [ ] **Step 3: Type-check and lint**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx tsc -p convex/tsconfig.json
```
Expected: clean (no output). Then:
```bash
npx eslint convex/migrations.ts lib/audio/resolveAudioPath.ts
```

- [ ] **Step 4: Run the audit**

```bash
npx convex run migrations:auditLegacyAudioPaths
```

Record the output verbatim in your handoff — it sizes every task below.

**Decision gate:**
- `libraryModules > 0` → Task 4 is **required** (the default manifest is re-seeding legacy paths into new accounts).
- `libraryModules === 0` → Task 4 becomes a no-op; still run its verification step.
- `total === 0` → stop; the problem is elsewhere. Re-read the actual failing request and report back rather than proceeding.

- [ ] **Step 5: Commit**

```bash
git add convex/migrations.ts lib/audio/resolveAudioPath.ts
git commit -m "chore(audio): audit query for persisted legacy audio paths (phase-20 stage 5)

Counts audio/eng/default/ keys still persisted across profileSymbols, lists,
sentences, phrases and libraryModules. Read-only; sizes the Stage 5 backfill.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Read-time normalisation for board tiles (code-only, self-healing)

Fixes surface #1 with no migration. `convex/profileCategories.ts` already skips `type:'r2'` entries as a stale author-time cache (see its comment at lines 222–228); this extends the same treatment to any entry whose path is a legacy key, whatever its type.

**Files:**
- Modify: `convex/profileCategories.ts:217-233`

**Interfaces:**
- Consumes: `isLegacySymbolAudioKey` from Task 1 Step 1.

- [ ] **Step 1: Add the guard**

In `convex/profileCategories.ts`, add to the existing import from `../lib/audio/resolveAudioPath`:

```ts
import { resolveSymbolAudioPath, isLegacySymbolAudioKey } from "../lib/audio/resolveAudioPath";
```

Then change the override loop (currently lines ~221-233) so the condition also rejects legacy keys:

```ts
        for (const [lang, src] of Object.entries(overrides)) {
          // Only a GENUINE recording / TTS is a real per-language override. The
          // editor ALSO persists the SymbolStix default as a `type:'r2'` entry
          // (resolved with the board voice AT AUTHOR TIME). That is a stale cache,
          // not an override — if we let it populate `audio[lang]` it shadows the
          // live board-voice re-resolution below, freezing audio to the authoring
          // language so voice-follows-text breaks on every language switch. So skip
          // `r2` entries here and let the default-locale resolution own them.
          //
          // Phase-20 Stage 5: a path under `audio/eng/default/` is the same kind of
          // stale cache regardless of its `type`. Pre-cutover, `planFollowLabelAudio`
          // stored the then-resolved SymbolStix default as a `type:'tts'` entry, which
          // this loop would otherwise trust and serve forever. A legacy key is ALWAYS
          // the symbol's own default clip (generated TTS lives at audio/<voice>/tts/,
          // recordings under profiles/ — see lib/r2-paths.ts), so discarding it and
          // re-resolving below reproduces the same audio from the modern path.
          if (isLegacySymbolAudioKey(src?.path)) continue;
          if (src?.path && (src.type === "recorded" || src.type === "tts")) {
            audio[lang] = src.path;
            overriddenLangs.add(lang);
          }
        }
```

- [ ] **Step 2: Type-check and lint**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx tsc -p convex/tsconfig.json
npx eslint convex/profileCategories.ts
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add convex/profileCategories.ts
git commit -m "fix(audio): re-resolve stale legacy audio keys on board read (phase-20 stage 5)

A persisted audio/eng/default/ path is always the SymbolStix default clip, so
treat it as a stale author-time cache like type:'r2' entries already are, and
let convention resolution own it. Unfreezes pre-cutover tiles so they follow
voice and language switching again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Owner acceptance (hand back — do not attempt yourself)**

Ask the owner to confirm in the browser, on the default English board:
1. Tap a tile that previously requested `audio/eng/default/…`.
2. In the Network tab, confirm it now requests `audio/en-GB-News-M/symbols/<word>.mp3`.
3. Switch the board voice to `en-GB-News-G` and confirm the same tile follows the voice.

Report the result before starting Task 3.

---

## Task 3: Backfill list items, sentence units and phrases

Surfaces #2–#4 are read verbatim by the client, so they need their stored values rewritten. Uses `symbols.audioBasename` as the reverse-lookup key.

**Files:**
- Modify: `convex/migrations.ts` (append two exports)
- Create: `scripts/backfill-legacy-audio-paths.mjs`

**Interfaces:**
- Consumes: `isLegacySymbolAudioKey` (Task 1 Step 1); existing public query `symbols:dumpSymbolsPage` (paginated; returns `{symbols, isDone, nextCursor}` — see `scripts/verify-voice-seeded.mjs` for the established call shape).
- Produces: `migrations:collectLegacyAudioRows` (query) and `migrations:applyLegacyAudioRewrites` (mutation).

- [ ] **Step 1: Back up first** (required by CLAUDE.md before any mass mutation)

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
node --env-file=.env.local scripts/backup-symbols.mjs "phase-20-stage-5-pre-backfill"
npx convex export --path "backups/$(date +%F)-phase-20-stage-5-pre-backfill.zip"
```
Commit the `convex/data/symbols_backups/…` files. The `backups/*.zip` is gitignored.

- [ ] **Step 2: Add the collect query**

Append to `convex/migrations.ts`:

```ts
/**
 * Phase-20 Stage 5. Returns every persisted legacy audio key with enough
 * addressing information for `applyLegacyAudioRewrites` to patch it back.
 */
export const collectLegacyAudioRows = query({
  args: {},
  handler: async (ctx) => {
    const rows: Array<{
      table: "profileLists" | "profileSentences" | "profilePhrases";
      id: string;
      keys: string[];
    }> = [];

    for (const l of await ctx.db.query("profileLists").collect()) {
      const keys = (l.items ?? []).flatMap((it) =>
        [it.audioPath, it.defaultAudioPath].filter((p): p is string => isLegacySymbolAudioKey(p)),
      );
      if (keys.length) rows.push({ table: "profileLists", id: l._id, keys });
    }

    for (const s of await ctx.db.query("profileSentences").collect()) {
      const keys: string[] = [];
      if (isLegacySymbolAudioKey(s.audioPath)) keys.push(s.audioPath!);
      for (const u of s.units ?? []) {
        if (isLegacySymbolAudioKey(u.audioPath)) keys.push(u.audioPath!);
        if (u.kind === "phrase") {
          for (const w of u.words ?? []) {
            if (isLegacySymbolAudioKey(w.audioPath)) keys.push(w.audioPath!);
          }
        }
      }
      if (keys.length) rows.push({ table: "profileSentences", id: s._id, keys });
    }

    for (const p of await ctx.db.query("profilePhrases").collect()) {
      const keys: string[] = [];
      if (isLegacySymbolAudioKey(p.audioPath)) keys.push(p.audioPath!);
      for (const w of p.words ?? []) {
        if (isLegacySymbolAudioKey(w.audioPath)) keys.push(w.audioPath!);
      }
      if (keys.length) rows.push({ table: "profilePhrases", id: p._id, keys });
    }

    return rows;
  },
});
```

- [ ] **Step 3: Add the apply mutation**

`mapping` is `{ "<legacy key>": "<modern key>" }`. Rewrites are applied structurally, and any key absent from `mapping` is left exactly as it is — so a partial mapping is safe.

```ts
/**
 * Phase-20 Stage 5. Rewrites persisted legacy audio keys using an explicit
 * mapping computed off-box by scripts/backfill-legacy-audio-paths.mjs. Keys
 * missing from the mapping are left untouched (they keep playing from the
 * legacy object, which still exists in R2).
 */
export const applyLegacyAudioRewrites = mutation({
  args: { mapping: v.record(v.string(), v.string()), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const map = args.mapping;
    let patched = 0;
    const sub = (p: string | undefined) => (p && map[p] ? map[p] : p);

    for (const l of await ctx.db.query("profileLists").collect()) {
      const items = (l.items ?? []).map((it) => ({
        ...it,
        audioPath: sub(it.audioPath),
        defaultAudioPath: sub(it.defaultAudioPath),
      }));
      if (JSON.stringify(items) !== JSON.stringify(l.items ?? [])) {
        patched++;
        if (!args.dryRun) await ctx.db.patch(l._id, { items, updatedAt: Date.now() });
      }
    }

    for (const s of await ctx.db.query("profileSentences").collect()) {
      const units = (s.units ?? []).map((u) =>
        u.kind === "phrase"
          ? { ...u, audioPath: sub(u.audioPath), words: (u.words ?? []).map((w) => ({ ...w, audioPath: sub(w.audioPath) })) }
          : { ...u, audioPath: sub(u.audioPath) },
      );
      const audioPath = sub(s.audioPath);
      if (JSON.stringify(units) !== JSON.stringify(s.units ?? []) || audioPath !== s.audioPath) {
        patched++;
        if (!args.dryRun) await ctx.db.patch(s._id, { units, audioPath, updatedAt: Date.now() });
      }
    }

    for (const p of await ctx.db.query("profilePhrases").collect()) {
      const words = (p.words ?? []).map((w) => ({ ...w, audioPath: sub(w.audioPath) }));
      const audioPath = sub(p.audioPath);
      if (JSON.stringify(words) !== JSON.stringify(p.words ?? []) || audioPath !== p.audioPath) {
        patched++;
        if (!args.dryRun) await ctx.db.patch(p._id, { words, audioPath });
      }
    }

    return { patched, dryRun: args.dryRun === true };
  },
});
```

- [ ] **Step 4: Create the mapping script**

Create `scripts/backfill-legacy-audio-paths.mjs`:

```js
/**
 * Phase-20 Stage 5. Builds the legacy→modern audio key mapping and applies it.
 *
 * Run (Node 20+):
 *   node --env-file=.env.local scripts/backfill-legacy-audio-paths.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-legacy-audio-paths.mjs
 *
 * A key is only mapped when its symbol is seeded for en-GB-News-M AND the new
 * R2 object exists. Unmapped keys are reported and left alone — they keep
 * playing from the legacy object, so a partial run is always safe.
 */
import { ConvexHttpClient } from "convex/browser";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry-run");
const VOICE_ID = "en-GB-News-M";
const PREFIX = "audio/eng/default/";
const PAGE_SIZE = 2000;

const r2 = {
  accountId: process.env.R2_ACCOUNT_ID, accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, bucketName: process.env.R2_BUCKET_NAME,
};
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL || !r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName) {
  console.error("❌ Missing env (NEXT_PUBLIC_CONVEX_URL + R2_*). Run with node --env-file=.env.local");
  process.exit(1);
}
const convex = new ConvexHttpClient(CONVEX_URL);
const s3 = new S3Client({ region: "auto", endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey } });

// 1) Every distinct legacy key currently persisted.
const rows = await convex.query("migrations:collectLegacyAudioRows", {});
const legacyKeys = [...new Set(rows.flatMap((r) => r.keys))];
console.log(`rows with legacy keys: ${rows.length} · distinct legacy keys: ${legacyKeys.length}`);
if (!legacyKeys.length) { console.log("✅ nothing to do"); process.exit(0); }

const wanted = new Set(legacyKeys.map((k) => k.slice(PREFIX.length).replace(/\.mp3$/, "")));

// 2) One pass over symbols, building basename→word and word→word for the wanted set.
const byBasename = new Map(), byWord = new Map();
let cursor = null, scanned = 0;
while (true) {
  const page = await convex.query("symbols:dumpSymbolsPage", { cursor, pageSize: PAGE_SIZE });
  for (const sym of page.symbols) {
    scanned++;
    const word = (sym.words?.en ?? "").trim();
    if (!word) continue;
    const seeded = sym.audio && sym.audio[VOICE_ID] === true;
    if (!seeded) continue;
    if (sym.audioBasename && wanted.has(sym.audioBasename)) byBasename.set(sym.audioBasename, word);
    if (wanted.has(word)) byWord.set(word, word);
  }
  if (page.isDone) break;
  cursor = page.nextCursor;
}
console.log(`scanned ${scanned} symbols · matched by basename ${byBasename.size} · by word ${byWord.size}`);

// 3) Build the mapping, HEAD-checking each modern key before trusting it.
const mapping = {}, unmapped = [];
const seenTarget = new Map();
async function exists(key) {
  if (seenTarget.has(key)) return seenTarget.get(key);
  let ok = true;
  try { await s3.send(new HeadObjectCommand({ Bucket: r2.bucketName, Key: key })); }
  catch { ok = false; }
  seenTarget.set(key, ok);
  return ok;
}
for (const legacy of legacyKeys) {
  const base = legacy.slice(PREFIX.length).replace(/\.mp3$/, "");
  const word = byBasename.get(base) ?? byWord.get(base);
  if (!word) { unmapped.push({ legacy, reason: "no seeded symbol matched" }); continue; }
  const modern = `audio/${VOICE_ID}/symbols/${word}.mp3`;
  if (!(await exists(modern))) { unmapped.push({ legacy, reason: `target missing: ${modern}` }); continue; }
  mapping[legacy] = modern;
}
console.log(`mapped ${Object.keys(mapping).length}/${legacyKeys.length} · unmapped ${unmapped.length}`);
if (unmapped.length) {
  const p = path.join(__dirname, "backfill-legacy-audio-paths-unmapped.json");
  fs.writeFileSync(p, JSON.stringify(unmapped, null, 2));
  console.warn(`⚠️  ${unmapped.length} keys could not be mapped — written to ${p}. They are left untouched and keep playing from the legacy object.`);
}

// 4) Always persist the mapping — Task 4 reuses it for the library-module JSON.
const mapPath = path.join(__dirname, "backfill-legacy-audio-paths-mapping.json");
fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
console.log(`mapping written to ${mapPath}`);

// 5) Apply.
const res = await convex.mutation("migrations:applyLegacyAudioRewrites", { mapping, dryRun: DRY });
console.log(DRY ? `DRY RUN — would patch ${res.patched} rows` : `✅ patched ${res.patched} rows`);
```

- [ ] **Step 5: Type-check, lint, dry-run**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx tsc -p convex/tsconfig.json
npx eslint convex/migrations.ts scripts/backfill-legacy-audio-paths.mjs
node --env-file=.env.local scripts/backfill-legacy-audio-paths.mjs --dry-run
```

Expected: a mapped/unmapped count and `DRY RUN — would patch <N> rows`, where `<N>` is consistent with Task 1's audit. **If `unmapped > 0`, read the JSON and understand each reason before proceeding** — do not apply a run you cannot explain.

- [ ] **Step 6: Apply for real**

```bash
node --env-file=.env.local scripts/backfill-legacy-audio-paths.mjs
```
Expected: `✅ patched <N> rows`.

- [ ] **Step 7: Re-run the audit**

```bash
npx convex run migrations:auditLegacyAudioPaths
```
Expected: `profileListItems`, `profileSentenceUnits`, `profilePhrases` all `0`. `profileSymbols` may remain non-zero — Task 2 neutralises those at read time rather than rewriting them, which is fine and intentional.

- [ ] **Step 8: Commit**

```bash
git add convex/migrations.ts scripts/backfill-legacy-audio-paths.mjs convex/data/symbols_backups
git commit -m "fix(audio): backfill persisted legacy audio paths in lists, sentences, phrases (phase-20 stage 5)

Rewrites audio/eng/default/<basename>.mp3 to the modern
audio/en-GB-News-M/symbols/<word>.mp3 convention, mapping via
symbols.audioBasename and HEAD-checking each target before trusting it.
Unmappable keys are reported and left untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Library modules (only if Task 1 reported `libraryModules > 0`)

If the default manifest carries legacy paths, every new account inherits them and the problem regenerates. If Task 1 reported `0`, skip to Step 3 and record that.

**Files:**
- Modify: `convex/data/` module JSON source (the file backing `seedLibraryModulesFromJSON`), or the `libraryModules` rows directly.

- [ ] **Step 1: Locate the source of truth**

```bash
grep -rln "eng/default" convex/data/
npx convex run migrations:auditLegacyAudioPaths
```
Library modules are seeded from committed JSON (`migrations:seedLibraryModulesFromJSON`) and can also be published from live content (`convex/contentModules/publish.ts`). Fix the **JSON source** if the paths are there — otherwise a re-seed reintroduces them.

- [ ] **Step 2: Rewrite the JSON with the same mapping**

Task 3's script wrote `scripts/backfill-legacy-audio-paths-mapping.json` (`{"<legacy key>": "<modern key>"}`). Apply those exact substitutions to the module JSON — a literal string replace per entry, no re-derivation:

```bash
node --env-file=.env.local -e '
const fs=require("fs");
const map=JSON.parse(fs.readFileSync("scripts/backfill-legacy-audio-paths-mapping.json","utf8"));
const f=process.argv[1];
let s=fs.readFileSync(f,"utf8"), n=0;
for (const [from,to] of Object.entries(map)) { const parts=s.split(from); n+=parts.length-1; s=parts.join(to); }
fs.writeFileSync(f,s); console.log(`${f}: replaced ${n}`);
' <path to the module JSON from Step 1>
```

Then re-seed:

```bash
npx convex run migrations:seedLibraryModulesFromJSON
```

- [ ] **Step 3: Verify and commit**

```bash
npx convex run migrations:auditLegacyAudioPaths
```
Expected: `libraryModules: 0`.

```bash
git add convex/data
git commit -m "fix(content): drop legacy audio paths from library module seed data (phase-20 stage 5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

If Task 1 reported `0`, commit nothing and state in your handoff that Task 4 was a verified no-op.

---

## Task 5: Close out phase-20

**Files:**
- Modify: `lib/r2-paths.ts:24-29` (stale comment)
- Modify: `docs/4-builds/plans/_done/phase-20-en-gb-news-m-reseed-plan.md`
- Create: `docs/4-builds/decisions/ADR-023-legacy-audio-path-retirement.md`

> **ADR numbering:** the directory currently ends at ADR-021. **ADR-022 is reserved for phase-23** (`authoredLanguage` for library modules), which is being built in parallel in a worktree and extends ADR-019/020. Take **023** here. If 022 is still unused when you close out, leave the gap — do not renumber.

- [ ] **Step 1: Fix the stale comment**

`lib/r2-paths.ts:27` still says resolution happens "with the legacy `audio/eng/default/` fallback for en-GB-News-M". That fallback was removed in Stage 3. Change that clause to:

```
// truth for the voice-first layout (`audio/<voiceId>/symbols/<word>.mp3`). The
// legacy `audio/eng/default/` prefix was retired for Home in phase-20; the live
// MVP still serves it, so its objects must never be deleted. Do NOT add a
```

- [ ] **Step 2: Write the ADR**

Record: persisted-vs-resolved is the distinction that made the Stage 3 cutover incomplete; a stored key under `audio/eng/default/` is always a SymbolStix default (never TTS, never a recording), which is what licenses read-time re-resolution; the backfill depends on `audioBasename`.

- [ ] **Step 3: Update the phase-20 plan doc**

Add a Stage 5 note recording that it shipped, and — importantly — that **Stage 4b (`remove audioBasename`) must remain un-done** or be re-evaluated only after confirming no future backfill needs the reverse lookup.

- [ ] **Step 4: Verify and commit**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
npx tsc --noEmit
npx tsc -p convex/tsconfig.json
npx eslint lib/r2-paths.ts
```
Expected: only the baseline `lib/stripe.ts(8,3)` error; Convex clean.

```bash
git add lib/r2-paths.ts docs/4-builds
git commit -m "docs(audio): ADR + phase-20 stage 5 close-out

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand back for owner acceptance**

Ask the owner to confirm in the browser, with the Network tab open:
1. Play a list and a sentence built before the cutover — **zero** requests to `audio/eng/default/`.
2. Tap board tiles across several categories — same.
3. Switch board voice and language and confirm audio follows both.

State plainly that everything before this step is type-check-and-report verified only.

---

## Acceptance criteria (whole stage)

- `npx convex run migrations:auditLegacyAudioPaths` reports `0` for `profileListItems`, `profileSentenceUnits`, `profilePhrases`, `libraryModules`.
- No request to `audio/eng/default/` appears in the Network tab during normal use of boards, lists and sentences.
- Affected tiles follow voice and language switching.
- `audio/eng/default/` objects still exist in R2 (the MVP is untouched).
- Type-checks at baseline; `tsc -p convex/tsconfig.json` clean.

## Non-goals / cautions

- Do **not** delete `audio/eng/default/` objects — the live MVP serves them.
- Do **not** do phase-20 Stage 4b (remove `audioBasename`) here — this stage depends on it.
- Do **not** rewrite `recordedAudioPath` anywhere; recordings are never legacy keys.
- Do **not** guess a mapping for an unmappable key. Leaving it alone keeps working audio; a wrong rewrite produces silence.
