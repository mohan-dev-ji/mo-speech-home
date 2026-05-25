/**
 * Phase 8.0 recovery: backfill `symbols.audioBasename` from the MVP's
 * SymbolStix metadata export.
 *
 * Why:
 *   The Phase 8.0 schema migration rewrote `symbols.audio` from
 *   `{eng: {default: <r2-path>}}` to `{"en-GB-News-M": true}` and dropped
 *   the per-symbol R2 filename. The new audio resolver tried to synthesise
 *   the filename from `words.en`, but the MVP stored arbitrary basenames
 *   (often SymbolStix IDs — e.g. `symbol00187604.mp3` for "Hello Kitty"),
 *   so ~5 in 6 lookups 404'd. This script reads the MVP's authoritative
 *   `symbolstix-metadata.json` and re-writes the basename per-symbol so
 *   `resolveSymbolAudioPath()` can find the file again.
 *
 * Run with:
 *   node --env-file=.env.local scripts/backfill-audio-basenames.mjs
 *
 * Prerequisites:
 *   - The MVP repo lives at the hard-coded path below (Mohan's machine).
 *     Override with METADATA_PATH=... env var if elsewhere.
 *   - The Phase 8.0 schema is deployed (`symbols.audioBasename` field +
 *     `by_imagePath` index exist).
 *   - The `backfillAudioBasenames` mutation exists in convex/migrations.ts.
 *
 * Idempotent — rerunning is a no-op.
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const METADATA_PATH =
  process.env.METADATA_PATH ??
  "/Users/mohanveraitch/Projects/Mo_Speech/_code/mo-speech-mvp-2.0/scripts/symbolstix-metadata.json";

if (!existsSync(METADATA_PATH)) {
  console.error(
    `❌ symbolstix-metadata.json not found at ${METADATA_PATH}. ` +
      `Set METADATA_PATH to the right location.`
  );
  process.exit(1);
}

console.log(`📖 Reading ${METADATA_PATH}…`);
const raw = readFileSync(METADATA_PATH, "utf8");
const metadata = JSON.parse(raw);
console.log(`   loaded ${metadata.length.toLocaleString()} symbol entries`);

// Each entry has `imagePath` ("symbols/symbol00187604.png") and `audioPath`
// ("audio/eng/default/symbol00187604.mp3"). Extract the basename without
// extension so the resolver can append `.mp3` itself.
const entries = [];
let missingImagePath = 0;
let missingAudioPath = 0;
for (const row of metadata) {
  if (!row.imagePath) {
    missingImagePath++;
    continue;
  }
  if (!row.audioPath) {
    missingAudioPath++;
    continue;
  }
  // audioPath is "audio/eng/default/<basename>.mp3" — extract basename.
  const match = /\/([^/]+)\.mp3$/i.exec(row.audioPath);
  if (!match) {
    console.warn(`   skipping malformed audioPath: ${row.audioPath}`);
    continue;
  }
  entries.push({
    imagePath: row.imagePath,
    audioBasename: match[1],
  });
}

console.log(
  `   ${entries.length.toLocaleString()} entries with valid imagePath + audioPath`
);
if (missingImagePath) console.log(`   ${missingImagePath} skipped: no imagePath`);
if (missingAudioPath) console.log(`   ${missingAudioPath} skipped: no audioPath`);

// Batch the mutation calls. Each mutation does N indexed reads + N patches,
// so keep batches at ~1000 to stay well under Convex's 8k read / 8s budget.
const BATCH_SIZE = 1000;
let totalPatched = 0;
let totalAlreadySet = 0;
let totalSymbolMissing = 0;

for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  // npx convex run takes args as JSON; passing inline is brittle for 1000
  // entries, so write to a temp file and pass --push-args-file (or stdin).
  // The CLI supports `--args` reading from stdin via a `-` sentinel.
  const tmpFile = join(
    tmpdir(),
    `audio-basenames-${Date.now()}-${i}.json`
  );
  writeFileSync(tmpFile, JSON.stringify({ entries: batch }));

  try {
    const stdout = execSync(
      `npx convex run migrations:backfillAudioBasenames "$(cat ${tmpFile})"`,
      { encoding: "utf8" }
    );
    const result = JSON.parse(stdout);
    totalPatched += result.patched;
    totalAlreadySet += result.alreadySet;
    totalSymbolMissing += result.symbolMissing;
    process.stdout.write(
      `   batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        entries.length / BATCH_SIZE
      )} → patched=${result.patched} alreadySet=${result.alreadySet} missingSym=${result.symbolMissing}\n`
    );
  } finally {
    unlinkSync(tmpFile);
  }
}

console.log("\n✅ Done.");
console.log(`   patched         ${totalPatched.toLocaleString()}`);
console.log(`   alreadySet      ${totalAlreadySet.toLocaleString()}`);
console.log(`   symbolMissing   ${totalSymbolMissing.toLocaleString()}`);
console.log(`   total entries   ${entries.length.toLocaleString()}`);
