import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

/**
 * The Stripe calls behind a plan switch (MOS-93). Every behaviour here was
 * checked in the sandbox on plain and Managed Payments subscriptions; see
 * docs/4-builds/plans/_done/phase-43-plan-switches-plan.md.
 */

/** Drop any booked plan change. The subscription itself is left as it is. */
export async function releaseScheduleIfAny(sub: Stripe.Subscription): Promise<void> {
  if (!sub.schedule) return;
  const id = typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id;
  await stripe.subscriptionSchedules.release(id);
}

export type UpgradeResult =
  | { applied: true }
  /** The charge didn't go through. `payUrl` is Stripe's page to pay or authenticate. */
  | { applied: false; payUrl: string | null };

/**
 * Move to a higher tier now and charge the prorated difference now. The price
 * only changes once that charge is paid: until then Stripe keeps the old price
 * and holds the change as a pending update for 23 hours.
 */
export async function upgradeNow(
  sub: Stripe.Subscription,
  priceId: string,
): Promise<UpgradeResult> {
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no item");

  // A booked downgrade or interval switch would still land after the upgrade.
  await releaseScheduleIfAny(sub);

  const updated = await stripe.subscriptions.update(sub.id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: "always_invoice",
    payment_behavior: "pending_if_incomplete",
    expand: ["latest_invoice"],
  });

  if (updated.pending_update) {
    const invoice = updated.latest_invoice;
    return {
      applied: false,
      payUrl: invoice && typeof invoice !== "string" ? invoice.hosted_invoice_url ?? null : null,
    };
  }

  // Upgrading a plan that was set to cancel keeps it going. Stripe won't take
  // this in the same call as a pending update, and it must not happen when the
  // charge failed.
  if (updated.cancel_at_period_end) {
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
  }
  return { applied: true };
}

/**
 * Book a change of price for the end of the period already paid for. Nothing
 * is charged and nothing changes until then. `billing_cycle_anchor:
 * "phase_start"` is what makes the new price bill in full at the switch:
 * without it a monthly → yearly change stretches the paid month into a year.
 */
export async function scheduleChangeAtPeriodEnd(
  sub: Stripe.Subscription,
  priceId: string,
  interval: "month" | "year",
): Promise<{ effectiveAt: number }> {
  await releaseScheduleIfAny(sub);
  // Stripe refuses cancellation changes once a schedule is attached, and
  // choosing a new plan means the customer is staying.
  if (sub.cancel_at_period_end) {
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
  }

  const schedule = await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
  const current = schedule.phases[0];
  try {
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: current.items.map((item) => ({
            price: typeof item.price === "string" ? item.price : item.price.id,
            quantity: item.quantity ?? 1,
          })),
          start_date: current.start_date,
          end_date: current.end_date,
        },
        {
          items: [{ price: priceId, quantity: 1 }],
          billing_cycle_anchor: "phase_start",
          proration_behavior: "none",
          duration: { interval, interval_count: 1 },
        },
      ],
    });
  } catch (err) {
    // Don't leave a one-phase schedule behind: it would block cancelling.
    await stripe.subscriptionSchedules.release(schedule.id).catch(() => undefined);
    throw err;
  }
  return { effectiveAt: current.end_date * 1000 };
}
