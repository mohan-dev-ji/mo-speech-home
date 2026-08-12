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

// Blast-radius guard: cross-language pollution only ever lives under a
// non-English voice's tts/ folder (audio/hi-IN-*/tts/… or audio/es-US-*/tts/…).
// Any target outside that prefix means the hit-list is wrong.
const EXPECTED_KEY = /^audio\/(hi-IN|es-US)-[\w-]+\/tts\//;

// ── Dry run: preview only ─────────────────────────────────────────────────────
if (!COMMIT) {
  const rows = convexRun("migrations:getTtsCacheRowsByIds", { ids });
  console.log(`\n🔎 DRY RUN — ${rows.length} rows would be deleted:\n`);
  for (const r of rows) {
    console.log(`  ${r.voiceId}  "${r.text}"  →  ${r.r2Key}`);
  }
  const missing = ids.length - rows.length;
  if (missing > 0) console.log(`\n  (${missing} ids not found — already gone)`);
  const unexpected = rows.filter((r) => !EXPECTED_KEY.test(r.r2Key));
  if (unexpected.length > 0) {
    console.log(
      `\n⚠️  ${unexpected.length} row(s) are NOT under a non-English tts/ prefix — --commit will ABORT on these:`
    );
    for (const r of unexpected) console.log(`   ${r.voiceId}  "${r.text}"  →  ${r.r2Key}`);
  }
  console.log(`\nRe-run with --commit to delete rows + R2 objects.`);
  process.exit(0);
}

// ── Commit: validate first (rows intact), then delete rows → R2 objects ───────
// Fetch the targets up front so env + blast-radius are checked BEFORE any
// deletion — a failed check leaves every row and object intact.
const rows = convexRun("migrations:getTtsCacheRowsByIds", { ids });
console.log(`\n${rows.length} rows targeted (${ids.length - rows.length} already gone).`);

// R2 env must be present before we delete anything.
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error(
    "❌ R2 env vars missing (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME). " +
      "Nothing deleted — set them and re-run --commit."
  );
  process.exit(1);
}

// Blast-radius guard — abort untouched if any target is outside the expected prefix.
const unexpected = rows.filter((r) => !EXPECTED_KEY.test(r.r2Key));
if (unexpected.length > 0) {
  console.error(
    `\n❌ ${unexpected.length} target row(s) are NOT under a non-English tts/ prefix — aborting, nothing deleted:`
  );
  for (const r of unexpected) console.error(`   ${r.voiceId}  "${r.text}"  →  ${r.r2Key}`);
  console.error(`Review ${HIT_LIST} — it must list only wrong-voice (hi-IN/es-US) rows.`);
  process.exit(1);
}

// Delete rows first (row-before-object), then their R2 objects.
console.log(`\n🗑  Deleting ${rows.length} ttsCache rows…`);
const { deletedKeys, deleted, missing } = convexRun("migrations:purgeTtsCacheRowsByIds", { ids });
console.log(`   rows deleted: ${deleted}   already gone: ${missing}`);

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
