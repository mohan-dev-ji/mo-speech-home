/**
 * Image-credit registry (Phase 31) — read/write layer for `imageCredits`.
 *
 * Credit is stored once per R2 object key, not once per placement. Every save
 * path that puts an image in R2 calls `recordImageCredit`; the mutation dedupes
 * on `(accountId, imageKey)` so re-saving the same image is free and the write
 * is idempotent.
 *
 * Only `imageSearch` and `aiGenerated` are recordable — the validator has no
 * `upload` or `symbolstix` member, so the exclusion is enforced by the type
 * rather than by a runtime check. See the table's doc comment in
 * `convex/schema.ts` for why.
 */

import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCallerAccountId, resolveCallerAccountId } from "./lib/account";
import {
  coverRef,
  listRefs,
  phraseRefs,
  sentenceRefs,
  symbolRefs,
  type ImageRef,
} from "./lib/imageCreditRefs";
import type { CreditRow } from "./schema";

/** The only image sources with external provenance worth preserving. */
export const imageCreditSourceType = v.union(
  v.literal("imageSearch"),
  v.literal("aiGenerated"),
);

/**
 * One registry row as returned to the client — no `_id`, no `accountId`.
 * Re-exported from `./schema` (review fix, 2026-08-25): this file is a Convex
 * FUNCTION module, so a shared type file (`convex/data/_shared/types.ts`)
 * importing `CreditRow` from here was importing a type-only reference through
 * a module that also defines mutations/queries. The definition now lives
 * beside the validator it mirrors (`imageCreditFields` in `schema.ts`); this
 * re-export keeps existing call sites (`convex/lib/moduleCredits.ts`, and
 * this file's own `getAccountImageCredits`) unchanged.
 */
export type { CreditRow };

/**
 * Record the credit for one R2 object key, once.
 *
 * Dedupes on `(accountId, imageKey)`: if a row already exists this SKIPS and
 * returns `null` — it does not update, and it does not throw. First record
 * wins. Most calls will hit that path, because a save path calls this on every
 * save of an image it may already have recorded.
 *
 * Callers treat this as fire-and-forget: a missing credit row is recoverable by
 * the backfill, a failed image save is not.
 */
export const recordImageCredit = mutation({
  args: {
    imageKey: v.string(),
    imageSourceType: imageCreditSourceType,
    imageTitle: v.optional(v.string()),
    attribution: v.optional(v.string()),
    license: v.optional(v.string()),
    imageSourceUrl: v.optional(v.string()),
    firstUsedFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);

    const existing = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) =>
        q.eq("accountId", accountId).eq("imageKey", args.imageKey)
      )
      .first();
    // Dedupe — first record wins. Never an update, never a throw.
    if (existing) return null;

    return await ctx.db.insert("imageCredits", {
      accountId,
      imageKey: args.imageKey,
      imageSourceType: args.imageSourceType,
      ...(args.imageTitle ? { imageTitle: args.imageTitle } : {}),
      ...(args.attribution ? { attribution: args.attribution } : {}),
      ...(args.license ? { license: args.license } : {}),
      ...(args.imageSourceUrl ? { imageSourceUrl: args.imageSourceUrl } : {}),
      ...(args.firstUsedFor ? { firstUsedFor: args.firstUsedFor } : {}),
    });
  },
});

/**
 * Most content documents the in-use walk will read before it gives up and
 * returns `null`. One query may read at most 16,384 docs / 8 MiB. Content docs
 * sample at 0.4 to 1.8 KB, and the largest account today has about 1,057
 * `profileSymbols`, so 6,000 leaves headroom on both limits.
 */
const IN_USE_WALK_BUDGET = 6_000;

/**
 * Every R2 key the account's content still references, or `null` once the walk
 * goes past `IN_USE_WALK_BUDGET` (the caller then filters nothing).
 *
 * Uses the same six tables and the same extractors as the backfill and the
 * completeness check (`./lib/imageCreditRefs`), so all three agree on what
 * "referenced" means. `accountImages` is deliberately NOT walked: owning an
 * image in My Images is not using it (ADR-024 §1).
 */
async function collectInUseImageKeys(
  ctx: QueryCtx,
  accountId: Id<"users">,
): Promise<Set<string> | null> {
  const keys = new Set<string>();
  let read = 0;
  const take = (refs: ImageRef[]) => {
    for (const ref of refs) keys.add(ref.imageKey);
    return ++read <= IN_USE_WALK_BUDGET;
  };

  for await (const row of ctx.db
    .query("profileSymbols")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))) {
    if (!take(symbolRefs(row))) return null;
  }
  for await (const row of ctx.db
    .query("profileLists")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))) {
    if (!take(listRefs(row))) return null;
  }
  for await (const row of ctx.db
    .query("profileSentences")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))) {
    if (!take(sentenceRefs(row))) return null;
  }
  for await (const row of ctx.db
    .query("profilePhrases")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))) {
    if (!take(phraseRefs(row))) return null;
  }
  for await (const row of ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))) {
    if (!take(coverRef(row, "profileCategories.imagePath"))) return null;
  }
  for await (const row of ctx.db
    .query("profileFolders")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))) {
    if (!take(coverRef(row, "profileFolders.imagePath"))) return null;
  }
  return keys;
}

/**
 * Every credit row for the caller's account whose image the account's content
 * still uses, as an ARRAY — never an object
 * keyed by user-supplied or localised text (Hindi crashes serialisation).
 *
 * FILTERED WHEN READ, NEVER DELETED (MOS-42). Rows outlive their images: an
 * uninstalled module or a replaced image leaves its credit behind, because
 * there is no delete path on this table by design ("over-crediting is never a
 * licence violation; silently dropping a credit is"). The registry means
 * images IN USE, so a row whose key nothing references any more is hidden
 * here rather than removed. If the image comes back (a reinstall or
 * re-adoption), its original row shows again unchanged. If the walk goes over
 * budget, every row is returned unfiltered: the fallback over-credits and
 * never hides a credit.
 *
 * Sorted stably by `firstUsedFor` then `imageKey`; `imageKey` is unique within
 * an account, so the order is fully determined. Returns `[]` for unauthenticated
 * callers, matching the read layer everywhere else in this codebase.
 */
export const getAccountImageCredits = query({
  args: {},
  handler: async (ctx): Promise<CreditRow[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    const rows = await ctx.db
      .query("imageCredits")
      .withIndex("by_account_and_key", (q) =>
        q.eq("accountId", resolved.accountId)
      )
      .collect();

    const inUse = await collectInUseImageKeys(ctx, resolved.accountId);
    if (!inUse) {
      console.warn(
        `getAccountImageCredits: account ${resolved.accountId} has over ${IN_USE_WALK_BUDGET} content docs; showing all ${rows.length} credits unfiltered`,
      );
    }

    return rows
      .filter((row) => !inUse || inUse.has(row.imageKey))
      .map((row) => ({
        imageKey: row.imageKey,
        imageSourceType: row.imageSourceType,
        ...(row.imageTitle ? { imageTitle: row.imageTitle } : {}),
        ...(row.attribution ? { attribution: row.attribution } : {}),
        ...(row.license ? { license: row.license } : {}),
        ...(row.imageSourceUrl ? { imageSourceUrl: row.imageSourceUrl } : {}),
        ...(row.firstUsedFor ? { firstUsedFor: row.firstUsedFor } : {}),
      }))
      .sort(
        (a, b) =>
          (a.firstUsedFor ?? "").localeCompare(b.firstUsedFor ?? "") ||
          a.imageKey.localeCompare(b.imageKey)
      );
  },
});
