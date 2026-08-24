/**
 * READ-ONLY census of dead rows and orphaned objects left behind by a cache
 * identity change (MOS-31).
 *
 * ⚠️  THIS SCRIPT DELETES NOTHING AND HAS NO --apply FLAG. ⚠️
 *     It prints what a sweep *would* remove so the owner can review the list
 *     and perform any deletion themselves. Every Convex call it makes is a
 *     query; every R2 call it makes is a HeadObject. There is no delete code
 *     path in this file — deliberately, so there is nothing to trip over.
 *
 * Why it exists:
 *   Both image caches now carry the identity of the code that produced each
 *   row (see lib/cache-identity.ts). When that identity is bumped, rows written
 *   under the old one become permanently unreachable — dead storage nothing
 *   will ever read again. This enumerates them.
 *
 * What it classifies:
 *   imageSearchCache  DELETE  cacheVersion !== the current version (including
 *                             rows written before the guard existed), or the
 *                             24h TTL has passed. Either way `lookupSearch`
 *                             can never return the row again.
 *                     KEEP    live rows.
 *   aiImageCache      DELETE  rows whose key can no longer be produced: the
 *                             SHA-256 of the row's own prompt+style under the
 *                             CURRENT model does not equal its stored `hash`
 *                             (i.e. Imagen-era rows, stranded when the model
 *                             moved to Gemini in 0c26d70). `lookupAi` can
 *                             never reach them.
 *                     KEEP    reachable rows.
 *   R2 objects        KEEP    all of them — both the `ai-cache/` PNGs behind
 *                             orphaned aiImageCache rows and the full-size
 *                             `accounts/…/images/*.png` left by the Phase 29
 *                             backfill. Owner decision (2026-08-24): the AI
 *                             imagery is kept for the storybook module. The
 *                             Convex row is disposable; the picture is not.
 *
 * Run with (Node 20+):
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   node --env-file=.env.local scripts/sweep-cache-orphans.mjs
 *
 * R2 credentials (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
 * R2_BUCKET_NAME) are optional: without them the Convex census still runs and
 * the backfill-leftover section reports itself as skipped rather than failing.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

// ── Convex CLI helper ────────────────────────────────────────────────────────
// Same pattern as scripts/backfill-ai-image-sizes.mjs: internal functions are
// invocable from the CLI, which is what we want because this script has no
// caller identity. `--no-push` is mandatory — never let a script deploy.
function convexRun(fnRef, argsObj) {
  const tmpFile = join(
    tmpdir(),
    `sweep-cache-orphans-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
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

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const short = (s) => `${s.slice(0, 12)}…`;
const rule = (label) => `\n── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`;

function relativeTime(ms) {
  const abs = Math.abs(ms);
  const h = abs / 3_600_000;
  const unit = h >= 48 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(1)}h`;
  return ms < 0 ? `${unit} ago` : `in ${unit}`;
}

console.log("");
console.log("🔎🔎🔎  READ-ONLY SWEEP — enumerates only. Deletes NOTHING. No --apply exists.  🔎🔎🔎");
console.log("");

// ── Cache census ─────────────────────────────────────────────────────────────
console.log("📖 Reading both caches via imageCache:listCacheRowsForSweep…");
const census = convexRun("imageCache:listCacheRowsForSweep", {});
const { identity, now, imageSearch, aiImage } = census;

console.log("");
console.log("Current cache identity (lib/cache-identity.ts):");
console.log(`   imageSearchCache version : ${identity.imageSearchCacheVersion}`);
console.log(`   aiImageCache model       : ${identity.aiImageModel}`);

// ── imageSearchCache ─────────────────────────────────────────────────────────
console.log(rule("imageSearchCache"));
console.log(`   ${imageSearch.length} row${imageSearch.length === 1 ? "" : "s"}\n`);

const searchDelete = [];
const searchKeep = [];
for (const row of imageSearch) {
  const stale = row.cacheVersion !== identity.imageSearchCacheVersion;
  const expired = row.expiresAt <= now;
  if (stale || expired) {
    searchDelete.push({ ...row, stale, expired });
  } else {
    searchKeep.push(row);
  }
}

for (const row of searchDelete) {
  const reason = row.stale
    ? `stale identity (cacheVersion=${row.cacheVersion ?? "unset — written before the guard"}, current=${identity.imageSearchCacheVersion})`
    : `expired ${relativeTime(row.expiresAt - now)}`;
  console.log(`   [DELETE row] "${row.query}" page ${row.page} — ${reason}`);
  console.log(
    `                _id ${row._id}  ${row.resultCount} result${row.resultCount === 1 ? "" : "s"} [${row.providers.join(", ") || "none"}]`
  );
}
for (const row of searchKeep) {
  console.log(
    `   [   KEEP   ] "${row.query}" page ${row.page} — live, expires ${relativeTime(row.expiresAt - now)}`
  );
}
if (imageSearch.length === 0) console.log("   (table empty)");
console.log("\n   No R2 objects are involved — this cache stores provider URLs, not files.");

// ── aiImageCache ─────────────────────────────────────────────────────────────
console.log(rule("aiImageCache"));
console.log(`   ${aiImage.length} row${aiImage.length === 1 ? "" : "s"}\n`);

const aiDelete = [];
const aiKeep = [];
for (const row of aiImage) {
  // `hashInput` is what this row's key WOULD be today, built server-side from
  // the row's own style+prompt via the shared recipe. If it doesn't digest to
  // the stored hash, no future request can ever address this row.
  const currentHash = sha256(row.hashInput);
  if (currentHash === row.hash) aiKeep.push(row);
  else aiDelete.push({ ...row, currentHash });
}

for (const row of aiDelete) {
  console.log(`   [DELETE row] "${row.prompt}" (${row.style}) — key can no longer be produced`);
  console.log(`                _id ${row._id}  hits=${row.hits}  model=${row.model ?? "unstamped (pre-Gemini)"}`);
  console.log(`                stored hash ${short(row.hash)}   key today ${short(row.currentHash)}`);
  console.log(`                → R2 object ${row.r2Key}  [KEEP — see below]`);
}
for (const row of aiKeep) {
  console.log(`   [   KEEP   ] "${row.prompt}" (${row.style}) — reachable, hits=${row.hits}`);
}
if (aiImage.length === 0) console.log("   (table empty)");

// ── R2: objects behind orphaned AI rows ──────────────────────────────────────
console.log(rule("R2 — KEEP list 1: images behind orphaned aiImageCache rows"));
console.log("   Owner decision 2026-08-24: the AI imagery is KEPT for the storybook module.");
console.log("   Deleting the Convex row above does NOT imply deleting these objects.\n");
if (aiDelete.length === 0) {
  console.log("   (none — every aiImageCache row is still reachable)");
} else {
  for (const row of aiDelete) console.log(`   KEEP  ${row.r2Key}`);
}

// ── R2: full-size PNGs left by the Phase 29 backfill ─────────────────────────
console.log(rule("R2 — KEEP list 2: full-size PNGs left by the Phase 29 backfill"));
console.log("   scripts/backfill-ai-image-sizes.mjs re-encodes `X.png` to `X.webp` and");
console.log("   repoints the symbol, never deleting the original (by design). Derived");
console.log("   live here: for every symbol now on a `.webp`, probe R2 for the same-UUID");
console.log("   `.png` sibling and report it if it exists and nothing references it.\n");

const bucketName = process.env.R2_BUCKET_NAME;
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

const backfillLeftovers = [];
let r2Skipped = false;
if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  r2Skipped = true;
  console.log("   ⏭️  SKIPPED — R2 env vars not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,");
  console.log("       R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME). The cache census above is");
  console.log("       unaffected; re-run with `node --env-file=.env.local` for this section.");
} else {
  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const exists = async (key) => {
    try {
      await r2.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      return true;
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") return false;
      throw err;
    }
  };

  const symbolRows = convexRun("migrations:listResizableSymbolImages", {});
  // Every path any resizable symbol currently points at. The backfill only ever
  // repointed `aiGenerated`/`imageSearch` rows, so this is the complete set of
  // referrers that could still be holding an old `.png`.
  const referenced = new Set(symbolRows.map((r) => r.imagePath));
  const candidates = [...new Set(symbolRows.map((r) => r.imagePath))].filter((k) =>
    /\.webp$/i.test(k)
  );
  console.log(
    `   probing ${candidates.length} .webp symbol image${candidates.length === 1 ? "" : "s"} for a stranded .png sibling…\n`
  );
  for (const webpKey of candidates) {
    const pngKey = `${webpKey.slice(0, webpKey.lastIndexOf("."))}.png`;
    if (referenced.has(pngKey)) continue; // still in use — not an orphan
    if (await exists(pngKey)) backfillLeftovers.push(pngKey);
  }
  if (backfillLeftovers.length === 0) {
    console.log("   (none found)");
  } else {
    for (const k of backfillLeftovers) console.log(`   KEEP  ${k}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(74));
console.log("SUMMARY — nothing was deleted");
console.log("═".repeat(74));
console.log("DELETE candidates (Convex rows only):");
console.log(`   imageSearchCache rows : ${searchDelete.length} of ${imageSearch.length}`);
console.log(`   aiImageCache rows     : ${aiDelete.length} of ${aiImage.length}`);
console.log("KEEP (R2 objects — do NOT delete):");
console.log(`   ai-cache/ images behind orphaned rows : ${aiDelete.length}`);
console.log(
  `   accounts|profiles/…/images/*.png leftovers : ${r2Skipped ? "not checked (no R2 creds)" : backfillLeftovers.length}`
);
console.log("");
console.log("This script has no delete path. Review the ids above and perform any");
console.log("deletion yourself (Convex dashboard → table → row) if you want them gone.");
console.log("");
