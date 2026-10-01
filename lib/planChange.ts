import type { SubscriptionPlanId } from "@/types";

/**
 * The rule for a plan switch (MOS-93). Pure, so the server route and the
 * billing panel agree on what a click will do.
 */
export type PlanChangeKind = "none" | "upgrade" | "deferred";

const tierRank = (plan: SubscriptionPlanId): number => (plan.startsWith("max") ? 2 : 1);

/**
 * - "upgrade": a higher tier, on either billing interval. Starts now, and the
 *   difference is charged now.
 * - "deferred": a lower tier, or the same tier on the other interval. Starts
 *   at the end of the period already paid for.
 * - "none": the same plan.
 */
export function classifyPlanChange(
  current: SubscriptionPlanId,
  target: SubscriptionPlanId,
): PlanChangeKind {
  if (current === target) return "none";
  return tierRank(target) > tierRank(current) ? "upgrade" : "deferred";
}
