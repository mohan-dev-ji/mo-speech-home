/**
 * Export the live `libraryModules` table to committed per-slug JSON in
 * `convex/data/{categories,lists,sentences,phrases}/<slug>.json`, then regenerate
 * each tree's `_index.ts` barrel (ADR-014 Task F, addendum 2026-06-27).
 *
 * This is the git audit-trail / rollback artifact for curated module content —
 * NOT the live source (the table is). Run it at milestones (after a curation
 * pass) and commit the diff, the same discipline as `scripts/backup-symbols.mjs`.
 *
 * Run:
 *   node scripts/export-library-modules.mjs
 *   git add convex/data/{categories,lists,sentences,phrases}
 *   git commit -m "export: library modules <label>"
 *
 * What it does:
 *   1. Calls the `contentModules/exportModules:dumpAllModules` query (content
 *      shape, stable key order — no volatile timestamps).
 *   2. Writes one `<slug>.json` per module under its tree dir.
 *   3. Prunes any `*.json` in those dirs that is NOT in the dump (so the
 *      artifact matches the table) — aborts if the dump is empty, to avoid a
 *      catastrophic prune.
 *   4. Regenerates each tree's `_index.ts` barrel by directory scan (these feed
 *      `migrations.seedLibraryModulesFromJSON`, the restore path).
 *
 * Requires the query to be deployed (it is, after `npx convex codegen`).
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const OUT = {
  categories: "convex/data/categories",
  lists: "convex/data/lists",
  sentences: "convex/data/sentences",
  phrases: "convex/data/phrases",
};
const MODULE_TYPE = {
  categories: "CategoryModule",
  lists: "ListModule",
  sentences: "SentenceModule",
  phrases: "PhraseModule",
};
const MAP_NAME = {
  categories: "CATEGORY_MODULES",
  lists: "LIST_MODULES",
  sentences: "SENTENCE_MODULES",
  phrases: "PHRASE_MODULES",
};

// ── Fetch the dump ──────────────────────────────────────────────────────────
console.log("📦 Exporting libraryModules → committed JSON…\n");

const tmpFile = join(tmpdir(), `modules_dump_${Date.now()}.json`);
let modules;
try {
  execSync(
    `npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' > "${tmpFile}"`,
    { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"], shell: "/bin/bash" }
  );
  modules = JSON.parse(readFileSync(tmpFile, "utf8"));
} catch (e) {
  console.error("❌ Failed to fetch the module dump.");
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

if (!Array.isArray(modules) || modules.length === 0) {
  console.error(
    "❌ Dump returned no modules — aborting (refusing to prune to an empty export). Seed the table first."
  );
  process.exit(1);
}

// ── Write per-slug JSON ─────────────────────────────────────────────────────
// Derived from OUT — a tree added there must never be missed here (the omission
// that silently dropped `phrases` from the artifact until 2026-07-17).
const seen = Object.fromEntries(Object.keys(OUT).map((t) => [t, new Set()]));
let written = 0;
for (const m of modules) {
  if (!OUT[m.tree]) {
    console.warn(`  ⚠️  skipping module with unknown tree: ${m.tree}/${m.slug}`);
    continue;
  }
  writeFileSync(
    join(REPO_ROOT, OUT[m.tree], `${m.slug}.json`),
    JSON.stringify(m, null, 2) + "\n"
  );
  seen[m.tree].add(m.slug);
  written++;
  console.log(`  ${m.tree}/${m.slug}.json`);
}

// ── Prune stale JSON (present on disk, absent from the table) ────────────────
let pruned = 0;
for (const tree of Object.keys(OUT)) {
  const dir = join(REPO_ROOT, OUT[tree]);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const slug = f.replace(/\.json$/, "");
    if (!seen[tree].has(slug)) {
      unlinkSync(join(dir, f));
      pruned++;
      console.log(`  pruned ${tree}/${f}`);
    }
  }
}

// ── Regenerate barrels by directory scan ────────────────────────────────────
/** camelCase a slug → JS import binding; prefix `_` if it would start with a digit. */
function ident(slug) {
  const id = slug.replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
  return /^[0-9]/.test(id) ? `_${id}` : id;
}

function regenBarrel(tree) {
  const dir = join(REPO_ROOT, OUT[tree]);
  const type = MODULE_TYPE[tree];
  const mapName = MAP_NAME[tree];
  const slugs = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
  const imports = slugs
    .map((s) => `import ${ident(s)} from "./${s}.json";`)
    .join("\n");
  const entries = slugs
    .map((s) => `  ${JSON.stringify(s)}: ${ident(s)} as ${type},`)
    .join("\n");
  const body = `/**
 * ${type} catalogue barrel (ADR-014 §1). AUTO-GENERATED by
 * scripts/export-library-modules.mjs — these JSON files are the git
 * backup/restore artifact for the libraryModules table, NOT the live source.
 * Regenerate by re-running the exporter, not by hand-editing.
 */

import type { ${type} } from "../_shared/types";

// ── Module imports ────────────────────────────────────────────────────────────
${imports || "// (none yet)"}

// ── Catalogue map ─────────────────────────────────────────────────────────────
export const ${mapName}: Record<string, ${type}> = {
${entries}
};
`;
  writeFileSync(join(dir, "_index.ts"), body);
  console.log(`  regenerated ${tree}/_index.ts (${slugs.length} modules)`);
}

for (const tree of Object.keys(OUT)) regenBarrel(tree);

console.log(
  `\n✅ Exported ${written} modules${pruned ? `, pruned ${pruned} stale` : ""}.`
);
console.log(
  "📝 Next: git add convex/data/{categories,lists,sentences,phrases} && git commit"
);
