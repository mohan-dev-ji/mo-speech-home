/**
 * Image credits travelling with a published module (phase-31 §2).
 *
 * The `imageCredits` registry is PER-ACCOUNT and keyed by R2 object key. An
 * admin authors a module in their own account, so their account holds the
 * credit rows; a family that installs the module has never seen those images
 * and holds nothing. Without this file every installed module is unattributed
 * on the account that actually displays it.
 *
 * Two halves, one on each end of the chain:
 *
 *   `collectModuleCredits`        — publish: read the publishing account's rows
 *                                   for the keys this module uses, and REMAP
 *                                   them onto the promoted keys.
 *   `writeInstalledModuleCredits` — install: write those rows into the
 *                                   installing account's registry.
 *
 * THE REMAP IS THE WHOLE POINT. Publishing promotes assets: the objects are
 * copied from `accounts/<admin>/images/…` to
 * `library_modules/<tree>/<slug>/images/…`, and the installed content rows
 * reference the promoted key only. A credit embedded under the admin's source
 * key would land in the installer's registry looking perfectly correct and join
 * to nothing — a failure that is invisible in the UI and invisible in the data.
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { CreditRow } from "../imageCredits";
import { collectSourcePromotableKeys } from "./personalAssetRefs";

/** Project a stored registry row onto the wire shape, dropping absent fields
 * (`undefined` is not a Convex value) and stamping the caller's chosen key. */
function toCreditRow(
  imageKey: string,
  row: {
    imageSourceType: "imageSearch" | "aiGenerated";
    imageTitle?: string;
    attribution?: string;
    license?: string;
    imageSourceUrl?: string;
    firstUsedFor?: string;
  },
): CreditRow {
  return {
    imageKey,
    imageSourceType: row.imageSourceType,
    ...(row.imageTitle ? { imageTitle: row.imageTitle } : {}),
    ...(row.attribution ? { attribution: row.attribution } : {}),
    ...(row.license ? { license: row.license } : {}),
    ...(row.imageSourceUrl ? { imageSourceUrl: row.imageSourceUrl } : {}),
    ...(row.firstUsedFor ? { firstUsedFor: row.firstUsedFor } : {}),
  };
}

/**
 * The credit rows a publish should embed in the module artifact.
 *
 * "Which images does this module use?" is already answered by
 * `collectSourcePromotableKeys` — the same walk publish uses to decide what to
 * copy into R2 — so this looks those exact keys up in the publishing account's
 * registry rather than adding a second traversal that could drift from the
 * first. Audio keys come back from that walk too; they simply never match a
 * registry row (the registry is images only).
 *
 * `assetPathMap` is REQUIRED, not optional-with-a-default, so a caller cannot
 * silently publish source-keyed credits. `undefined` is a legitimate value —
 * "publish without promotion", R2 unconfigured — and then keys pass through
 * unchanged, exactly as `promoted()` in `contentModules/publish.ts` does.
 *
 * Returned sorted by key: the array lands in the git-export artifact, so its
 * order must be stable across publishes or every export churns the diff.
 */
export async function collectModuleCredits(
  ctx: QueryCtx,
  accountId: Id<"users">,
  source: {
    tree: "categories" | "lists" | "sentences" | "phrases";
    sourceId: string;
  },
  assetPathMap: Record<string, string> | undefined,
): Promise<CreditRow[]> {
  const sourceKeys = await collectSourcePromotableKeys(ctx, source);
  if (sourceKeys.length === 0) return [];

  const byPromotedKey = new Map<string, CreditRow>();
  for (const sourceKey of sourceKeys) {
    const row = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) =>
        q.eq("accountId", accountId).eq("imageKey", sourceKey),
      )
      .first();
    if (!row) continue;
    // ── THE REMAP ── source key → promoted key. Unmapped keys pass through
    // (nothing was copied for them), matching `promoted()` in publish.ts.
    const promotedKey = assetPathMap?.[sourceKey] ?? sourceKey;
    if (byPromotedKey.has(promotedKey)) continue; // first wins, as in the registry
    byPromotedKey.set(promotedKey, toCreditRow(promotedKey, row));
  }

  return [...byPromotedKey.values()].sort((a, b) =>
    a.imageKey.localeCompare(b.imageKey),
  );
}

/**
 * Write a module's travelling credits into the INSTALLING account's registry.
 *
 * Same dedupe rule as `recordImageCredit`: one row per `(accountId, imageKey)`,
 * on collision SKIP — first record wins, never a patch, never a throw. Two
 * accounts installing the same module each get their own rows; one account
 * installing two modules that share an image keeps the first.
 *
 * Written directly via `ctx.db` rather than through `recordImageCredit`, which
 * is caller-scoped (`requireCallerAccountId`) and would throw here: install
 * also runs from `seedDefaultAccount`, an internal mutation with no caller
 * identity at all.
 *
 * Returns how many rows were inserted (callers may ignore it; it exists so a
 * backfill or a live check can report progress).
 */
export async function writeInstalledModuleCredits(
  ctx: MutationCtx,
  accountId: Id<"users">,
  credits: readonly CreditRow[] | undefined,
): Promise<number> {
  if (!credits || credits.length === 0) return 0;

  let inserted = 0;
  const seen = new Set<string>();
  for (const credit of credits) {
    // Guard against a duplicate key inside the artifact itself before touching
    // the db — a malformed or hand-edited module JSON must not double-insert.
    if (seen.has(credit.imageKey)) continue;
    seen.add(credit.imageKey);

    const existing = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) =>
        q.eq("accountId", accountId).eq("imageKey", credit.imageKey),
      )
      .first();
    if (existing) continue; // first record wins

    await ctx.db.insert("imageCredits", {
      accountId,
      ...toCreditRow(credit.imageKey, credit),
    });
    inserted++;
  }
  return inserted;
}
