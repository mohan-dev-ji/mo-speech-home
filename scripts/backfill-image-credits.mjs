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
 *   --dry-run  (default) — read Convex, print the full plan and the
 *              reconciliation, write NOTHING. ALSO A HARD VETO: if both
 *              --dry-run and --apply are passed, --dry-run wins and nothing is
 *              written. (Review-fix pass 2 — previously this flag was
 *              documented but never parsed, so `--dry-run --apply` silently
 *              wrote. Now it is checked first, before --apply is honoured.)
 *   --apply    perform the writes, UNLESS --dry-run is also present (see
 *              above). Take a snapshot FIRST, per CLAUDE.md:
 *                npx convex export --path backups/<date>-image-credit-backfill.zip
 *   --check    run only the standing completeness check ("is there an image in
 *              use whose credit we lost?"). Always read-only, even with --apply.
 *              Covers BOTH the per-account registry AND the published module
 *              artifacts (whole-phase review, Finding 4 — it used to exit
 *              before the module plan ran, so a module shipping with missing
 *              credits got a clean bill of health).
 *
 * ORDERING — prefer applying this BEFORE re-publishing any content module.
 *   A module's `credits` array is effectively immutable once written: publish
 *   merges existing-wins, export/restore carry it verbatim, install skips on
 *   collision. A module published while the admin's registry is thin is thin
 *   for every account that ever installs it, and a later re-publish cannot
 *   upgrade it — repair then means hand-editing the artifact.
 *
 *   Since the whole-phase review (Finding 1) this is a NICETY, not a
 *   correctness requirement: `collectModuleCredits` now falls back to the
 *   provenance on the published row itself when the registry lookup misses, so
 *   a publish on an un-backfilled registry no longer silently drops a credit it
 *   could have recovered. Applying first still means fewer lookups miss, and
 *   only the registry can supply an `imageTitle`.
 *
 * AFTER --apply, RE-EXPORT THE COMMITTED ARTIFACTS (whole-phase review,
 * Finding 2). `--apply` patches `libraryModules.credits` in the LIVE table, and
 * `convex/data/<tree>/<slug>.json` — the committed disaster-recovery artifact
 * that `seedLibraryModulesFromJSON` restores from — does not have those credits
 * on disk. Leave them out of sync and `scripts/verify-module-roundtrip.mjs`
 * reports drift, and a restore republishes the module with its credits
 * STRIPPED. So:
 *     node scripts/export-library-modules.mjs
 *     git add convex/data && git commit
 *     node scripts/verify-module-roundtrip.mjs      # must exit 0
 * The script prints this reminder at the end of every --apply run too, so the
 * instruction survives any acceptance doc being archived.
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
 * ONE EXCEPTION (whole-phase review, Finding 3a; fix pass 2 gave the account
 * registry the SAME exception): images still keyed under the retired
 * `library_packs/` prefix are counted and reported but never written — not to
 * the artifact, and not to any account's registry either. `space` is
 * scheduled to be re-published onto `library_modules/`, existing-wins credit
 * merge would then leave BOTH key sets on the artifact forever, and an
 * account that had `space` installed under the old keys would collect a
 * second, permanently-orphaned registry row the moment it reinstalled —
 * there is no delete path for `imageCredits` rows. The credit is recovered by
 * the re-publish anyway (a fallback, not a loss) — re-run this backfill after
 * `space` is re-published and reinstalled to pick these up under their new
 * keys. The reasoning in full is on `planLibraryModuleCredits` and
 * `planAccountImageCredits` in convex/imageCreditsBackfill.ts.
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
// --dry-run is a HARD VETO over --apply (Finding 4, review-fix pass 2): this is
// the one flag where getting it wrong is unrecoverable, so an explicit
// --dry-run always wins even if --apply is also present on the command line.
const APPLY_REQUESTED = process.argv.includes("--apply");
const DRY_RUN_REQUESTED = process.argv.includes("--dry-run");
const CHECK_ONLY = process.argv.includes("--check");
const APPLY = APPLY_REQUESTED && !DRY_RUN_REQUESTED;
const DRY_RUN = !APPLY;

if (APPLY_REQUESTED && DRY_RUN_REQUESTED) {
  console.log(
    "⚠️  Both --apply and --dry-run were passed — --dry-run wins. Nothing will be written.\n"
  );
}

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
  const tally = {
    lost: 0,
    lostRecoverable: 0,
    lostPermanent: 0,
    aiMissing: 0,
    unknown: 0,
    deferredLegacyPrefix: 0,
    orphanedLost: 0,
    orphanedAiMissing: 0,
    orphanedUnknown: 0,
    orphanedDeferredLegacyPrefix: 0,
  };

  for (const account of accounts) {
    const { definitelyLost, aiGeneratedMissing, unknown, deferredLegacyPrefix } = convexRun(
      "imageCreditsBackfill:checkAccountImageCreditCompleteness",
      { accountId: account.accountId }
    );
    const recoverable = definitelyLost.filter((r) => r.hasRecoverableCredit).length;
    const permanent = definitelyLost.length - recoverable;
    if (account.hasUserRow) {
      tally.lost += definitelyLost.length;
      tally.lostRecoverable += recoverable;
      tally.lostPermanent += permanent;
      tally.aiMissing += aiGeneratedMissing.length;
      tally.unknown += unknown.length;
      tally.deferredLegacyPrefix += deferredLegacyPrefix.length;
    } else {
      tally.orphanedLost += definitelyLost.length;
      tally.orphanedAiMissing += aiGeneratedMissing.length;
      tally.orphanedUnknown += unknown.length;
      tally.orphanedDeferredLegacyPrefix += deferredLegacyPrefix.length;
    }

    console.log(`ACCOUNT ${label(account)}`);
    console.log(
      `   definitely lost (row says imageSearch, no registry row): ${definitelyLost.length}` +
        `  (${recoverable} recoverable via backfill, ${permanent} permanent)`
    );
    for (const row of definitelyLost) {
      console.log(
        `      ${row.imageKey}` +
          `${row.label ? `  “${row.label}”` : ""}` +
          `  [${row.foundIn}]` +
          `  ${row.hasRecoverableCredit ? "credit recoverable — run the backfill" : "NO recoverable credit"}`
      );
    }
    // aiGenerated is always fully recoverable via the backfill — see the
    // docblock on checkAccountImageCreditCompleteness for why it never has a
    // "permanent" variant the way imageSearch does.
    console.log(
      `   missing (row says aiGenerated, no registry row): ${aiGeneratedMissing.length}` +
        `  (all recoverable via backfill)`
    );
    for (const row of aiGeneratedMissing) {
      console.log(
        `      ${row.imageKey}${row.label ? `  “${row.label}”` : ""}  [${row.foundIn}]  credit recoverable — run the backfill`
      );
    }
    console.log(`   unknown, review manually (no type on any placement): ${unknown.length}`);
    for (const row of unknown) {
      console.log(
        `      ${row.imageKey}${row.label ? `  “${row.label}”` : ""}  [${row.foundIn}]`
      );
    }
    // NOT lost — a deliberate, temporary exclusion. See
    // `checkAccountImageCreditCompleteness`'s docblock for the full reasoning;
    // this bucket self-heals to zero once `space` is re-published and
    // reinstalled and the backfill is re-run.
    console.log(
      `   deferred until \`space\` is re-keyed (legacy \`library_packs/\` key, not lost): ${deferredLegacyPrefix.length}`
    );
    for (const row of deferredLegacyPrefix) {
      console.log(
        `      ${row.imageKey}${row.label ? `  “${row.label}”` : ""}  [${row.foundIn}]`
      );
    }
    console.log("");
  }

  // ── Published module artifacts (whole-phase review, Finding 4) ────────────
  // `--check` used to EXIT before this, so it gave a clean bill of health to a
  // module published with missing credits. Modules are the multiplier this
  // whole phase is about — publish once, forty families install — so the
  // artifact was the one thing not under the standing alarm. It is now.
  // Read-only: `planLibraryModuleCredits` is an internalQuery and plans only.
  const checkModulePlan = convexRun("imageCreditsBackfill:planLibraryModuleCredits", {});
  const cmc = checkModulePlan.counts;

  console.log(`MODULE ARTIFACTS — ${plural(cmc.modules, "published module", "published modules")}`);
  for (const plan of checkModulePlan.plans) {
    console.log(
      `   ${plan.tree}/${plan.slug}` +
        `  —  ${plural(plan.credits.length, "image with no credit on the artifact", "images with no credit on the artifact")}` +
        `  (carries ${plural(plan.existing, "credit", "credits")} today)`
    );
    for (const row of plan.credits) {
      console.log(
        `      ${row.imageKey}${row.firstUsedFor ? `  “${row.firstUsedFor}”` : ""}` +
          `${row.attribution ? `  — ${row.attribution}` : ""}` +
          `${row.license ? `  (${row.license})` : ""}`
      );
    }
  }
  console.log("");

  rule();
  console.log("COMPLETENESS CHECK SUMMARY");
  rule();
  console.log(
    `definitely lost:                       ${pad(tally.lost)}` +
      `  (${tally.lostRecoverable} recoverable via backfill, ${tally.lostPermanent} permanent)`
  );
  console.log(`missing (aiGenerated, no registry row): ${pad(tally.aiMissing)}  (all recoverable via backfill)`);
  console.log(`unknown, review manually:              ${pad(tally.unknown)}`);
  console.log(
    `deferred until \`space\` is re-keyed:    ${pad(tally.deferredLegacyPrefix)}` +
      `  (legacy \`library_packs/\` keys — NOT lost, see below)`
  );
  console.log(`  · orphaned-account content, lost:    ${pad(tally.orphanedLost)}  (unreachable — no users row)`);
  console.log(`  · orphaned-account content, ai-missing:${pad(tally.orphanedAiMissing)}  (unreachable — no users row)`);
  console.log(`  · orphaned-account content, unknown: ${pad(tally.orphanedUnknown)}  (unreachable — no users row)`);
  console.log(
    `  · orphaned-account content, deferred:${pad(tally.orphanedDeferredLegacyPrefix)}  (unreachable — no users row)`
  );
  console.log("");
  if (tally.deferredLegacyPrefix > 0 || tally.orphanedDeferredLegacyPrefix > 0) {
    console.log(
      "Those keys live under the retired `library_packs/` prefix. They are a" +
        "\nDELIBERATE, TEMPORARY exclusion — not a gap needing action — because an" +
        "\ninstalled copy of `space` points at the very same shared objects the admin's" +
        "\nown `space` category does, and recording them under `library_packs/` now" +
        "\nwould collide with the re-publish onto `library_modules/` the moment it" +
        "\nhappens (existing-wins credits merge would leave BOTH key sets forever —" +
        "\nthere is no delete path for `imageCredits` rows). This self-heals to zero:" +
        "\nonce `space` is re-published and reinstalled, re-run this backfill and these" +
        "\nkeys get recorded under their new `library_modules/…` keys."
    );
    console.log("");
  }
  console.log(
    `MODULE ARTIFACTS — missing credit:     ${pad(cmc.create)}` +
      `  (across ${plural(cmc.modulesWouldChange, "module", "modules")} of ${cmc.modules})`
  );
  console.log(`  · imageSearch, NO recoverable credit:${pad(cmc.imageSearchNoCredit)}  (permanent)`);
  console.log(`  · unknown, review manually:          ${pad(cmc.unknownNoType)}`);
  console.log(
    `  · legacy \`library_packs/\` keys:      ${pad(cmc.legacyPrefixSkipped)}` +
      `  (skipped by design — credited on re-publish)`
  );
  console.log(
    "\nA non-zero 'MODULE ARTIFACTS — missing credit' means a PUBLISHED module is" +
      "\nshipping an image with no travelling credit: every account that installs it" +
      "\ngets nothing for that image. Run this script with NO flags to see the plan," +
      "\nthen --apply. Unlike the per-account registry this is not self-healing — a" +
      "\nmodule's credits array is append-only, so fix it before the module spreads." +
      "\n\nA non-zero 'definitely lost' or 'missing (aiGenerated)' with credit still" +
      "\nrecoverable means the backfill has not been applied yet (or has not been" +
      "\nre-run since new content was added). A non-zero 'definitely lost' WITHOUT" +
      "\nrecoverable credit is a permanent phase-29-era hole — information, not a bug" +
      "\nto chase. 'aiGenerated' has no permanent variant: it never carries the" +
      "\nlicence/attribution fields that could be absent." +
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
  legacyPrefixSkipped: 0,
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
// `legacyPrefixSkipped` exists on BOTH the account-registry counts and the
// module counts (fix pass 2 gave the account walk its own skip, mirroring the
// module-artifact one) — `?? 0` is defensive only, every caller now sets it.
const sum = (t) =>
  t.create + t.present + t.byDesignShared + t.byDesignUpload + t.imageSearchNoCredit +
  t.unknownNoType + (t.legacyPrefixSkipped ?? 0);
const verdict = (t) => (sum(t) === t.totalImages ? "✅ matches total scanned" : "❌ DOES NOT MATCH");
const mc = modulePlan.counts;

// Finding 5 (review-fix pass 2): the count below is unique (account, imageKey)
// PAIRS, not distinct images — an image installed on both accounts (e.g. the
// `space` module's 15 images) counts once per account, because that is the
// registry's own unit (`imageCredits` is keyed by (accountId, imageKey)). The
// old label "total unique images scanned" invited a reader to take the number
// as a distinct-image count, which it is not.
function reconcile(title, t) {
  console.log(title);
  console.log(`total unique (account, image) pairs scanned:  ${pad(t.totalImages)}`);
  console.log(`  would create a registry row:                ${pad(t.create)}`);
  console.log(`  skipped, registry row already present:      ${pad(t.present)}`);
  console.log(`  skipped by design (upload / symbolstix):    ${pad(t.byDesignUpload + t.byDesignShared)}`);
  console.log(`      · SymbolStix / shared-namespace key:    ${pad(t.byDesignShared)}`);
  console.log(`      · upload/symbolstix on a creditable key:${pad(t.byDesignUpload)}`);
  console.log(`  imageSearch with NO recoverable credit:     ${pad(t.imageSearchNoCredit)}`);
  console.log(`  no type recorded (unknown, review manually):${pad(t.unknownNoType)}`);
  console.log(
    `  legacy \`library_packs/\` key, skipped:      ${pad(t.legacyPrefixSkipped)}` +
      `  (deferred until \`space\` is re-keyed — see below)`
  );
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
console.log(
  "   (each account/table pair above is its own paginated read, not one snapshot — if this" +
    "\n    total disagrees with a live `npx convex data` count, re-run before treating it as a" +
    "\n    bug: content written concurrently with this run can be seen zero or twice across a page boundary.)"
);
console.log("");

reconcile(
  `ACCOUNT REGISTRY — ${totals.totalPlacements} image placements across ${plural(liveAccounts.length, "live account", "live accounts")}`,
  totals
);
if (totals.legacyPrefixSkipped > 0) {
  console.log(
    "  Those keys live under the retired `library_packs/` prefix. An installed" +
      "\n  copy of `space` points at the very same shared R2 objects the admin's own" +
      "\n  `space` category does, so an account with `space` installed hits these" +
      "\n  during this scan too. Recording them now would be unrecoverable the same" +
      "\n  way it would be for the module artifact: once `space` is re-published onto" +
      "\n  `library_modules/` and reinstalled, `writeInstalledModuleCredits` would" +
      "\n  insert a SECOND row under the new key, `getAccountImageCredits` returns" +
      "\n  both, and after `library_packs/` is deleted one renders as a 404" +
      "\n  placeholder — permanently, since there is no delete path for `imageCredits`" +
      "\n  rows. Skipping creates only a TEMPORARY gap that self-heals: re-run this" +
      "\n  backfill after `space` is re-published and reinstalled, and these get" +
      "\n  recorded under their new `library_modules/…` keys.\n"
  );
}

if (orphanedAccounts.length > 0) {
  reconcile(
    `⚠️  ORPHANED CONTENT — ${orphanTotals.totalPlacements} image placements across ` +
      `${plural(orphanedAccounts.length, "account id", "account ids")} with no \`users\` row.\n` +
      `    Scanned and reported; NOTHING is written for these, even with --apply.`,
    orphanTotals
  );
}

console.log(`PUBLISHED MODULES — ${plural(mc.modules, "module", "modules")}`);
// Same unit note as reconcile() above: unique (module, imageKey) pairs — an
// image reused across two modules counts once per module.
console.log(`total unique (module, image) pairs scanned:   ${pad(mc.totalImages)}`);
console.log(`  would add a credit to the artifact:         ${pad(mc.create)}  (across ${plural(mc.modulesWouldChange, "module", "modules")})`);
console.log(`  skipped, credit already on the artifact:    ${pad(mc.present)}`);
console.log(`  skipped by design (upload / symbolstix):    ${pad(mc.byDesignUpload + mc.byDesignShared)}`);
console.log(`  imageSearch with NO recoverable credit:     ${pad(mc.imageSearchNoCredit)}`);
console.log(`  no type recorded (unknown, review manually):${pad(mc.unknownNoType)}`);
console.log(`  legacy \`library_packs/\` key, skipped:      ${pad(mc.legacyPrefixSkipped)}  (credited on re-publish — see below)`);
console.log(`                                              ${"─".repeat(6)}`);
console.log(`  reconciles to:                              ${pad(sum(mc))}  ${verdict(mc)}`);
if (mc.legacyPrefixSkipped > 0) {
  console.log(
    "\n  Those keys live under the retired `library_packs/` prefix, which is" +
      "\n  scheduled for deletion once `space` is re-published onto `library_modules/`." +
      "\n  Crediting them NOW would be unrecoverable: `mergeModuleCredits` is" +
      "\n  existing-wins, so the dead keys would survive alongside the new ones and" +
      "\n  every installer would see each photo listed twice, one with a 404" +
      "\n  thumbnail. The credit is not lost — publish falls back to the source" +
      "\n  rows' own attribution, so the re-publish embeds it under the new keys."
  );
}

if (APPLY) {
  console.log("");
  console.log(`registry rows inserted:      ${pad(insertedTotal)}`);
  console.log(`module credits added:        ${pad(moduleCreditsAdded)}`);
}

console.log(
  DRY_RUN
    ? "\n✅ Dry run complete. Nothing written.\n" +
        "   Re-run with --apply to write — AFTER `npx convex export`, and preferably\n" +
        "   BEFORE re-publishing any content module (a module's credits cannot be\n" +
        "   upgraded by a later re-publish; publish does now fall back to the source\n" +
        "   rows' own attribution, so this is a nicety, not a correctness gate).\n" +
        "   Then re-export the committed artifacts (`node scripts/export-library-modules.mjs`,\n" +
        "   commit `convex/data/**`, `node scripts/verify-module-roundtrip.mjs`),\n" +
        "   then `--check` to confirm the registry matches reality."
    : "\n✅ Apply complete. Run with --check to confirm." +
        "\n\n⚠️  NOW RE-EXPORT THE COMMITTED ARTIFACTS — --apply patched" +
        "\n   `libraryModules.credits` in the LIVE table, and the committed" +
        "\n   disaster-recovery copies under `convex/data/` do not have those" +
        "\n   credits. Until you do this, verify-module-roundtrip.mjs reports drift" +
        "\n   and a restore would republish those modules with credits STRIPPED:" +
        "\n       node scripts/export-library-modules.mjs" +
        "\n       git add convex/data && git commit" +
        "\n       node scripts/verify-module-roundtrip.mjs      # must exit 0"
);
