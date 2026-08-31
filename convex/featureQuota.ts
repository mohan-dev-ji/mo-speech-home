import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
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

// ─── Dual meters: day + month (ADR-023) ──────────────────────────────────────
//
// THE `day` COLUMN IS A PERIOD KEY, not always a day. A daily row stores
// 'YYYY-MM-DD'; a monthly row stores 'YYYY-MM'. The two shapes can never
// collide, so `by_user_and_feature_and_day` addresses both without a schema
// change and image search keeps using the single-meter functions above,
// untouched.
//
// The column name is the wart. Renaming it to `periodKey` would migrate a
// table image search is actively writing to, for cosmetics — not worth it.

function monthKey(): string {
  // YYYY-MM UTC — the month rolls over at UTC midnight on the 1st, matching
  // todayKey()'s convention. A subscriber who joins on the 28th gets the
  // month's allowance for three days and then a fresh one; billing-anniversary
  // alignment is deliberately not built (FEAT-008 §2).
  return new Date().toISOString().slice(0, 7);
}

async function findQuotaRow(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  feature: string,
  period: string
) {
  return await ctx.db
    .query("featureQuota")
    .withIndex("by_user_and_feature_and_day", (q) =>
      q.eq("userId", userId).eq("feature", feature).eq("day", period)
    )
    .unique();
}

/**
 * Remaining counts for BOTH meters. Feeds the AI tab's footer.
 * Returns null when unauthenticated, matching `getRemaining`.
 */
export const getRemainingDual = query({
  args: { feature: v.string(), dailyLimit: v.number(), monthlyLimit: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const dayRow = await findQuotaRow(ctx, identity.subject, args.feature, todayKey());
    const monthRow = await findQuotaRow(ctx, identity.subject, args.feature, monthKey());

    const dayUsed = dayRow?.count ?? 0;
    const monthUsed = monthRow?.count ?? 0;

    return {
      daily: {
        used: dayUsed,
        remaining: Math.max(0, args.dailyLimit - dayUsed),
        limit: args.dailyLimit,
      },
      monthly: {
        used: monthUsed,
        remaining: Math.max(0, args.monthlyLimit - monthUsed),
        limit: args.monthlyLimit,
      },
    };
  },
});

/**
 * Check BOTH meters, then increment BOTH — in one transaction, so a request
 * can never spend the month without spending the day or vice versa.
 *
 * Throws `QuotaExceeded:month` or `QuotaExceeded:day`. The prefix is
 * deliberate: the route's existing `.includes("QuotaExceeded")` test still
 * matches, so the two sides can deploy in either order, while the suffix lets
 * the caller pick the right copy. Monthly is reported first when both are
 * exhausted — the longer wait is the more useful thing to tell someone.
 */
export const checkAndIncrementDual = mutation({
  args: { feature: v.string(), dailyLimit: v.number(), monthlyLimit: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    // Read the period keys once — a call straddling UTC midnight must not
    // check one period and increment another.
    const day = todayKey();
    const month = monthKey();

    const dayRow = await findQuotaRow(ctx, userId, args.feature, day);
    const monthRow = await findQuotaRow(ctx, userId, args.feature, month);

    const dayUsed = dayRow?.count ?? 0;
    const monthUsed = monthRow?.count ?? 0;

    if (monthUsed >= args.monthlyLimit) throw new Error("QuotaExceeded:month");
    if (dayUsed >= args.dailyLimit) throw new Error("QuotaExceeded:day");

    if (dayRow) {
      await ctx.db.patch(dayRow._id, { count: dayUsed + 1 });
    } else {
      await ctx.db.insert("featureQuota", {
        userId,
        feature: args.feature,
        day,
        count: 1,
      });
    }

    if (monthRow) {
      await ctx.db.patch(monthRow._id, { count: monthUsed + 1 });
    } else {
      await ctx.db.insert("featureQuota", {
        userId,
        feature: args.feature,
        day: month,
        count: 1,
      });
    }

    return {
      dailyRemaining: args.dailyLimit - dayUsed - 1,
      monthlyRemaining: args.monthlyLimit - monthUsed - 1,
    };
  },
});

/**
 * Hand back one unit on BOTH meters after a failed or refused generation.
 *
 * `checkAndIncrementDual` reserves both before the provider is called, so a
 * failure the user did not cause has already spent one of each. Floors at 0
 * and never creates a row, exactly like `refundOne`, and is a compensating
 * action for one specific reservation — call it at most once per failure.
 */
export const refundOneDual = mutation({
  args: { feature: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    let refunded = false;
    for (const period of [todayKey(), monthKey()]) {
      const row = await findQuotaRow(ctx, userId, args.feature, period);
      if (!row || row.count <= 0) continue;
      await ctx.db.patch(row._id, { count: row.count - 1 });
      refunded = true;
    }
    return { refunded };
  },
});
