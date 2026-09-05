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
 *   `imageSearchCache` carries the identity of the code that produced each
 *   row (see lib/cache-identity.ts). When that identity is bumped, rows
 *   written under the old one become permanently unreachable — dead storage
 *   nothing will ever read again. This enumerates them.
 *
 * What it classifies:
 *   imageSearchCache  DELETE  cacheVersion !== the current version (including
 *                             rows written before the guard existed), or the
 *                             24h TTL has passed. Either way `lookupSearch`
 *                             can never return the row again.
 *                     KEEP    live rows.
 *   R2 objects        KEEP    the full-size `accounts/…/images/*.png` left by
 *                             the Phase 29 backfill (never deleted by design;
 *                             this probe just reports what's still there).
 *                     KEEP    any object with a row in `accountImages` — the
 *                             account's image library (Phase 36). See THE
 *                             LIBRARY RULE below.
 *
 *   This script used to also census a second cache, of AI-generated images,
 *   and list the `ai-cache/` PNGs behind its orphaned rows. ADR-023 deleted
 *   that cache — the Convex rows are gone, so there is nothing left to
 *   sweep. The `ai-cache/` R2 objects themselves are untouched by this
 *   deletion (owner decision, 2026-08-24: the imagery is retained for the
 *   storybook module) and this script was never the thing that could reach
 *   them anyway — it has no delete path.
 *
 * THE LIBRARY RULE (Phase 36):
 *   An unused library image is *deliberately* kept, not garbage — the
 *   gallery's own Delete is the only thing that ever removes an image from
 *   R2. So any `accounts/<accountId>/images/…` object with a row in
 *   `accountImages` is a library image and MUST NEVER be reported as an
 *   orphan, no matter what else does or doesn't reference it. This script has
 *   no delete path today, which is why running it pre-Task-6 was merely
 *   incomplete rather than actively dangerous — but the moment anyone adds a
 *   DELETE classification here, skipping this rule would list a user's entire
 *   library as garbage. Never remove the `accountImages` census below without
 *   re-reading this comment.
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
console.log("📖 Reading the cache via imageCache:listCacheRowsForSweep…");
const census = convexRun("imageCache:listCacheRowsForSweep", {});
const { identity, now, imageSearch } = census;

console.log("");
console.log("Current cache identity (lib/cache-identity.ts):");
console.log(`   imageSearchCache version : ${identity.imageSearchCacheVersion}`);

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

// ── R2: the account image library (accountImages table) ─────────────────────
console.log(rule("R2 — KEEP list: account image library (accountImages table)"));
console.log("   THE LIBRARY RULE: any accounts/<accountId>/images/… object with a row");
console.log("   here is deliberately kept, not an orphan — the gallery's own Delete is");
console.log("   the only thing that removes a library image from R2. This is a hard");
console.log("   KEEP, independent of whether any symbol or cache still references it.\n");

const libraryRows = convexRun("accountImages:listAllKeysForSweep", {});
const libraryKeys = new Set(libraryRows.map((row) => row.imageKey));
console.log(
  `   ${libraryRows.length} row${libraryRows.length === 1 ? "" : "s"} across the accountImages table\n`
);
for (const row of libraryRows) {
  console.log(
    `   [   KEEP   ] ${row.imageKey} — library image (source=${row.source}, accountId=${row.accountId})`
  );
}
if (libraryRows.length === 0) console.log("   (table empty)");

// ── R2: full-size PNGs left by the Phase 29 backfill ─────────────────────────
console.log(rule("R2 — KEEP list: full-size PNGs left by the Phase 29 backfill"));
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
  let alreadyInLibrary = 0;
  for (const webpKey of candidates) {
    const pngKey = `${webpKey.slice(0, webpKey.lastIndexOf("."))}.png`;
    if (referenced.has(pngKey)) continue; // still in use — not an orphan
    // Already reported above, under the library section, with the stronger
    // reason (it has an accountImages row, not just "nothing deletes it
    // yet") — report each key once, never twice.
    if (libraryKeys.has(pngKey)) {
      alreadyInLibrary++;
      continue;
    }
    if (await exists(pngKey)) backfillLeftovers.push(pngKey);
  }
  if (backfillLeftovers.length === 0) {
    console.log("   (none found)");
  } else {
    for (const k of backfillLeftovers) console.log(`   KEEP  ${k}`);
  }
  if (alreadyInLibrary > 0) {
    console.log(
      `   (${alreadyInLibrary} more already listed above under the library section — same key, stronger reason)`
    );
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(74));
console.log("SUMMARY — nothing was deleted");
console.log("═".repeat(74));
console.log("DELETE candidates (Convex rows only):");
console.log(`   imageSearchCache rows : ${searchDelete.length} of ${imageSearch.length}`);
console.log("KEEP (R2 objects — do NOT delete):");
console.log(`   accountImages library rows                 : ${libraryRows.length}`);
console.log(
  `   accounts|profiles/…/images/*.png leftovers : ${r2Skipped ? "not checked (no R2 creds)" : backfillLeftovers.length}`
);
console.log("");
console.log("This script has no delete path. Review the ids above and perform any");
console.log("deletion yourself (Convex dashboard → table → row) if you want them gone.");
console.log("");
