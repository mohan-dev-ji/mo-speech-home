# Phase 20 — Re-seed en-GB-News-M onto the modern audio convention

> **For a fresh session:** this plan is self-contained — you do NOT need any prior conversation. Read it top to bottom, then execute stage by stage. It migrates the default English voice off a legacy audio-path special-case and onto the same convention every other voice already uses. **It touches the DEFAULT voice on shared production R2, so the cutover is gated on a verification pass and is fully reversible.**

**Written:** 2026-08-13 · **Owner:** Mo · **Status:** ready to execute (not started)
**Related:** finishes the migration the code already anticipates (`lib/audio/resolveAudioPath.ts` header comment: "Once Phase 8.4 re-seeds en-GB-News-M under the new convention … this branch goes too").

---

## Background — why this exists

Audio for a symbol is resolved by convention (ADR-009 §4), not stored paths. Every voice resolves to:

```
audio/<voiceId>/symbols/<words.en>.mp3          ← the modern convention
```

**Except `en-GB-News-M`** (which is also `DEFAULT_VOICE_ID`). It's the legacy MVP voice, and its clips live at the MVP-era path with MVP-era filenames:

```
audio/eng/default/<audioBasename>.mp3           ← legacy; basename is usually a
                                                   SymbolStix id, e.g. symbol00211050.mp3
```

`resolveSymbolAudioPath` (`lib/audio/resolveAudioPath.ts`) special-cases this one voice, and the `symbols.audioBasename` field exists **solely** to map each symbol to its legacy filename. `en-GB-News-G` (the female English voice) and the Spanish/Hindi voices were all seeded onto the modern convention via `scripts/seed-voice-audio.mjs` — the male voice is the only hold-out.

**Goal:** seed `en-GB-News-M` onto the modern convention (reusing the proven seed pipeline), flip the resolver to drop its special-case, and optionally remove the now-dead `audioBasename` field. The MVP keeps using `audio/eng/default/` (its 100+ live users are unaffected); Home stops depending on it.

**Confirmed decisions (do not re-litigate):**
- The `eng/default` clips are **not hand-curated** — `en-GB-News-M` is a Google WaveNet voice, so every clip is regenerable TTS. Re-seeding produces equivalent audio.
- **Approach = re-seed** (regenerate via `seed-voice-audio.mjs`), NOT copy-rename the R2 objects. Rationale: reuses a battle-tested, idempotent, resumable script; clean `word.mp3` filenames; no bespoke copy logic and no dependency on `audioBasename` accuracy. The only cost is a small one-time TTS spend (the dry-run reports the exact figure).

**Why it's safe/reversible:** the `audio["en-GB-News-M"]=true` seeded flags are ALREADY set (from the legacy backfill), so throughout Stages 0–2 the resolver keeps serving `eng/default` and **nothing changes for users**. Only Stage 3 (a one-file resolver change) flips playback to the new path — and only after Stage 2 proves 100% file coverage. Reverting that one commit falls straight back to `eng/default`.

## Stack / conventions (same as the rest of this repo)

- Work on `main` (project convention — no feature branch unless you want one). Commit with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Convex CLI + these scripts need Node 20+.** Prefix commands with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **Do NOT run `npx convex dev`** (it makes an anonymous local backend + rewrites `.env.local`). Type-check Convex with `npx tsc -p convex/tsconfig.json`; app code with `npx tsc --noEmit`. Lint with `npx eslint <files>`.
- No unit-test runner exists — verification is type-check + the scripts' own reports + R2 HEAD checks + browser playback.
- R2 is shared with the live MVP. This migration only ADDS objects under `audio/en-GB-News-M/symbols/` (never deletes `eng/default`), so it cannot affect the MVP.

## Path facts you'll rely on

- Modern key (what the seed script writes and what the resolver will read after Stage 3): `audio/en-GB-News-M/symbols/<words.en>.mp3`. Filename is ALWAYS `words.en` (spaces included, e.g. `wash hands.mp3`), even though the spoken audio is English. This matches how `en-GB-News-G`/`es`/`hi` are already seeded.
- Seeded set = every symbol where `audio["en-GB-News-M"] === true`. These already have that flag from the legacy era, so the seed run's flag-flips are near-no-ops; the real work is the R2 uploads.

---

## Stage 0 — Backup + dry-run (no changes)

**Files:** none. **Goal:** a restore point + the exact clip count and TTS cost.

- [ ] **Step 1: Back up the symbols table + a full Convex export** (per CLAUDE.md, before any mass op)

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0
node --env-file=.env.local scripts/backup-symbols.mjs "phase-20-pre-reseed-en-gb-news-m"
npx convex export --path "backups/$(date +%F)-phase-20-pre-reseed.zip"
```
Commit the `convex/data/symbols_backups/…` files the first command writes. The `backups/*.zip` is gitignored (local DR only).

- [ ] **Step 2: Dry-run the seed to get count + cost** — but the script currently REFUSES `en-GB-News-M` (a deliberate guard). Do the guard removal from Stage 1 Step 1 FIRST, then run:

```bash
node --env-file=.env.local scripts/seed-voice-audio.mjs --voice en-GB-News-M --dry-run
```
Expected: a report like `would synthesise: <N> clips · total characters: <C> · est. TTS cost: ~$<X>`. Record N and X. (Rough prior: ~58k symbols total, most short words, WaveNet ≈ $16/1M chars → typically low tens of dollars at most. The real figure comes from this run; existing files are skipped on the real run, so first-run cost only.)

---

## Stage 1 — Enable + run the seed

**Files:** Modify `scripts/seed-voice-audio.mjs`. **Goal:** every seeded `en-GB-News-M` symbol has an `audio/en-GB-News-M/symbols/<words.en>.mp3` object.

- [ ] **Step 1: Remove the en-GB-News-M refusal guard**

In `scripts/seed-voice-audio.mjs`, delete the guard block (currently ~lines 94–99):

```js
if (VOICE_ID === LEGACY_VOICE_ID) {
  console.error(
    `❌ ${LEGACY_VOICE_ID} is the legacy voice — its audio lives at audio/eng/default/ and the resolver reads it there. Do not re-seed it under the new convention.`,
  );
  process.exit(1);
}
```

Then delete the now-unused `const LEGACY_VOICE_ID = "en-GB-News-M";` (~line 64), and in the `VOICE_LANG` map drop the `legacy: true` flag from the `en-GB-News-M` entry so it reads like the others:

```js
"en-GB-News-M": { languageCode: "en-GB", lang: "en" },
```

Also update the header comment block that says "NOT for en-GB-News-M …" (~lines 32–36) — delete that caveat; it no longer applies.

- [ ] **Step 2: Lint + commit the script change**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx eslint scripts/seed-voice-audio.mjs
git add scripts/seed-voice-audio.mjs
git commit -m "chore(scripts): allow seed-voice-audio to seed en-GB-News-M (phase-20)

Remove the legacy refusal guard so the male English voice can be seeded onto
the modern audio/<voice>/symbols/<word>.mp3 convention like every other voice.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: Smoke-test with a small limit** (real synth, but only a few clips)

```bash
node --env-file=.env.local scripts/seed-voice-audio.mjs --voice en-GB-News-M --limit 20
```
Expected: `uploaded 20` (or fewer if some already exist), `failed 0`. Spot-check one object exists:
```bash
# pick a word from the run's output, e.g. "eat"
node -e 'import("@aws-sdk/client-s3").then(async ({S3Client,HeadObjectCommand})=>{const c=new S3Client({region:"auto",endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});await c.send(new HeadObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:"audio/en-GB-News-M/symbols/eat.mp3"}));console.log("exists")})' 2>&1
```
Run this with `node --env-file=.env.local …`. Expected: `exists`.

- [ ] **Step 4: Full seed run** (unattended; idempotent + resumable — safe to re-run if interrupted)

```bash
node --env-file=.env.local scripts/seed-voice-audio.mjs --voice en-GB-News-M
```
Expected final report: `uploaded <most>`, `skipped (exists) <few/0>`, **`failed 0`**. If `failed > 0`, an errors file `scripts/seed-voice-audio-errors.en-GB-News-M.json` is written — just re-run the same command (it skips existing files and retries only the failures) until `failed 0`.

---

## Stage 2 — Verify 100% coverage (the cutover gate)

**Files:** Create `scripts/verify-voice-seeded.mjs`. **Goal:** prove that EVERY symbol flagged `audio["en-GB-News-M"]=true` has its new-path object, so nothing 404s after the resolver flip. **Do not proceed to Stage 3 until this reports 0 missing.**

- [ ] **Step 1: Create the verification script**

Create `scripts/verify-voice-seeded.mjs`:

```js
/**
 * Verify every symbol flagged seeded for a voice has its modern-convention R2
 * object (audio/<voice>/symbols/<words.en>.mp3). The cutover gate for phase-20.
 *
 * Run (Node 20+):
 *   node --env-file=.env.local scripts/verify-voice-seeded.mjs --voice en-GB-News-M
 *
 * Exit 0 + "0 missing" means it is safe to flip the resolver. Any missing keys
 * are written to scripts/verify-voice-seeded-missing.<voice>.json.
 */
import { ConvexHttpClient } from "convex/browser";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const getOpt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const VOICE_ID = getOpt("--voice", null);
const CONCURRENCY = Number(getOpt("--concurrency", "8"));
const PAGE_SIZE = 2000;

if (!VOICE_ID) { console.error("❌ --voice <ttsVoiceId> required"); process.exit(1); }
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

// Collect every symbol flagged seeded for VOICE_ID, with its words.en.
const targets = [];
let cursor = null, scanned = 0, noWord = 0;
while (true) {
  const page = await convex.query("symbols:dumpSymbolsPage", { cursor, pageSize: PAGE_SIZE });
  for (const sym of page.symbols) {
    scanned++;
    const audioMap = sym.audio && typeof sym.audio === "object" ? sym.audio : {};
    if (audioMap[VOICE_ID] !== true) continue;
    const word = (sym.words?.en ?? "").trim();
    if (!word) { noWord++; continue; } // flagged but no words.en — report separately
    targets.push({ id: sym._id, key: `audio/${VOICE_ID}/symbols/${word}.mp3`, word });
  }
  if (page.isDone) break;
  cursor = page.nextCursor;
}
console.log(`scanned ${scanned} · flagged-seeded ${targets.length}${noWord ? ` · ${noWord} flagged but NO words.en (investigate)` : ""}`);

// HEAD each expected key.
const missing = [];
let idx = 0, checked = 0;
async function exists(key) { try { await s3.send(new HeadObjectCommand({ Bucket: r2.bucketName, Key: key })); return true; } catch { return false; } }
async function worker() {
  while (idx < targets.length) {
    const t = targets[idx++];
    if (!(await exists(t.key))) missing.push(t);
    if (++checked % 2000 === 0) console.log(`  … ${checked}/${targets.length} (missing so far ${missing.length})`);
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));

if (missing.length) {
  const p = path.join(__dirname, `verify-voice-seeded-missing.${VOICE_ID}.json`);
  fs.writeFileSync(p, JSON.stringify(missing, null, 2));
  console.error(`\n❌ ${missing.length} MISSING objects — written to ${p}. Re-run the seed, then re-verify. Do NOT flip the resolver.`);
  process.exit(1);
}
console.log(`\n✅ 0 missing — every flagged-seeded ${VOICE_ID} symbol has its ${`audio/${VOICE_ID}/symbols/…`} object. Safe to flip the resolver.`);
```

- [ ] **Step 2: Lint + run it**

```bash
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx eslint scripts/verify-voice-seeded.mjs
node --env-file=.env.local scripts/verify-voice-seeded.mjs --voice en-GB-News-M
```
Expected: `✅ 0 missing`. If it reports missing objects, re-run the Stage 1 Step 4 seed, then re-verify. If it reports "flagged but NO words.en", investigate those symbols (a flagged symbol with no English word can't have a modern-convention filename — decide per-symbol; likely none exist).

- [ ] **Step 3: Commit the verify script**

```bash
git add scripts/verify-voice-seeded.mjs
git commit -m "chore(scripts): verify-voice-seeded coverage gate (phase-20)

HEAD-checks every flagged-seeded symbol has its audio/<voice>/symbols/<word>.mp3
object. Gate before flipping the resolver off the legacy en-GB-News-M path.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Stage 3 — Cutover: flip the resolver (the only behaviour change)

**Files:** Modify `lib/audio/resolveAudioPath.ts` (one file). **Goal:** `en-GB-News-M` resolves via the modern convention. Reversible by reverting this commit. **Only do this after Stage 2 reports 0 missing.**

- [ ] **Step 1: Remove the legacy branch**

In `lib/audio/resolveAudioPath.ts`, delete `const LEGACY_VOICE_ID = "en-GB-News-M";` (~line 33) and change the function body so the legacy branch is gone:

```ts
export function resolveSymbolAudioPath(
  voiceId: string,
  englishWord: string,
  seeded: boolean,
  // Deprecated. Only the removed legacy en-GB-News-M path used this; kept in the
  // signature so callers need not change here. Removed with symbols.audioBasename
  // in phase-20 Stage 4.
  _audioBasename?: string,
): string | null {
  if (!seeded) return null;
  return `audio/${voiceId}/symbols/${englishWord}.mp3`;
}
```

Also trim the file's header doc block — delete the "Legacy fallback (ADR-009 §4)" paragraphs describing the `eng/default` behaviour (they no longer apply); leave the layout summary. Renaming the 4th param to `_audioBasename` keeps every caller compiling unchanged (they still pass `sym.audioBasename`; it's ignored). If this repo's `tsconfig` does NOT flag unused params, you may keep the name `audioBasename` — but the underscore is safe either way.

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit
source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json
npx eslint lib/audio/resolveAudioPath.ts
```
Expected: no NEW errors referencing `resolveAudioPath.ts` (pre-existing unrelated errors in `.next/types` / `lib/stripe.ts` may appear).

- [ ] **Step 3: Commit**

```bash
git add lib/audio/resolveAudioPath.ts
git commit -m "feat(audio): resolve en-GB-News-M via the modern symbols/ convention (phase-20)

Drop the legacy audio/eng/default/ special-case now that en-GB-News-M is seeded
under audio/en-GB-News-M/symbols/<word>.mp3 (verified 0 missing). The MVP keeps
using eng/default; Home no longer depends on it. Revert to fall back.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Deploy so it reaches the app.** Convex isn't affected by this change (it's app-side lib code), but the app must ship. This repo deploys from `main`; push and let the normal deploy run:
```bash
git push origin main
```

- [ ] **Step 5: Real-content acceptance test (also the "test with real content" goal).** On the default English board (uses `en-GB-News-M`), with the dev server running (port 3001) and via the real signed-in browser:
  1. Tap several default category symbols (e.g. "eat", "finished", "school") and confirm audio plays.
  2. Create a real list/sentence (MOS-13 content) with symbol-matched items and play them.
  3. In the Network tab, confirm the audio requests resolve to keys under `audio/en-GB-News-M/symbols/<word>.mp3` (via `/api/assets?key=…`), NOT `audio/eng/default/…`.
  Expected: audio plays correctly and every symbol clip comes from the new path. If any symbol is silent, note its word and re-check Stage 2 for that key (should be impossible if Stage 2 passed).

**Rollback (if anything is wrong):** `git revert <Stage-3-commit>` and push — the resolver falls straight back to `eng/default` (still present, still flagged). No data change to undo.

---

## Stage 4 — OPTIONAL, later: remove the dead `audioBasename` field

Only worth doing once Stage 3 has been stable in production for a while. The field is harmless dead weight until then. This is pure dead-code/schema removal — no behaviour change. **This touches ~6 files, so treat it as its own small plan/PR.** Known references to remove (grep `audioBasename` to confirm the current set):

- `lib/audio/resolveAudioPath.ts` — drop the `_audioBasename` param entirely.
- Call sites passing it (drop the last arg): `convex/ttsCache.ts` (`checkMany` → `resolveSymbolAudioPath(...)`), `app/api/tts/route.ts` (the symbolstix branch), `convex/profileCategories.ts` (two sites, ~lines 249 & 275).
- `convex/ttsCache.ts` — remove `audioBasename` from the `symbolstix` result type + the two return objects in `resolveCachedAudio`.
- `convex/profileSymbols.ts` — stop snapshotting `sym.audioBasename` (~lines 72, 82).
- `convex/schema.ts` — remove `audioBasename: v.optional(v.string())` (~line 358). Requires a deploy; optional migration to strip the field from existing docs (or leave it — an unused optional field is harmless).
- `convex/migrations.ts` — remove the `backfillAudioBasenames` migration (~line 900+) and delete `scripts/backfill-audio-basenames.mjs`.

Each removal is mechanical; type-check (`tsc --noEmit` + `tsc -p convex/tsconfig.json`) after each and commit in small steps. Do NOT delete `audio/eng/default/` objects from R2 — the live MVP still serves them.

---

## Acceptance criteria (whole phase)

- `scripts/verify-voice-seeded.mjs --voice en-GB-News-M` reports **0 missing**.
- `resolveSymbolAudioPath` has no voice special-case; `en-GB-News-M` symbol audio serves from `audio/en-GB-News-M/symbols/<word>.mp3` (confirmed in the browser Network tab).
- Real content on the default English board plays symbol audio correctly.
- The MVP is untouched: `audio/eng/default/` objects still exist; no MVP code changed.
- (Stage 4, if done) no `audioBasename` references remain; type-checks clean.

## Non-goals / cautions

- Do NOT delete `audio/eng/default/` — the live MVP (100+ users) depends on it.
- Do NOT copy-rename R2 objects (the rejected Approach A) — re-seeding is the chosen path.
- Do NOT flip the resolver (Stage 3) before Stage 2 passes — `en-GB-News-M` is `DEFAULT_VOICE_ID`, so a coverage gap would silently break the most-used voice.
