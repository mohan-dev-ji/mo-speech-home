import { query } from "../_generated/server";
import { requireCallerIsAdmin } from "../lib/account";
import { tierFromPlan } from "../users";

/**
 * Admin dashboard Overview KPIs — single query so the page makes one round
 * trip. Per the plan at ~/.claude/plans/i-just-completed-this-ancient-floyd.md
 * §4, this returns only what is computable from existing data today:
 *
 *   - total users
 *   - free / pro / max counts (derived from subscription.plan)
 *   - active in last 7 days (by lastActiveAt)
 *   - new signups in last 7 days (by _creationTime)
 *
 * Deferred (no data layer yet): MRR breakdown, scheduled/expiring soon
 * counts, translation gaps, custom-access activity. No "Active Trials"
 * card — this build has no free trial (see plan Context callout).
 *
 * The query intentionally `.collect()`s all users — a bounded surface at
 * current scale; swap to a denormalised counter if it grows past a few
 * thousand rows.
 */
export const getOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const users = await ctx.db.query("users").collect();

    let free = 0;
    let pro = 0;
    let max = 0;
    let active7d = 0;
    let new7d = 0;

    for (const user of users) {
      const tier = tierFromPlan(user.subscription.plan);
      if (tier === "pro") pro++;
      else if (tier === "max") max++;
      else free++;

      if (user.lastActiveAt >= sevenDaysAgo) active7d++;
      if (user._creationTime >= sevenDaysAgo) new7d++;
    }

    return {
      totalUsers: users.length,
      free,
      pro,
      max,
      active7d,
      new7d,
    };
  },
});
