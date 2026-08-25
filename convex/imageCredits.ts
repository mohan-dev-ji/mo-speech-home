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
import { mutation, query } from "./_generated/server";
import { requireCallerAccountId, resolveCallerAccountId } from "./lib/account";

/** The only image sources with external provenance worth preserving. */
export const imageCreditSourceType = v.union(
  v.literal("imageSearch"),
  v.literal("aiGenerated"),
);

/** One registry row as returned to the client — no `_id`, no `accountId`. */
export type CreditRow = {
  imageKey: string;
  imageSourceType: "imageSearch" | "aiGenerated";
  imageTitle?: string;
  attribution?: string;
  license?: string;
  imageSourceUrl?: string;
  firstUsedFor?: string;
};

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
 * Every credit row for the caller's account, as an ARRAY — never an object
 * keyed by user-supplied or localised text (Hindi crashes serialisation).
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

    return rows
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
