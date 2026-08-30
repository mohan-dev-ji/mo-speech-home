import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function todayKey(): string {
  // YYYY-MM-DD UTC — quotas roll over at UTC midnight.
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the remaining count for the current user / feature / day, against
 * the limit the caller passes. Used by UI footers to show "X left today".
 * Limit lives at the call-site so each feature can tune independently and
 * change without a Convex deploy.
 */
export const getRemaining = query({
  args: { feature: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const row = await ctx.db
      .query("featureQuota")
      .withIndex("by_user_and_feature_and_day", (q) =>
        q.eq("userId", identity.subject)
          .eq("feature", args.feature)
          .eq("day", todayKey())
      )
      .unique();

    const used = row?.count ?? 0;
    return { used, remaining: Math.max(0, args.limit - used), limit: args.limit };
  },
});

/**
 * Atomically check the current count against `limit` and increment by 1.
 * Throws "QuotaExceeded" if the post-increment would exceed the limit so the
 * caller can return a clean 429.
 */
export const checkAndIncrement = mutation({
  args: { feature: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const day = todayKey();
    const row = await ctx.db
      .query("featureQuota")
      .withIndex("by_user_and_feature_and_day", (q) =>
        q.eq("userId", identity.subject)
          .eq("feature", args.feature)
          .eq("day", day)
      )
      .unique();

    const current = row?.count ?? 0;
    if (current >= args.limit) throw new Error("QuotaExceeded");

    const next = current + 1;
    if (row) {
      await ctx.db.patch(row._id, { count: next });
    } else {
      await ctx.db.insert("featureQuota", {
        userId: identity.subject,
        feature: args.feature,
        day,
        count: next,
      });
    }

    return { used: next, remaining: args.limit - next, limit: args.limit };
  },
});

/**
 * Give back one unit of today's quota (MOS-40).
 *
 * `checkAndIncrement` RESERVES before the provider is called, which is the
 * right shape — incrementing afterwards would let concurrent requests both
 * pass the check and exceed the limit. The cost of reserving is that a failed
 * attempt has already been charged, so the failure path has to hand it back.
 *
 * Before this existed, a Gemini refusal still cost a generation: a user on
 * 10/day could spend the entire allowance on a style that could never
 * succeed, which is arguably worse than the failure itself.
 *
 * Floors at 0 and never creates a row: refunding into a day with no usage
 * would be refunding something that was never spent. Callers must invoke it
 * at most once per failed reservation — it is a compensating action for a
 * specific increment, not an idempotent "set" — so it lives beside the
 * failure branch that owns that increment.
 */
export const refundOne = mutation({
  args: { feature: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const day = todayKey();
    const row = await ctx.db
      .query("featureQuota")
      .withIndex("by_user_and_feature_and_day", (q) =>
        q.eq("userId", identity.subject).eq("feature", args.feature).eq("day", day)
      )
      .unique();

    if (!row || row.count <= 0) return { count: row?.count ?? 0, refunded: false };

    const next = row.count - 1;
    await ctx.db.patch(row._id, { count: next });
    return { count: next, refunded: true };
  },
});
