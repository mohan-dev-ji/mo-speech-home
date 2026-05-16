/**
 * One-shot migration: dump every `resourcePacks` row on the dev Convex
 * deployment into `convex/data/library_packs/<slug>.json` and update the
 * barrel (`_index.ts`) to wire them into the catalogue.
 *
 * Per ADR-010. This is the **data-preservation** step that runs before any
 * read-path cutover or table reconditioning. Idempotent — re-running on a
 * pack that's already exported overwrites the JSON file in place; safe.
 *
 * Run with:
 *   node --env-file=.env.local scripts/pack-migrate.mjs
 *
 * Prerequisites:
 *   - `migrations.backfillResourcePackSlugs` has been run on dev (each
 *     resourcePacks row has a `slug` field). The script aborts if any row
 *     lacks a slug.
 *   - `npx convex dev` is running OR the deployment is reachable via the
 *     CLI's default auth.
 *
 * Output:
 *   - One JSON file per pack at `convex/data/library_packs/<slug>.json`.
 *   - Updated `_index.ts` barrel with import + map entry for each.
 *   - Summary printed to stdout.
 *
 * **R2 assets are NOT copied by this script.** All existing pack content
 * references SymbolStix paths (global, shared across deployments) or the
 * default cover path; both resolve correctly post-cutover without moving.
 * If/when custom illustrations enter packs, the Phase 6 authoring API
 * route handles the `library_packs/<slug>/…` copy. The script logs a
 * warning per pack that has account-scoped imagery so we don't lose
 * track. Pattern matches `scripts/backup-starter.mjs` (which also leaves
 * paths intact).
 *
 * After the script writes the files, review the diff and commit. Once
 * merged + deployed, every existing pack is safely captured in the repo
 * before any read-path cutover happens.
 */

import { execSync } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PACKS_DIR = join(REPO_ROOT, "convex", "data", "library_packs");
const INDEX_PATH = join(PACKS_DIR, "_index.ts");

if (!existsSync(PACKS_DIR)) {
  mkdirSync(PACKS_DIR, { recursive: true });
}

console.log("📦 Fetching all resourcePacks from dev Convex…");

const tmpFile = join(
  tmpdir(),
  `resource_packs_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
);

let packs;
try {
  execSync(
    `npx convex run resourcePacks:getAllResourcePacks --no-push > "${tmpFile}"`,
    { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"], shell: "/bin/bash" }
  );
  packs = JSON.parse(readFileSync(tmpFile, "utf8"));
} catch (e) {
  console.error("❌ Failed to fetch resourcePacks via convex CLI.");
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

if (!Array.isArray(packs) || packs.length === 0) {
  console.log(
    "⚠️  No resourcePacks rows found on dev — nothing to migrate. Exiting."
  );
  process.exit(0);
}

console.log(`   Found ${packs.length} pack(s) to migrate.`);

// Track which packs were written so we can rebuild the barrel cleanly.
const written = [];

for (const pack of packs) {
  if (!pack.slug) {
    console.error(
      `❌ Pack "${pack.name?.eng ?? "?"}" (id ${pack._id}) has no slug — run migrations.backfillResourcePackSlugs first, then retry.`
    );
    process.exit(1);
  }

  // Build the LibraryPack shape from the resourcePacks row.
  // - Drop Convex-only fields: _id, _creationTime, sourceProfileCategoryId,
  //   sourceProfileListId, sourceProfileSentenceId, updatedAt, createdBy.
  // - Keep slug, name, description, coverImagePath, defaultTier, isStarter.
  // - Mirror categories/lists/sentences arrays after stripping source refs.
  const stripCategorySource = (cat) => {
    const { sourceProfileCategoryId: _src, ...rest } = cat;
    return rest;
  };
  const stripListSource = (list) => {
    const { sourceProfileListId: _src, ...rest } = list;
    return rest;
  };
  const stripSentenceSource = (sent) => {
    const { sourceProfileSentenceId: _src, ...rest } = sent;
    return rest;
  };

  const libraryPack = {
    slug: pack.slug,
    name: pack.name,
    description: pack.description,
    coverImagePath: pack.coverImagePath,
    defaultTier: pack.tier ?? "free",
    ...(pack.isStarter ? { isStarter: true } : {}),
    ...(pack.categories
      ? { categories: pack.categories.map(stripCategorySource) }
      : {}),
    lists: (pack.lists ?? []).map(stripListSource),
    sentences: (pack.sentences ?? []).map(stripSentenceSource),
  };

  // Warn about account-scoped imagery — those would need an R2 copy step
  // post-migration. The starter / Religion / Fun packs reference only
  // SymbolStix paths + the default cover, so this is mostly informational.
  const warnings = [];
  const checkPath = (p, where) => {
    if (typeof p !== "string") return;
    if (p.startsWith("accounts/") || p.startsWith("profiles/")) {
      warnings.push(`${where}: ${p}`);
    }
  };
  checkPath(libraryPack.coverImagePath, "coverImagePath");
  for (const cat of libraryPack.categories ?? []) {
    checkPath(cat.imagePath, `category[${cat.name.eng}].imagePath`);
  }
  for (const list of libraryPack.lists) {
    for (const item of list.items) {
      checkPath(item.imagePath, `list[${list.name.eng}].items[${item.order}].imagePath`);
      checkPath(item.audioPath, `list[${list.name.eng}].items[${item.order}].audioPath`);
    }
  }
  for (const sent of libraryPack.sentences) {
    for (const slot of sent.slots) {
      checkPath(
        slot.imagePath,
        `sentence[${sent.name.eng}].slots[${slot.order}].imagePath`
      );
    }
    checkPath(sent.audioPath, `sentence[${sent.name.eng}].audioPath`);
  }

  const filename = `${pack.slug}.json`;
  const filePath = join(PACKS_DIR, filename);
  writeFileSync(filePath, JSON.stringify(libraryPack, null, 2) + "\n");

  const categoryCount = libraryPack.categories?.length ?? 0;
  const listCount = libraryPack.lists.length;
  const sentenceCount = libraryPack.sentences.length;
  console.log(
    `✅ ${pack.slug}.json — ${categoryCount} cat / ${listCount} list / ${sentenceCount} sent` +
      (pack.isStarter ? " (starter)" : "")
  );

  if (warnings.length > 0) {
    console.log(
      `   ⚠️  ${warnings.length} account-scoped path(s) — will need an R2 copy step before this pack is loaded by other accounts:`
    );
    for (const w of warnings.slice(0, 5)) {
      console.log(`      • ${w}`);
    }
    if (warnings.length > 5) {
      console.log(`      …and ${warnings.length - 5} more`);
    }
  }

  written.push({ slug: pack.slug, isStarter: !!pack.isStarter });
}

// Rebuild the barrel — imports + map, alphabetical with starter first.
written.sort((a, b) => {
  if (a.isStarter && !b.isStarter) return -1;
  if (b.isStarter && !a.isStarter) return 1;
  return a.slug.localeCompare(b.slug);
});

const importVarFor = (slug) => slug.replace(/^_+/, "").replace(/[^a-zA-Z0-9]+/g, "_");

const importLines = written.map(
  (w) => `import ${importVarFor(w.slug)} from "./${w.slug}.json";`
);
const mapLines = written.map(
  (w) => `  "${w.slug}": ${importVarFor(w.slug)} as LibraryPack,`
);

const barrel = `/**
 * Library pack catalogue barrel.
 *
 * Imports every \`*.json\` file in this directory and re-exports them as a
 * typed \`LIBRARY_PACKS\` map keyed by slug. Bundlers (Convex + Next.js) treat
 * the JSON imports as compile-time data, so this map ships with every deploy.
 *
 * **When adding a pack**: place the new \`<slug>.json\` file alongside this
 * barrel, then add one import line + one map entry below. Keep the map
 * keys + filenames + the file's \`slug\` field aligned.
 *
 * **When removing a pack**: delete the JSON file, remove the import and
 * the map entry. A pack is treated as "not in the catalogue" the moment
 * it's missing from \`LIBRARY_PACKS\`.
 *
 * Per ADR-010. This file is regenerated by \`scripts/pack-migrate.mjs\` on
 * migration, and edited by hand (or by the Phase 6 authoring API route)
 * thereafter.
 */

import type { LibraryPack } from "./types";

// ── Pack imports ────────────────────────────────────────────────────────────
${importLines.join("\n")}

// ── Catalogue map ───────────────────────────────────────────────────────────

export const LIBRARY_PACKS: Record<string, LibraryPack> = {
${mapLines.join("\n")}
};

// ── Re-exports ──────────────────────────────────────────────────────────────

export type { LibraryPack } from "./types";
`;

writeFileSync(INDEX_PATH, barrel);
console.log(`✅ Rebuilt ${written.length}-entry barrel: convex/data/library_packs/_index.ts`);

console.log("");
console.log("🎉 Migration complete. Next steps:");
console.log("   1. Review the diff: git diff convex/data/library_packs/");
console.log("   2. Commit + open PR.");
console.log("   3. After merge + deploy, Phase 4 (V2 read paths) is safe to cut over.");
