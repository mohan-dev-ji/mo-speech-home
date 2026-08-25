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
 *                                   for the keys this module uses — falling
 *                                   back to the provenance on the published
 *                                   row itself when the registry has none —
 *                                   and REMAP them onto the promoted keys.
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
// Type-only, erased at build. `schema.ts` — never `imageCredits.ts`, which is a
// Convex FUNCTION module; see `convex/data/_shared/types.ts:22-30`.
import type { CreditRow } from "../schema";
import { collectSourceImageRefs } from "./personalAssetRefs";
import { mergeByKey, creditRowFromMergedImage } from "./imageCreditRefs";

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
 * "Which images does this module use?" is answered by `collectSourceImageRefs`
 * — a walk of the same tables `collectSourcePromotableKeys` uses to decide what
 * to copy into R2, filtered by the wider `isCreditableAssetKey` predicate
 * (phase-31 review, 2026-08-25). The two questions are different: an installed
 * copy's source rows already point at `library_modules/…` keys — nothing to
 * copy — but if that image is CC-licensed it still needs credit when
 * re-published. Using the promotable (copy) predicate here silently dropped
 * credit for exactly that case; see `isCreditableAssetKey` in
 * ./contentModuleDelete for the full rationale.
 *
 * TWO SOURCES OF CREDIT, IN PRIORITY ORDER (phase-31 whole-phase review,
 * Finding 1). Until that review this function read the `imageCredits` registry
 * and NOTHING ELSE: on a lookup miss it did `continue`, embedding no credit for
 * that image — even though `attribution` / `license` / `imageSourceUrl` were
 * sitting on the very `profileSymbols` / `items[]` / `slots[]` row being
 * published. Publish before the backfill had been applied and the installing
 * family got an empty Credits screen for a CC image whose photographer was
 * recorded three tables away. That made the correctness of the whole publish
 * path rest on an unenforced human precondition ("always `--apply` before you
 * ever re-publish") stated only in a script comment. So:
 *
 *   1. The registry row for the source key, if one exists. Still first: it is
 *      the phase-31 record, it can carry an `imageTitle` no placement has, and
 *      it is what a live save writes.
 *   2. FAILING THAT, the placement's own provenance, via
 *      `creditRowFromMergedImage` — the same rule the backfill and the standing
 *      completeness check apply, shared from ./imageCreditRefs so a licence
 *      decision cannot be made differently in three places.
 *
 * The fallback is filtered exactly as the registry is: only `imageSearch` and
 * `aiGenerated` are recordable, so a row whose provenance says `upload` or
 * `symbolstix` still produces NOTHING, and a THIN `imageSearch` placement (a
 * recordable type with no attribution, no licence and no source URL — phase-29
 * era) is refused too, matching the backfill's deliberate refusal to write one.
 * A thin credit carries no licence information, cannot be upgraded afterwards
 * (every downstream write is skip-first-wins), and would silence the one alarm
 * that reports the gap. See `creditRowFromMergedImage` for the full argument.
 *
 * The ordering constraint is now a performance nicety, not a correctness
 * requirement: applying the backfill first still means fewer per-key lookups
 * miss, but publishing without it no longer loses anything recoverable.
 *
 * `assetPathMap` is REQUIRED, not optional-with-a-default, so a caller cannot
 * silently publish source-keyed credits — and it is applied to the fallback
 * rows too, not just the registry ones. `undefined` is a legitimate value —
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
  const refs = await collectSourceImageRefs(ctx, source);
  if (refs.length === 0) return [];

  // Collapse placements onto their R2 key before looking anything up: the
  // registry's unit is the object, not the placement, and a symbol plus the
  // three talker slots that reuse it must produce ONE credit built from the
  // union of what those four rows remember.
  const merged = mergeByKey(refs);

  const byPromotedKey = new Map<string, CreditRow>();
  for (const image of merged) {
    const sourceKey = image.imageKey;
    // ── THE REMAP ── source key → promoted key. Unmapped keys pass through
    // (nothing was copied for them), matching `promoted()` in publish.ts.
    // Applied ONCE here so both the registry row and the fallback row are
    // stamped with it — a credit keyed to the admin's `accounts/…` source key
    // lands in the installer's registry looking perfectly correct and joins to
    // nothing.
    const promotedKey = assetPathMap?.[sourceKey] ?? sourceKey;
    // First wins, as in the registry. Checked before the lookup, which is safe
    // because the map is only ever written when a credit was actually found.
    if (byPromotedKey.has(promotedKey)) continue;

    const row = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) =>
        q.eq("accountId", accountId).eq("imageKey", sourceKey),
      )
      .first();
    if (row) {
      byPromotedKey.set(promotedKey, toCreditRow(promotedKey, row));
      continue;
    }

    // Registry miss — fall back to what the published row itself remembers.
    const fallback = creditRowFromMergedImage(image, promotedKey);
    if (fallback) byPromotedKey.set(promotedKey, fallback);
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
