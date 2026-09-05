/**
 * Backfill: index every R2 object already sitting under `accounts/<id>/images/`
 * into the new `accountImages` table (MOS-52, phase-36 Task 1).
 *
 * Why this exists:
 *   `accountImages` only started getting rows the moment the write path
 *   landed (the AI-generate route's `api.accountImages.record` call). Every
 *   image an account generated or uploaded BEFORE that moment is still
 *   sitting in R2 with no row — the library would open empty for an account
 *   that has been using AI Generate / uploads for months.
 *
 * Source for a backfilled row:
 *   The object alone does not say where it came from. This script asks
 *   `accountImages:listSymbolImageSourcesForAccount` for every profileSymbols
 *   row on the account and matches by R2 key. A match gives the real source
 *   (`imageSearch` / `aiGenerated` / `userUpload`) and, for `aiGenerated`,
 *   the original prompt. Anything unreferenced falls back to `userUpload` —
 *   getting this wrong is cosmetic (`source` is a display hint, never a
 *   lookup key), but the script prints the guess rate rather than hiding it.
 *
 * Scope: only `.../images/` objects are library images. `.../audio/` objects
 * under the same account prefix are recordings/TTS, not pictures, and are
 * never matched or recorded.
 *
 * Run with (Node 20+):
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   node --env-file=.env.local scripts/backfill-account-images.mjs           # dry run
 *   node --env-file=.env.local scripts/backfill-account-images.mjs --apply   # writes accountImages rows
 *
 * Flags:
 *   --dry-run   (default, explicit form also accepted) — lists R2 + resolves
 *               sources, reports what WOULD be recorded, writes nothing.
 *   --apply     calls `accountImages:recordForAccount` for every key found.
 *               Idempotent — that mutation dedupes on (accountId, imageKey),
 *               so a second run (or a key that already has a row) is a no-op.
 *
 * Prerequisites:
 *   - convex/accountImages.ts:recordForAccount /
 *     listSymbolImageSourcesForAccount must be deployed.
 *   - R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *     R2_BUCKET_NAME (see lib/r2-storage.ts).
 *
 * Backup BEFORE running --apply (per CLAUDE.md — this writes new rows):
 *   npx convex export --path backups/<date>-account-images-backfill.zip
 *
 * Verify the R2 side with scripts/count-r2-objects.mjs, never the Cloudflare
 * dashboard — see that script's docblock for why.
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// ── Args ─────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

console.log("");
console.log(
  DRY_RUN
    ? "🔎🔎🔎  DRY RUN (default) — reads R2 + Convex only, writes NOTHING. Pass --apply to write.  🔎🔎🔎"
    : "🚨🚨🚨  APPLY MODE — this WILL insert accountImages rows.  🚨🚨🚨"
);
console.log("");

// ── R2 client ────────────────────────────────────────────────────────────────
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error(
    "❌ Missing R2 env vars (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)"
  );
  process.exit(1);
}
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

// ── Convex CLI helper (internal functions are invocable via `npx convex run`
//    from the CLI — this script never gets caller identity, hence internal). ──
function convexRun(fnRef, argsObj) {
  const tmpFile = join(
    tmpdir(),
    `backfill-account-images-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  writeFileSync(tmpFile, JSON.stringify(argsObj));
  try {
    const stdout = execSync(`npx convex run ${fnRef} --no-push "$(cat ${tmpFile})"`, {
      encoding: "utf8",
    });
    return JSON.parse(stdout);
  } finally {
    unlinkSync(tmpFile);
  }
}

// ── List every object under accounts/, paginated (ListObjectsV2 caps at 1000
//    keys per call — an install this size will exceed that). ─────────────────
console.log("📖 Listing R2 objects under accounts/ …");
let ContinuationToken;
const allObjects = [];
do {
  const out = await r2.send(
    new ListObjectsV2Command({ Bucket: bucketName, Prefix: "accounts/", ContinuationToken })
  );
  allObjects.push(...(out.Contents ?? []));
  ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
} while (ContinuationToken);
console.log(`   ${allObjects.length} object(s) under accounts/`);

// Only `.../images/` objects are library images — `.../audio/` (recordings,
// TTS) lives under the same account prefix and is never a library entry.
const IMAGE_KEY_RE = /^accounts\/([^/]+)\/images\//;
const imageKeys = allObjects
  .map((o) => o.Key)
  .filter((key) => IMAGE_KEY_RE.test(key));
console.log(`   ${imageKeys.length} of those under .../images/ (library candidates)\n`);

if (imageKeys.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Group by accountId so each account's profileSymbols rows are fetched once.
const keysByAccount = new Map();
for (const key of imageKeys) {
  const [, acct] = key.match(IMAGE_KEY_RE);
  if (!keysByAccount.has(acct)) keysByAccount.set(acct, []);
  keysByAccount.get(acct).push(key);
}
console.log(`   spanning ${keysByAccount.size} account(s)\n`);

let totalKeys = 0;
let matchedCount = 0;
let guessedCount = 0;
const perAccountResults = [];

let acctIndex = 0;
for (const [acct, keys] of keysByAccount) {
  acctIndex++;
  console.log(
    `[${acctIndex}/${keysByAccount.size}] account ${acct} — ${keys.length} image(s)`
  );

  // Resolve source/prompt per key from this account's profileSymbols rows.
  const symbolSources = convexRun(
    "accountImages:listSymbolImageSourcesForAccount",
    { accountId: acct }
  );
  const byImagePath = new Map(symbolSources.map((s) => [s.imagePath, s]));

  for (const imageKey of keys) {
    totalKeys++;
    const match = byImagePath.get(imageKey);
    let source;
    let prompt;
    if (match) {
      source = match.type;
      prompt = match.aiPrompt;
      matchedCount++;
    } else {
      source = "userUpload";
      guessedCount++;
    }

    const label = match ? `matched (${source})` : "GUESSED (unreferenced → userUpload)";
    console.log(`   ${DRY_RUN ? "WOULD RECORD" : "RECORD"}  ${imageKey}  — ${label}`);

    if (APPLY) {
      const result = convexRun("accountImages:recordForAccount", {
        accountId: acct,
        imageKey,
        source,
        ...(prompt ? { prompt } : {}),
      });
      perAccountResults.push({ acct, imageKey, source, result });
    }
  }
  console.log("");
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("─".repeat(72));
console.log(DRY_RUN ? "DRY RUN SUMMARY (nothing written)" : "APPLY SUMMARY");
console.log("─".repeat(72));
console.log(`accounts:           ${keysByAccount.size}`);
console.log(`images total:       ${totalKeys}`);
console.log(`matched to a symbol:${" ".repeat(0)} ${matchedCount}`);
console.log(`guessed userUpload: ${guessedCount}`);
if (totalKeys > 0) {
  console.log(`guess rate:         ${((100 * guessedCount) / totalKeys).toFixed(1)}%`);
}

console.log(
  DRY_RUN ? "\n✅ Dry run complete. Re-run with --apply to write." : "\n✅ Apply complete."
);
