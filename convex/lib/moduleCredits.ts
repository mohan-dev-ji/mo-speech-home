/**
 * Image credits travelling with a published module (phase-31 §2).
 *
 * The `imageCredits` registry is PER-ACCOUNT and keyed by R2 object key. An
 * admin authors a module in their own account, so their account holds the
 * credit rows; a family that installs the module has never seen those images
 * and holds nothing. Without this file every installed module is unattributed
 * on the account that actually displays it.
 *
 * Three pieces:
 *
 *   `collectModuleCredits`        — publish: read the publishing account's rows
 *                                   for the keys this module uses, and REMAP
 *                                   them onto the promoted keys.
 *   `mergeModuleCredits`          — publish: combine a freshly-collected credit
 *                                   set with whatever a re-published module
 *                                   already carried, by `imageKey`, so a
 *                                   partial re-publish can never wipe a
 *                                   licence obligation off a key it didn't
 *                                   happen to touch.
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
import { collectSourceCreditableKeys } from "./personalAssetRefs";

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
 * "Which images does this module use?" is answered by
 * `collectSourceCreditableKeys` — a walk of the same tables
 * `collectSourcePromotableKeys` uses to decide what to copy into R2, but with
 * the wider `isCreditableAssetKey` predicate (phase-31 review, 2026-08-25).
 * The two questions are different: an installed copy's source rows already
 * point at `library_modules/…` keys — nothing to copy — but if that image is
 * CC-licensed it still needs credit when re-published. Using the promotable
 * (copy) predicate here silently dropped credit for exactly that case; see
 * `isCreditableAssetKey` in ./contentModuleDelete for the full rationale.
 * Audio keys come back from the walk too; they simply never match a registry
 * row (the registry is images only).
 *
 * `assetPathMap` is REQUIRED, not optional-with-a-default, so a caller cannot
 * silently publish source-keyed credits. `undefined` is a legitimate value —
 * "publish without promotion", R2 unconfigured — and then keys pass through
 * unchanged, exactly as `promoted()` in `contentModules/publish.ts` does. A
 * `library_modules/…` source key is never in `assetPathMap` either (nothing
 * was copied for it), so it also passes through unchanged — which is correct,
 * because it is already in its final published form.
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
  const sourceKeys = await collectSourceCreditableKeys(ctx, source);
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
 * Combine a freshly-collected credit set with whatever a module already
 * carried, keyed by `imageKey`, EXISTING wins on collision (review fix,
 * 2026-08-25).
 *
 * A partial re-publish only re-collects credits for the keys the *current*
 * source still points at. If an admin installs their own published module —
 * whose items now hold `library_modules/…` keys — adds ONE new image, and
 * re-publishes, `collectModuleCredits` returns a set that may be missing
 * entries for images that were always there (e.g. the registry row for one of
 * them was never written, or hasn't been backfilled yet). Replacing the
 * module's `credits` array wholesale with that shorter set would silently
 * strip attribution off every image the collection pass missed — an
 * unrecoverable loss for a CC-licensed image whose photographer/licence text
 * lives nowhere else.
 *
 * So: keep every credit the module already had, and only ADD credits for keys
 * not already present. This is the same "first wins" rule the registry itself
 * uses on collision (`recordImageCredit`, convex/imageCredits.ts:58-67, and
 * `writeInstalledModuleCredits` above) — here "first" means "already on the
 * module," because that row survived every prior publish and a fresher lookup
 * is not grounds to distrust it. A stale extra credit surviving in the merged
 * array (the source image was removed from the module but its credit row
 * remains) is cosmetic; losing one is not.
 *
 * Returns `undefined` (never `[]`) when the merge is empty, matching
 * `collectModuleCredits`'s "absent, not empty-array" convention — so a patch
 * that finds nothing to merge omits the `credits` key entirely rather than
 * writing `[]` over `undefined`.
 */
export function mergeModuleCredits(
  existing: readonly CreditRow[] | undefined,
  incoming: readonly CreditRow[],
): CreditRow[] | undefined {
  if (!existing || existing.length === 0) {
    return incoming.length
      ? [...incoming].sort((a, b) => a.imageKey.localeCompare(b.imageKey))
      : undefined;
  }

  const byKey = new Map<string, CreditRow>();
  for (const credit of existing) byKey.set(credit.imageKey, credit); // existing wins
  for (const credit of incoming) {
    if (!byKey.has(credit.imageKey)) byKey.set(credit.imageKey, credit);
  }

  return [...byKey.values()].sort((a, b) => a.imageKey.localeCompare(b.imageKey));
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
