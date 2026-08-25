/**
 * Backfill: lift phase-30's per-placement image credit into the phase-31
 * per-account `imageCredits` registry, and report what could not be lifted.
 *
 * Why:
 *   Wikimedia board images are Creative Commons — usable only if the
 *   photographer and licence are named, and that information is unrecoverable
 *   once discarded. Phase 30 stored credit ON EACH PLACEMENT (category symbol,
 *   list item, sentence slot, phrase word). Phase 31 replaced that with one
 *   registry row per R2 object key, per account. Everything authored before
 *   phase 31 has its credit only in the old per-placement fields — this script
 *   moves it across. Those fields are READ ONLY here; phase-30's columns are
 *   never removed or modified.
 *
 * Run with (Node 20+):
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   node --env-file=.env.local scripts/backfill-image-credits.mjs           # dry run
 *   node --env-file=.env.local scripts/backfill-image-credits.mjs --check   # completeness check only
 *   node --env-file=.env.local scripts/backfill-image-credits.mjs --apply   # writes
 *
 * Flags:
 *   --dry-run  (default, explicit form also accepted) — read Convex, print the
 *              full plan and the reconciliation, write NOTHING.
 *   --apply    perform the writes. Take a snapshot FIRST, per CLAUDE.md:
 *                npx convex export --path backups/<date>-image-credit-backfill.zip
 *   --check    run only the standing completeness check ("is there an image in
 *              use whose credit we lost?"). Always read-only, even with --apply.
 *
 * ORDERING — apply this BEFORE re-publishing any content module.
 *   A module's `credits` array is effectively immutable once written: publish
 *   merges existing-wins, export/restore carry it verbatim, install skips on
 *   collision. A module published while the admin's registry is thin is thin
 *   for every account that ever installs it, and a later re-publish cannot
 *   upgrade it — repair then means hand-editing the artifact.
 *
 * What it writes (and what it deliberately does not):
 *   imageSearch with any of attribution / licence / source URL  → registry row
 *   aiGenerated                                                 → registry row
 *                (source type only — see "aiPrompt" below)
 *   upload, symbolstix                                          → nothing, by
 *                design (owner decision 2026-08-25: no external provenance
 *                exists for an upload; SymbolStix is licensed wholesale)
 *   imageSearch with NO recoverable credit                      → nothing.
 *                Phase 29-era saves that predate the attribution work. A thin
 *                `{key, "imageSearch"}` row would carry no credit AND would
 *                stop the completeness check reporting the gap, so the gap is
 *                reported as a number instead.
 *
 *   `aiPrompt` is NOT carried. The registry has no field for it, the prompt is
 *   never removed from the symbol row, and putting it in `firstUsedFor` would
 *   make backfilled rows read differently from the ones SymbolEditorModal
 *   writes live (which put the English label there).
 *
 * Published modules are covered too. They are global (no accountId), so their
 * credit rides on `libraryModules.credits` rather than in a per-account
 * registry; `mergeModuleCredits` is existing-wins, so this can only ever ADD.
 *
 * Orphaned content — rows whose `accountId` names an account that no longer
 * exists in `users` — is SCANNED AND REPORTED but never written to. A registry
 * row keyed to a deleted account is unreadable by anyone (`getAccountImageCredits`
 * resolves the caller's own account), so writing one would add noise to the
 * table that has to prove licence compliance. Reporting it is the useful part.
 *
 * Never deletes anything. Idempotent: `writeInstalledModuleCredits` skips a key
 * that already has a row (first record wins), so a second run creates nothing.
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Args ─────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const CHECK_ONLY = process.argv.includes("--check");
const DRY_RUN = !APPLY;

/** Rows per mutation call — keeps one transaction well inside Convex's limits. */
const APPLY_BATCH = 100;

console.log("");
console.log(
  CHECK_ONLY
    ? "🔎  COMPLETENESS CHECK — read-only, writes NOTHING."
    : DRY_RUN
      ? "🔎🔎🔎  DRY RUN (default) — reads Convex only, writes NOTHING. Pass --apply to write.  🔎🔎🔎"
      : "🚨🚨🚨  APPLY MODE — this WILL insert imageCredits rows and patch libraryModules.credits.  🚨🚨🚨"
);
console.log("");

// ── Convex CLI helper (internal functions are invocable from the CLI — this
//    script never has a caller identity, which is exactly why the backfill
//    functions are internal and take an explicit accountId). ─────────────────
function convexRun(fnRef, argsObj) {
  const tmpFile = join(
    tmpdir(),
    `backfill-image-credits-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  writeFileSync(tmpFile, JSON.stringify(argsObj));
  try {
    const stdout = execSync(`npx convex run ${fnRef} --no-push "$(cat ${tmpFile})"`, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } finally {
    unlinkSync(tmpFile);
  }
}

const pad = (n, w = 6) => String(n).padStart(w);
const rule = (ch = "─") => console.log(ch.repeat(78));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const label = (account) =>
  `${account.accountId}  ${account.email || account.name || (account.hasUserRow ? "(no email)" : "⚠️  ORPHANED — no users row")}`;

// ── Accounts ─────────────────────────────────────────────────────────────────
console.log("📖 Listing accounts via imageCreditsBackfill:listBackfillAccounts…");
const { accounts, rowsWithNoAccountId } = convexRun(
  "imageCreditsBackfill:listBackfillAccounts",
  {}
);
const liveAccounts = accounts.filter((a) => a.hasUserRow);
const orphanedAccounts = accounts.filter((a) => !a.hasUserRow);
console.log(
  `   ${plural(liveAccounts.length, "live account", "live accounts")}` +
    `, ${plural(orphanedAccounts.length, "orphaned account id", "orphaned account ids")} referenced by content` +
    `, ${plural(rowsWithNoAccountId, "row", "rows")} with no accountId at all\n`
);

// ─────────────────────────────────────────────────────────────────────────────
// --check: the standing self-check. Reports the registry as it is RIGHT NOW,
// independent of the backfill plan, so it stays useful long after this phase.
// ─────────────────────────────────────────────────────────────────────────────
if (CHECK_ONLY) {
  const tally = { lost: 0, unknown: 0, orphanedLost: 0, orphanedUnknown: 0 };

  for (const account of accounts) {
    const { definitelyLost, unknown } = convexRun(
      "imageCreditsBackfill:checkAccountImageCreditCompleteness",
      { accountId: account.accountId }
    );
    if (account.hasUserRow) {
      tally.lost += definitelyLost.length;
      tally.unknown += unknown.length;
    } else {
      tally.orphanedLost += definitelyLost.length;
      tally.orphanedUnknown += unknown.length;
    }

    console.log(`ACCOUNT ${label(account)}`);
    console.log(
      `   definitely lost (row says imageSearch, no registry row): ${definitelyLost.length}`
    );
    for (const row of definitelyLost) {
      console.log(
        `      ${row.imageKey}` +
          `${row.label ? `  “${row.label}”` : ""}` +
          `  [${row.foundIn}]` +
          `  ${row.hasRecoverableCredit ? "credit recoverable — run the backfill" : "NO recoverable credit"}`
      );
    }
    console.log(`   unknown, review manually (no type on any placement): ${unknown.length}`);
    for (const row of unknown) {
      console.log(
        `      ${row.imageKey}${row.label ? `  “${row.label}”` : ""}  [${row.foundIn}]`
      );
    }
    console.log("");
  }

  rule();
  console.log("COMPLETENESS CHECK SUMMARY");
  rule();
  console.log(`definitely lost:                       ${pad(tally.lost)}`);
  console.log(`unknown, review manually:              ${pad(tally.unknown)}`);
  console.log(`  · orphaned-account content, lost:    ${pad(tally.orphanedLost)}  (unreachable — no users row)`);
  console.log(`  · orphaned-account content, unknown: ${pad(tally.orphanedUnknown)}  (unreachable — no users row)`);
  console.log(
    "\nA non-zero 'definitely lost' with credit still recoverable means the backfill" +
      "\nhas not been applied yet. A non-zero one WITHOUT recoverable credit is a" +
      "\npermanent phase-29-era hole — information, not a bug to chase." +
      "\n'unknown' should stay short enough to eyeball; if it does not, recording" +
      "\nuploads in the registry is the fix."
  );
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Default / --apply: the backfill plan.
// ─────────────────────────────────────────────────────────────────────────────
const emptyTotals = () => ({
  totalPlacements: 0,
  totalImages: 0,
  create: 0,
  present: 0,
  byDesignShared: 0,
  byDesignUpload: 0,
  imageSearchNoCredit: 0,
  unknownNoType: 0,
});
const totals = emptyTotals();
const orphanTotals = emptyTotals();
const walkedTotals = {};
let insertedTotal = 0;

for (const account of accounts) {
  const { counts, rowsWalked, proposals, lostCredit } = convexRun(
    "imageCreditsBackfill:planAccountImageCredits",
    { accountId: account.accountId }
  );

  const bucket = account.hasUserRow ? totals : orphanTotals;
  for (const key of Object.keys(bucket)) bucket[key] += counts[key];
  for (const [table, n] of Object.entries(rowsWalked)) {
    walkedTotals[table] = (walkedTotals[table] ?? 0) + n;
  }

  console.log(`ACCOUNT ${label(account)}`);
  console.log(
    `   rows walked: ` +
      Object.entries(rowsWalked)
        .map(([t, n]) => `${t}=${n}`)
        .join("  ")
  );
  console.log(
    `   ${counts.totalPlacements} image placements → ${counts.totalImages} unique R2 keys`
  );

  const verb = !account.hasUserRow ? "SKIP (orphaned)" : DRY_RUN ? "WOULD CREATE" : "CREATE";
  for (const row of proposals) {
    console.log(
      `   ${verb}  [${row.imageSourceType}]  ${row.imageKey}` +
        `${row.firstUsedFor ? `  “${row.firstUsedFor}”` : ""}` +
        `${row.attribution ? `  — ${row.attribution}` : ""}` +
        `${row.license ? `  (${row.license})` : ""}`
    );
  }
  for (const row of lostCredit) {
    console.log(
      `   NO CREDIT TO LIFT  [imageSearch]  ${row.imageKey}` +
        `${row.label ? `  “${row.label}”` : ""}  [${row.foundIn}]`
    );
  }

  // Orphaned accounts are never written to — see the header block.
  if (APPLY && account.hasUserRow && proposals.length > 0) {
    for (let i = 0; i < proposals.length; i += APPLY_BATCH) {
      const batch = proposals.slice(i, i + APPLY_BATCH);
      const { inserted } = convexRun("imageCreditsBackfill:applyAccountImageCredits", {
        accountId: account.accountId,
        credits: batch,
      });
      insertedTotal += inserted;
    }
  }
  console.log("");
}

// ── Published module artifacts ───────────────────────────────────────────────
console.log("📖 Planning published-module credits via imageCreditsBackfill:planLibraryModuleCredits…\n");
const modulePlan = convexRun("imageCreditsBackfill:planLibraryModuleCredits", {});
let moduleCreditsAdded = 0;

for (const plan of modulePlan.plans) {
  console.log(
    `MODULE ${plan.tree}/${plan.slug}  (carries ${plural(plan.existing, "credit", "credits")} today)`
  );
  for (const row of plan.credits) {
    console.log(
      `   ${DRY_RUN ? "WOULD ADD" : "ADD"}  [${row.imageSourceType}]  ${row.imageKey}` +
        `${row.firstUsedFor ? `  “${row.firstUsedFor}”` : ""}` +
        `${row.attribution ? `  — ${row.attribution}` : ""}` +
        `${row.license ? `  (${row.license})` : ""}`
    );
  }
  if (APPLY) {
    const { added } = convexRun("imageCreditsBackfill:applyLibraryModuleCredits", {
      moduleId: plan.moduleId,
      credits: plan.credits,
    });
    moduleCreditsAdded += added;
  }
  console.log("");
}

// ── Reconciliation ───────────────────────────────────────────────────────────
const sum = (t) =>
  t.create + t.present + t.byDesignShared + t.byDesignUpload + t.imageSearchNoCredit + t.unknownNoType;
const verdict = (t) => (sum(t) === t.totalImages ? "✅ matches total scanned" : "❌ DOES NOT MATCH");
const mc = modulePlan.counts;

function reconcile(title, t) {
  console.log(title);
  console.log(`total unique images scanned:                  ${pad(t.totalImages)}`);
  console.log(`  would create a registry row:                ${pad(t.create)}`);
  console.log(`  skipped, registry row already present:      ${pad(t.present)}`);
  console.log(`  skipped by design (upload / symbolstix):    ${pad(t.byDesignUpload + t.byDesignShared)}`);
  console.log(`      · SymbolStix / shared-namespace key:    ${pad(t.byDesignShared)}`);
  console.log(`      · upload/symbolstix on a creditable key:${pad(t.byDesignUpload)}`);
  console.log(`  imageSearch with NO recoverable credit:     ${pad(t.imageSearchNoCredit)}`);
  console.log(`  no type recorded (unknown, review manually):${pad(t.unknownNoType)}`);
  console.log(`                                              ${"─".repeat(6)}`);
  console.log(`  reconciles to:                              ${pad(sum(t))}  ${verdict(t)}`);
  console.log("");
}

rule();
console.log(DRY_RUN ? "DRY RUN SUMMARY (nothing written)" : "APPLY SUMMARY");
rule();
console.log("rows walked:");
for (const [table, n] of Object.entries(walkedTotals)) {
  console.log(`   ${table.padEnd(20)} ${pad(n)}`);
}
console.log(`   (rows with no accountId at all: ${rowsWithNoAccountId} — unreachable by any account walk)`);
console.log("");

reconcile(
  `ACCOUNT REGISTRY — ${totals.totalPlacements} image placements across ${plural(liveAccounts.length, "live account", "live accounts")}`,
  totals
);

if (orphanedAccounts.length > 0) {
  reconcile(
    `⚠️  ORPHANED CONTENT — ${orphanTotals.totalPlacements} image placements across ` +
      `${plural(orphanedAccounts.length, "account id", "account ids")} with no \`users\` row.\n` +
      `    Scanned and reported; NOTHING is written for these, even with --apply.`,
    orphanTotals
  );
}

console.log(`PUBLISHED MODULES — ${plural(mc.modules, "module", "modules")}`);
console.log(`total unique images scanned:                  ${pad(mc.totalImages)}`);
console.log(`  would add a credit to the artifact:         ${pad(mc.create)}  (across ${plural(mc.modulesWouldChange, "module", "modules")})`);
console.log(`  skipped, credit already on the artifact:    ${pad(mc.present)}`);
console.log(`  skipped by design (upload / symbolstix):    ${pad(mc.byDesignUpload + mc.byDesignShared)}`);
console.log(`  imageSearch with NO recoverable credit:     ${pad(mc.imageSearchNoCredit)}`);
console.log(`  no type recorded (unknown, review manually):${pad(mc.unknownNoType)}`);
console.log(`                                              ${"─".repeat(6)}`);
console.log(`  reconciles to:                              ${pad(sum(mc))}  ${verdict(mc)}`);

if (APPLY) {
  console.log("");
  console.log(`registry rows inserted:      ${pad(insertedTotal)}`);
  console.log(`module credits added:        ${pad(moduleCreditsAdded)}`);
}

console.log(
  DRY_RUN
    ? "\n✅ Dry run complete. Nothing written.\n" +
        "   Re-run with --apply to write — AFTER `npx convex export`, and BEFORE\n" +
        "   re-publishing any content module (a module's credits cannot be upgraded\n" +
        "   by a later re-publish).\n" +
        "   Then `--check` to confirm the registry matches reality."
    : "\n✅ Apply complete. Run with --check to confirm."
);
