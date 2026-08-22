/**
 * Verify the committed `convex/data/**` JSON artifact matches the live
 * `libraryModules` table exactly.
 *
 * The artifact is the rollback path for the whole content catalogue, so
 * "it looks right" is not good enough — this makes the claim testable. It is
 * the pass/fail gate for the wipe/restore DR test (MOS-25).
 *
 * Compares STRUCTURALLY, not byte-wise: Convex's value encoding returns object
 * fields key-sorted, so on-disk key order carries no meaning.
 *
 * Run:
 *   node scripts/verify-module-roundtrip.mjs
 *   node scripts/verify-module-roundtrip.mjs --json /tmp/dump.json
 *
 * Exit 0 = artifact matches the table. Exit 1 = drift (reported per slug).
 */

import { readFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TREES = ["categories", "lists", "sentences", "phrases"];

// ── Load the live dump ──────────────────────────────────────────────────────
const jsonFlag = process.argv.indexOf("--json");
let live;
if (jsonFlag !== -1) {
  live = JSON.parse(readFileSync(process.argv[jsonFlag + 1], "utf8"));
  console.log(`📄 Comparing against saved dump: ${process.argv[jsonFlag + 1]}\n`);
} else {
  const tmp = join(tmpdir(), `verify_modules_${process.pid}.json`);
  try {
    execSync(
      `npx convex run contentModules/exportModules:dumpAllModules --no-push '{}' > "${tmp}"`,
      { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"], shell: "/bin/bash" }
    );
    live = JSON.parse(readFileSync(tmp, "utf8"));
  } finally {
    if (existsSync(tmp)) { try { unlinkSync(tmp); } catch { /* ignore */ } }
  }
  console.log("🔗 Comparing against the live libraryModules table\n");
}

if (!Array.isArray(live) || live.length === 0) {
  console.error("❌ Dump is empty — refusing to report a match against nothing.");
  process.exit(1);
}

// ── Structural deep-diff ────────────────────────────────────────────────────
/** Recursively collect `path: liveValue != diskValue` differences. */
function diff(a, b, path = "", out = []) {
  if (a === b) return out;
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) {
    out.push(`${path || "<root>"}: type ${ta} (live) vs ${tb} (disk)`);
    return out;
  }
  if (ta === "array") {
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} (live) vs ${b.length} (disk)`);
      return out;
    }
    for (let i = 0; i < a.length; i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (ta === "object") {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in a)) { out.push(`${p}: missing live, present on disk`); continue; }
      if (!(k in b)) { out.push(`${p}: present live, missing on disk`); continue; }
      diff(a[k], b[k], p, out);
    }
    return out;
  }
  out.push(`${path}: ${JSON.stringify(a)} (live) != ${JSON.stringify(b)} (disk)`);
  return out;
}

// ── Compare ─────────────────────────────────────────────────────────────────
const liveByKey = new Map(live.map((m) => [`${m.tree}/${m.slug}`, m]));
const diskByKey = new Map();
for (const tree of TREES) {
  const dir = join(REPO_ROOT, "convex/data", tree);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const slug = f.replace(/\.json$/, "");
    diskByKey.set(`${tree}/${slug}`, JSON.parse(readFileSync(join(dir, f), "utf8")));
  }
}

const onlyLive = [...liveByKey.keys()].filter((k) => !diskByKey.has(k)).sort();
const onlyDisk = [...diskByKey.keys()].filter((k) => !liveByKey.has(k)).sort();
const both = [...liveByKey.keys()].filter((k) => diskByKey.has(k)).sort();

let failed = 0;
for (const k of onlyLive) { console.log(`❌ ${k}: in the table, NO JSON on disk`); failed++; }
for (const k of onlyDisk) { console.log(`❌ ${k}: JSON on disk, NOT in the table`); failed++; }
for (const k of both) {
  const d = diff(liveByKey.get(k), diskByKey.get(k));
  if (d.length === 0) continue;
  failed++;
  console.log(`❌ ${k}: ${d.length} difference(s)`);
  for (const line of d.slice(0, 10)) console.log(`     ${line}`);
  if (d.length > 10) console.log(`     …and ${d.length - 10} more`);
}

console.log(
  `\n${failed ? "❌" : "✅"} ${both.length} compared, ${onlyLive.length} live-only, ` +
  `${onlyDisk.length} disk-only, ${failed} module(s) with drift.`
);
process.exit(failed ? 1 : 0);
