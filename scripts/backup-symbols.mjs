/**
 * Snapshot the entire `symbols` table to a JSONL file in
 * `convex/data/symbols_backups/`. Per the Phase 8.2 backup plan in
 * `CLAUDE.md` — milestone backups before/after every translation pipeline
 * run so the irreplaceable AI-translation work is captured in git history.
 *
 * Run with:
 *   node --env-file=.env.local scripts/backup-symbols.mjs "phase-8-2-es"
 *
 * Output:
 *   convex/data/symbols_backups/<YYYY_MM_DD>_<label>.jsonl  ← one symbol per line
 *   convex/data/symbols_backups/<YYYY_MM_DD>_<label>.meta.json ← small sidecar
 *
 * Why JSONL not single JSON:
 *   The symbols table is ~16 MB raw and a snapshot per phase milestone would
 *   bloat the repo. JSONL + ascending `_id` sort lets git's pack-file delta
 *   compression dedupe identical lines across snapshots — typical inter-phase
 *   delta is only ~5–10% of rows touched, so pack size stays modest. Bonus:
 *   `diff <old>.jsonl <new>.jsonl` shows exactly which symbols changed.
 *
 * The .meta.json sidecar is the small human-readable header (label,
 * timestamp, count, deployment) — separate from the data so you can
 * `cat *.meta.json` to see the catalogue at a glance.
 *
 * Pairs with `convex/symbols.ts:dumpSymbolsPage` for the paginated read.
 * Restore is NOT included here — restoring requires re-creating rows with
 * fresh `_id` / `_creationTime`, which is a separate (rare) operation.
 * When you need restore, write a companion `restore-symbols.mjs` that
 * reads the JSONL and patches/inserts via a mutation.
 *
 * Naming note: directory + filename components use underscores only, no
 * hyphens. Convex's path validator rejects hyphens in path components
 * inside the `convex/` tree (same constraint that drives
 * `library_packs/` and `starter_backups/`).
 */

import { execSync } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BACKUPS_DIR = join(REPO_ROOT, "convex", "data", "symbols_backups");

// ── Args ──────────────────────────────────────────────────────────────────
const labelArg = process.argv[2]?.trim();
if (!labelArg) {
  console.error(
    '❌ Usage: node --env-file=.env.local scripts/backup-symbols.mjs "<label>"'
  );
  console.error(
    '   Example labels: "phase-8-2-es", "phase-8-2-all-langs", "pre-phase-8-4"'
  );
  process.exit(1);
}

const labelSlug = labelArg
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
if (!labelSlug) {
  console.error("❌ Label produces empty slug — use letters/numbers in the label.");
  process.exit(1);
}

if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR, { recursive: true });
}

const now = new Date();
const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "_");
const baseName = `${dateStamp}_${labelSlug}`;
const jsonlPath = join(BACKUPS_DIR, `${baseName}.jsonl`);
const metaPath = join(BACKUPS_DIR, `${baseName}.meta.json`);

if (existsSync(jsonlPath)) {
  console.error(
    `❌ Backup already exists: ${jsonlPath}\n   Choose a different label or delete the existing file.`
  );
  process.exit(1);
}

// ── Paginate ──────────────────────────────────────────────────────────────
// Pages of 2000 rows balance Convex's per-query budget against round-trip
// overhead — 52k rows lands in ~26 calls. The CLI is shelled per page rather
// than once for the whole table because Convex queries can't stream and we
// don't want a single 16MB JSON blob piped through stdout (see the
// rationale in backup-starter.mjs for why we use file redirection).

console.log("📦 Backing up the symbols table…");
console.log(`   Label:  ${labelArg}`);
console.log(`   Target: ${jsonlPath}\n`);

const PAGE_SIZE = 2000;
const MAX_PAGES = 100; // safety net — 52k / 2000 = 26 pages, anything beyond 100 is wrong
const allLines = [];
let cursor = null;
let page = 0;
let totalRows = 0;

while (true) {
  page++;
  if (page > MAX_PAGES) {
    console.error(
      `\n❌ Hit page safety limit (${MAX_PAGES}). The symbols table is much larger than expected. Bump MAX_PAGES if this is legitimate.`
    );
    process.exit(1);
  }

  // Build the args object — Convex CLI parses single-quoted JSON.
  const args = cursor !== null ? { cursor, pageSize: PAGE_SIZE } : { pageSize: PAGE_SIZE };
  const argsJson = JSON.stringify(args);

  const tmpFile = join(
    tmpdir(),
    `symbols_dump_${Date.now()}_${page}_${Math.random().toString(36).slice(2)}.json`
  );

  let result;
  try {
    execSync(
      `npx convex run symbols:dumpSymbolsPage --no-push '${argsJson}' > "${tmpFile}"`,
      { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"], shell: "/bin/bash" }
    );
    result = JSON.parse(readFileSync(tmpFile, "utf8"));
  } catch (e) {
    console.error(`\n❌ Failed to fetch page ${page}.`);
    console.error(e.message);
    process.exit(1);
  } finally {
    if (existsSync(tmpFile)) {
      try {
        unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
    }
  }

  for (const sym of result.symbols) {
    allLines.push(JSON.stringify(sym));
    totalRows++;
  }

  process.stdout.write(
    `\r   page ${page} → ${totalRows.toLocaleString()} rows so far`
  );

  if (result.isDone) break;
  cursor = result.nextCursor;
}

console.log(`\n✅ Fetched ${totalRows.toLocaleString()} symbols across ${page} page(s)\n`);

// ── Write ─────────────────────────────────────────────────────────────────
// JSONL with trailing newline. Already sorted by _id ascending courtesy of
// `dumpSymbolsPage`'s `.order("asc")` — important for stable git diffs
// between snapshots.

writeFileSync(jsonlPath, allLines.join("\n") + "\n");

const meta = {
  version: 1,
  label: labelArg,
  createdAt: now.toISOString(),
  count: totalRows,
  pages: page,
  deployment: process.env.CONVEX_DEPLOYMENT ?? null,
  jsonlFile: `${baseName}.jsonl`,
};
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");

const sizeMB = (statSync(jsonlPath).size / 1024 / 1024).toFixed(2);

console.log(`💾 Wrote ${baseName}.jsonl     (${sizeMB} MB, ${totalRows.toLocaleString()} rows)`);
console.log(`💾 Wrote ${baseName}.meta.json`);
console.log(`\n📝 Next: commit both files to git so the snapshot lives in repo history.`);
console.log(`   git add convex/data/symbols_backups/${baseName}.*`);
console.log(`   git commit -m "backup: symbols ${labelArg}"`);
