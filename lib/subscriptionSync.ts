import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { stripe } from "@/lib/stripe";
import { serverSecret } from "@/lib/convexServer";
import { subscriptionState, type SubscriptionState } from "@/lib/subscriptionState";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Read a subscription from Stripe and store what it says: status, plan, and
 * any change booked for the next billing date (MOS-93). The webhook and every
 * billing route call this, so there is one writer and one mapping. It reads
 * Stripe fresh rather than trusting an event payload: events can arrive out
 * of order, and the booked change lives on the schedule, not the subscription.
 */
export async function syncSubscription(
  userId: Id<"users">,
  subscriptionId: string,
): Promise<SubscriptionState> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["schedule"] });
  const schedule = sub.schedule && typeof sub.schedule !== "string" ? sub.schedule : null;
  const state = subscriptionState(sub, schedule);

  // The booked change has landed. Stripe refuses to cancel a subscription
  // while a schedule is attached, so let it go.
  if (state.scheduleIsSpent && schedule) {
    await stripe.subscriptionSchedules.release(schedule.id);
  }

  await convex.mutation(api.users.updateSubscription, {
    userId,
    status: state.status,
    ...(state.plan ? { plan: state.plan } : {}),
    ...(state.subscriptionEndsAt != null ? { subscriptionEndsAt: state.subscriptionEndsAt } : {}),
    pendingPlan: state.pendingPlan,
    pendingPlanAt: state.pendingPlanAt,
    serverSecret: serverSecret(),
  });
  return state;
}

/**
 * For routes: the Stripe change already succeeded, so a failed write must not
 * turn into an error for the customer. The webhook writes the same state.
 */
export async function syncSubscriptionQuietly(
  userId: Id<"users">,
  subscriptionId: string,
): Promise<void> {
  try {
    await syncSubscription(userId, subscriptionId);
  } catch (err) {
    console.error("[stripe] sync after a billing action failed; the webhook will catch up", err);
  }
}
