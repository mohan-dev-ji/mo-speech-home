import type Stripe from "stripe";
import type { SubscriptionPlanId } from "@/types";

export type StoredStatus = "active" | "cancelled" | "past_due" | "expired";

// Map Stripe price ID to full plan ID (encodes tier + billing interval).
// An unknown price returns null and callers leave the stored plan untouched,
// so a misconfigured price can never silently grant or downgrade a tier.
export function planIdFromPriceId(priceId: string): SubscriptionPlanId | null {
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return "pro_monthly";
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return "pro_yearly";
  if (priceId === process.env.STRIPE_MAX_MONTHLY_PRICE_ID) return "max_monthly";
  if (priceId === process.env.STRIPE_MAX_YEARLY_PRICE_ID) return "max_yearly";
  console.error("[stripe] unknown price", priceId);
  return null;
}

// Map a Stripe subscription onto our stored status. Stripe's own status comes
// first: a subscription that is past due, unpaid or ended never unlocks the
// plan, whether or not it is also set to cancel (an ended one keeps
// `cancel_at_period_end` true, and must read as "expired" so the customer can
// start a new plan). Only a paid-up (active or trialing) subscription set to
// cancel is "cancelled", which stays usable until the period end
// (subscriptionEndsAt). Past due and unpaid are "past_due"; incomplete,
// canceled and paused are "expired".
export function statusFromSubscription(sub: Stripe.Subscription): StoredStatus {
  switch (sub.status) {
    case "active":
    case "trialing":
      return sub.cancel_at_period_end ? "cancelled" : "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
    case "canceled":
    case "paused":
      return "expired";
  }
}

export type SubscriptionState = {
  status: StoredStatus;
  plan: SubscriptionPlanId | null;
  subscriptionEndsAt: number | null;
  /** A change booked for the end of the current period (MOS-93), or null. */
  pendingPlan: SubscriptionPlanId | null;
  pendingPlanAt: number | null;
  /**
   * The booked change has landed: the schedule is on the last of its two or
   * more phases, so it has nothing left to change. Release it. A one-phase
   * schedule is not spent (it is a booking caught between its two Stripe
   * calls), and neither is a next phase whose price we don't recognise (a
   * wrong env var): releasing either would drop a change the customer was told
   * is booked, and they would keep paying the higher price.
   */
  scheduleIsSpent: boolean;
};

/**
 * What we store for a subscription, read from Stripe alone. The plan is the
 * price Stripe is billing **now**: an unpaid upgrade (`pending_update`) and a
 * booked change (a later schedule phase) don't move it.
 */
export function subscriptionState(
  sub: Stripe.Subscription,
  schedule: Stripe.SubscriptionSchedule | null,
): SubscriptionState {
  const item = sub.items.data[0];
  const plan = planIdFromPriceId(item?.price.id ?? "");

  let pendingPlan: SubscriptionPlanId | null = null;
  let pendingPlanAt: number | null = null;
  let scheduleIsSpent = false;
  const current = schedule?.status === "active" ? schedule.current_phase : null;
  if (schedule && current) {
    const next = schedule.phases.find((phase) => phase.start_date >= current.end_date);
    const nextPrice = next?.items[0]?.price;
    const nextPlan = nextPrice
      ? planIdFromPriceId(typeof nextPrice === "string" ? nextPrice : nextPrice.id)
      : null;
    if (next && nextPlan && nextPlan !== plan) {
      pendingPlan = nextPlan;
      pendingPlanAt = next.start_date * 1000;
    }
    scheduleIsSpent = schedule.phases.length >= 2 && !next;
  }

  return {
    status: statusFromSubscription(sub),
    plan,
    subscriptionEndsAt: sub.cancel_at_period_end
      ? (sub.cancel_at ?? item?.current_period_end ?? 0) * 1000
      : null,
    pendingPlan,
    pendingPlanAt,
    scheduleIsSpent,
  };
}
