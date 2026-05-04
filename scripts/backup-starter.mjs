/**
 * Snapshot the current starter pack contents to a JSON file in
 * `convex/data/starter_backups/`, then patch the index registry so the new
 * backup is callable by `migrations.restoreStarterPackFromBackup`.
 *
 * Run with:
 *   node --env-file=.env.local scripts/backup-starter.mjs "label-here"
 *
 * After the script writes the file + patches the index, commit BOTH files and
 * deploy. The next deploy makes the backup available in the Convex dashboard
 * under `migrations.restoreStarterPackFromBackup`.
 *
 * No admin auth needed — `api.resourcePacks.getStarterPack` is a public query
 * that returns the pack contents.
 *
 * Naming note: directory + filename components use underscores only, no
 * hyphens. Convex's path validator rejects hyphens in path components inside
 * the `convex/` tree.
 */

// Fetch the starter pack via `npx convex run` instead of the JS HTTP client.
// Reasons:
//   1. convex/_generated/api.js uses ESM syntax but Convex's codegen prunes any
//      package.json we drop alongside it, so Node can't be coaxed into loading
//      api.js as ESM from a .mjs script. Dynamic import doesn't help.
//   2. The CLI is already a hard dependency (npx convex dev runs continuously)
//      and handles auth/URL resolution from .env.local automatically.
//
// Output is redirected to a temp file rather than captured via execFileSync
// stdout — the convex CLI doesn't drain its stdout pipe quickly enough and
// truncates around ~8KB when piped, but shell-redirect to a file is reliable.
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BACKUPS_DIR = join(REPO_ROOT, "convex", "data", "starter_backups");
const INDEX_PATH = join(BACKUPS_DIR, "index.ts");

const labelArg = process.argv[2]?.trim();
if (!labelArg) {
  console.error('❌ Usage: node --env-file=.env.local scripts/backup-starter.mjs "<label>"');
  process.exit(1);
}

// Slugify label for filename: lowercase, alphanumerics + underscores only.
// Convex rejects hyphens in path components, so we use underscores throughout.
const labelSlug = labelArg
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
if (!labelSlug) {
  console.error("❌ Label produces empty slug — use letters/numbers in the label.");
  process.exit(1);
}

const now = new Date();
const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "_"); // YYYY_MM_DD
const backupName = `${dateStamp}_${labelSlug}`;
const filename = `${backupName}.json`;
const filePath = join(BACKUPS_DIR, filename);

if (existsSync(filePath)) {
  console.error(
    `❌ Backup file already exists: ${filePath}\n   Choose a different label, or delete the existing file first.`
  );
  process.exit(1);
}

console.log("📦 Fetching current starter pack via npx convex run…");

const tmpFile = join(
  tmpdir(),
  `starter_pack_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
);

let starter;
try {
  execSync(
    `npx convex run resourcePacks:getStarterPack --no-push > "${tmpFile}"`,
    { cwd: REPO_ROOT, stdio: ["ignore", "ignore", "inherit"], shell: "/bin/bash" }
  );
  starter = JSON.parse(readFileSync(tmpFile, "utf8"));
} catch (e) {
  console.error("❌ Failed to fetch starter pack via convex CLI.");
  console.error(e.message);
  process.exit(1);
} finally {
  if (existsSync(tmpFile)) {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

if (!starter) {
  console.error(
    "❌ No starter pack exists on this deployment. Run migrations.materialiseStarterPack first."
  );
  process.exit(1);
}

const backup = {
  version: 1,
  createdAt: now.toISOString(),
  label: labelArg,
  categories: starter.categories ?? [],
  lists: starter.lists ?? [],
  sentences: starter.sentences ?? [],
};

writeFileSync(filePath, JSON.stringify(backup, null, 2) + "\n");
console.log(`✅ Wrote backup file: ${filename}`);

// Patch index.ts: insert import + map entry between AUTOGEN markers.
const indexSource = readFileSync(INDEX_PATH, "utf8");

// Variable name for the import — keep it predictable for the index patcher.
const importVar = `backup_${backupName.replace(/-/g, "_")}`;

const newImportLine = `import ${importVar} from "./${backupName}.json";`;
const newEntryLine = `  "${backupName}": ${importVar} as StarterBackup,`;

if (indexSource.includes(newImportLine)) {
  console.error(`❌ Index already contains import for "${backupName}" — aborting.`);
  process.exit(1);
}

const importsBlockRegex = /(\/\/ AUTOGEN-START: imports\n)([\s\S]*?)(\n\/\/ AUTOGEN-END: imports)/;
const entriesBlockRegex = /(\/\/ AUTOGEN-START: entries\n)([\s\S]*?)(\n\s*\/\/ AUTOGEN-END: entries)/;

if (!importsBlockRegex.test(indexSource) || !entriesBlockRegex.test(indexSource)) {
  console.error(
    "❌ index.ts is missing AUTOGEN markers — patch manually or restore the markers."
  );
  process.exit(1);
}

const patchedImports = indexSource.replace(
  importsBlockRegex,
  (_, start, body, end) => {
    // Drop the placeholder comment if it's still there.
    const cleanedBody = body.replace(
      /^\/\/ \(no backups yet[^\n]*\)\n?/m,
      ""
    );
    return `${start}${cleanedBody}${newImportLine}\n${end}`;
  }
);

const patchedFinal = patchedImports.replace(
  entriesBlockRegex,
  (_, start, body, end) => {
    const cleanedBody = body.replace(
      /^\s*\/\/ \(no backups yet\)\n?/m,
      ""
    );
    return `${start}${cleanedBody}${newEntryLine}\n${end}`;
  }
);

writeFileSync(INDEX_PATH, patchedFinal);
console.log(`✅ Patched ${INDEX_PATH}`);

console.log(`
🎉 Backup written.
   Name:   ${backupName}
   Label:  ${labelArg}
   Counts: ${backup.categories.length} categories, ${backup.lists.length} lists, ${backup.sentences.length} sentences

Next steps:
  1. Review the changes:    git diff convex/data/starter_backups/
  2. Commit:                 git add convex/data/starter_backups/ && git commit -m "backup starter: ${labelArg}"
  3. Deploy:                 (your normal deploy flow)
  4. Restore later if needed:
     migrations.restoreStarterPackFromBackup({
       backupName: "${backupName}",
       adminClerkUserId: "<your-clerk-id>"
     })
`);
