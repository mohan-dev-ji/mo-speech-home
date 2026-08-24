/**
 * Backfill: shrink pre-resize AI Generate symbol images to 512px webp.
 *
 * Why:
 *   AI Generate images were saved as raw 1024x1024 PNGs straight from Gemini
 *   (~880KB each) before the client started resizing to 512px webp (~20KB)
 *   via app/components/app/shared/modals/symbol-editor/resizeImage.ts. A
 *   12-symbol board built from the old originals was ~10.5MB and took ~10s
 *   to render. This script re-encodes every existing `aiGenerated`
 *   profileSymbols image the same way resizeImage.ts encodes new ones, so
 *   backfilled and newly-authored images are indistinguishable.
 *
 *   Scope: aiGenerated symbols ONLY. Image Search JPEGs (~66KB avg) and
 *   userUpload images (~17KB avg, already resized client-side) are
 *   explicitly out of scope — do not touch them.
 *
 * Run with (Node 20+):
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   node --env-file=.env.local scripts/backfill-ai-image-sizes.mjs               # dry run (default)
 *   node --env-file=.env.local scripts/backfill-ai-image-sizes.mjs --apply       # writes R2 + Convex
 *
 * Flags:
 *   --dry-run   (default, explicit form also accepted) — download + resize in
 *               memory, report what WOULD happen, write nothing to R2 or Convex.
 *   --apply     perform the writes: upload the resized webp to a NEW R2 key,
 *               then repoint the profileSymbols row(s) at it via
 *               migrations:repointSymbolImagePath. The old full-size object is
 *               left in place (never deleted) — printed at the end under
 *               "orphaned, safe to sweep later".
 *
 * Per-image behaviour:
 *   1. Download the object at `imagePath` from R2.
 *   2. If it is already .webp AND <= 100KB, skip — already fine (this is what
 *      makes a second run of this script idempotent: nothing left to do).
 *   3. Resize to fit within 512x512 (fit: "inside", withoutEnlargement: true)
 *      and encode webp quality 85 — MUST match resizeImage.ts exactly.
 *   4. Upload to a NEW key: same directory, same UUID basename, .webp
 *      extension (ContentType: image/webp; CacheControl matches
 *      lib/r2-storage.ts's uploadBuffer default).
 *   5. Repoint every profileSymbols row that referenced the old path.
 *
 * Prerequisites:
 *   - convex/migrations.ts:listAiGeneratedSymbolImages / repointSymbolImagePath
 *     must be deployed.
 *   - R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *     R2_BUCKET_NAME (see lib/r2-storage.ts).
 *
 * Backup BEFORE running --apply (per CLAUDE.md — this repoints live rows):
 *   npx convex export --path backups/<date>-ai-image-backfill.zip
 *
 * Idempotent — a second run finds the new .webp objects already <= 100KB and
 * skips them.
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// ── Args ─────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

console.log("");
console.log(
  DRY_RUN
    ? "🔎🔎🔎  DRY RUN (default) — reads R2 + Convex only, writes NOTHING. Pass --apply to write.  🔎🔎🔎"
    : "🚨🚨🚨  APPLY MODE — this WILL upload new R2 objects and repoint Convex rows.  🚨🚨🚨"
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
    `backfill-ai-image-sizes-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
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

async function getObjectBuffer(key) {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

// Same directory, same UUID basename, .webp extension. If the key is already
// `.webp`, this returns the SAME key (in-place overwrite — see the edge case
// below), which is why we always compare newKey !== imagePath before treating
// anything as an "orphan" or issuing a repoint.
function deriveWebpKey(key) {
  const dot = key.lastIndexOf(".");
  const base = dot === -1 ? key : key.slice(0, dot);
  return `${base}.webp`;
}

const KB = 1024;
const MB = 1024 * 1024;
const SKIP_MAX_BYTES = 100 * KB;
const RESIZE_MAX_EDGE = 512;
const WEBP_QUALITY = 85; // MUST match resizeImage.ts's default quality (0.85)
// MUST match lib/r2-storage.ts's IMMUTABLE_CACHE_CONTROL default.
const CACHE_CONTROL = "private, max-age=31536000, immutable";

// ── Fetch target rows ─────────────────────────────────────────────────────────
console.log("📖 Listing aiGenerated profileSymbols rows via migrations:listAiGeneratedSymbolImages…");
let rows = convexRun("migrations:listAiGeneratedSymbolImages", {});
console.log(`   found ${rows.length} aiGenerated symbol${rows.length === 1 ? "" : "s"}\n`);

if (rows.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Skip anything outside the authoring account's own namespace unless asked.
//
// Installed content-module symbols point at the MODULE's shared assets (e.g.
// `library_packs/space/images/…`), not at copies the instructor owns. Resizing
// those would (a) write objects into a published module's asset folder that
// the module's own JSON does not reference, and (b) repoint the installed row
// away from the module's canonical path, so a reinstall would silently restore
// the oversized original. The module is the source of truth for its own assets;
// shrink it by re-publishing it, not by rewriting an installed copy.
//
// `accounts/` and `profiles/` are the personal namespaces (see
// `isPersonalAssetKey` in convex/lib/contentModuleDelete.ts) — those are the
// instructor's own images and safe to rewrite in place.
const INCLUDE_SHARED = process.argv.includes("--include-shared-module-assets");
const isPersonalKey = (k) =>
  k.startsWith("accounts/") || k.startsWith("profiles/");
const shared = rows.filter((r) => !isPersonalKey(r.imagePath));
if (shared.length && !INCLUDE_SHARED) {
  console.log(
    `\n⏭️  skipping ${shared.length} symbol(s) whose image lives in a shared ` +
      `module namespace (pass --include-shared-module-assets to override):`
  );
  for (const r of shared) console.log(`      ${r.imagePath}`);
  console.log();
}
rows = INCLUDE_SHARED ? rows : rows.filter((r) => isPersonalKey(r.imagePath));

// Dedupe by imagePath defensively — two profileSymbols rows COULD in
// principle reference the identical R2 key (e.g. a duplicated category), so
// group by path and resize/upload once per unique object, then repoint every
// row that referenced it. In practice each aiGenerated upload gets its own
// UUID key (see app/api/upload-asset/route.ts), so duplicates are expected
// to be rare-to-nonexistent — this is a safety net, not the common case.
const byPath = new Map();
for (const row of rows) {
  if (!byPath.has(row.imagePath)) byPath.set(row.imagePath, []);
  byPath.get(row.imagePath).push(row._id);
}
const dupeCount = rows.length - byPath.size;
console.log(
  `   ${byPath.size} unique image${byPath.size === 1 ? "" : "s"}` +
    (dupeCount > 0 ? ` (${dupeCount} duplicate reference${dupeCount === 1 ? "" : "s"} to a shared path)` : "") +
    "\n"
);

let symbolsProcessed = 0;
let symbolsSkipped = 0;
let imagesProcessed = 0;
let imagesSkipped = 0;
let totalBefore = 0;
let totalAfter = 0;
const orphanedKeys = [];
const errors = [];

let i = 0;
for (const [imagePath, symbolIds] of byPath) {
  i++;
  const groupLabel = `[${i}/${byPath.size}]`;
  try {
    const original = await getObjectBuffer(imagePath);
    const originalSize = original.length;
    const alreadyWebp = /\.webp$/i.test(imagePath);

    if (alreadyWebp && originalSize <= SKIP_MAX_BYTES) {
      imagesSkipped++;
      symbolsSkipped += symbolIds.length;
      console.log(
        `${groupLabel} SKIP  ${imagePath}  (${(originalSize / KB).toFixed(0)} KB, already webp) ` +
          `× ${symbolIds.length} symbol${symbolIds.length === 1 ? "" : "s"}`
      );
      continue;
    }

    const resized = await sharp(original)
      .resize(RESIZE_MAX_EDGE, RESIZE_MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const newSize = resized.length;
    const newKey = deriveWebpKey(imagePath);
    const pct = originalSize > 0 ? (100 * (1 - newSize / originalSize)).toFixed(0) : "0";

    imagesProcessed++;
    symbolsProcessed += symbolIds.length;
    totalBefore += originalSize;
    totalAfter += newSize;

    console.log(
      `${groupLabel} ${DRY_RUN ? "WOULD RESIZE" : "RESIZE"}  ${imagePath} → ${newKey}  ` +
        `${(originalSize / KB).toFixed(0)} KB → ${(newSize / KB).toFixed(0)} KB  (-${pct}%)`
    );
    for (const symbolId of symbolIds) {
      console.log(`      symbol ${symbolId}`);
    }

    if (APPLY) {
      await r2.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: newKey,
          Body: resized,
          ContentType: "image/webp",
          CacheControl: CACHE_CONTROL,
        })
      );
      if (newKey !== imagePath) {
        for (const symbolId of symbolIds) {
          convexRun("migrations:repointSymbolImagePath", { symbolId, imagePath: newKey });
        }
        orphanedKeys.push(imagePath);
      }
      // newKey === imagePath only happens for an already-.webp-but-oversized
      // source: the upload above overwrote the object in place, so there is
      // no old key to orphan and no profileSymbols row to repoint.
    } else if (newKey !== imagePath) {
      orphanedKeys.push(imagePath);
    }
  } catch (err) {
    errors.push({ imagePath, error: err instanceof Error ? err.message : String(err) });
    console.log(`${groupLabel} ❌ ERROR  ${imagePath}  ${err instanceof Error ? err.message : err}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(72));
console.log(DRY_RUN ? "DRY RUN SUMMARY (nothing written)" : "APPLY SUMMARY");
console.log("─".repeat(72));
console.log(`images processed:   ${imagesProcessed}`);
console.log(`images skipped:     ${imagesSkipped}`);
console.log(`symbols processed:  ${symbolsProcessed}`);
console.log(`symbols skipped:    ${symbolsSkipped}`);
console.log(`errors:             ${errors.length}`);
console.log(`total before:       ${(totalBefore / MB).toFixed(2)} MB`);
console.log(`total after:        ${(totalAfter / MB).toFixed(2)} MB`);
if (totalBefore > 0) {
  console.log(`saved:              ${(100 * (1 - totalAfter / totalBefore)).toFixed(1)}%`);
}

if (errors.length > 0) {
  console.log("\n⚠️  Errors:");
  for (const e of errors) console.log(`   ${e.imagePath}: ${e.error}`);
}

if (orphanedKeys.length > 0) {
  console.log(
    `\n🗑  Orphaned, safe to sweep later (old full-size objects${DRY_RUN ? " — if this were applied" : ", never deleted by this script"}):`
  );
  for (const k of orphanedKeys) console.log(`   ${k}`);
}

console.log(
  DRY_RUN ? "\n✅ Dry run complete. Re-run with --apply to write." : "\n✅ Apply complete."
);
