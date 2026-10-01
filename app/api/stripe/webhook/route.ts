import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { trackServer, flushAnalytics } from "@/lib/analytics-server";
import { serverSecret } from "@/lib/convexServer";
import { classifyPlanChange } from "@/lib/planChange";
import { planIdFromPriceId } from "@/lib/subscriptionState";
import { syncSubscription } from "@/lib/subscriptionSync";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerkUserId;
        console.log("[webhook] checkout.session.completed", { clerkUserId, mode: session.mode });
        if (!clerkUserId || session.mode !== "subscription") break;

        // Only a settled payment unlocks the plan. Anything else (e.g. an
        // "unpaid" delayed method) is skipped; the customer.subscription.*
        // events that follow carry the real state.
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
          console.log("[webhook] checkout not paid, skipping", { payment_status: session.payment_status });
          break;
        }

        const user = await convex.query(api.users.getUserByClerkId, {
          clerkUserId,
          serverSecret: serverSecret(),
        });
        console.log("[webhook] user lookup", { found: !!user, userId: user?._id });
        if (!user) break;

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price.id ?? "";
        const plan = planIdFromPriceId(priceId);
        console.log("[webhook] updating subscription", { userId: user._id, plan, priceId });

        // Idempotency: skip if already applied
        if (user.subscription.stripeSubscriptionId === sub.id && user.subscription.status === "active") {
          console.log("[webhook] already applied, skipping");
          break;
        }

        await convex.mutation(api.users.updateSubscription, {
          userId: user._id,
          status: "active",
          ...(plan ? { plan } : {}),
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          serverSecret: serverSecret(),
        });
        console.log("[webhook] subscription updated successfully");

        trackServer(user.clerkUserId, "subscribed", {
          plan,
          interval: plan?.endsWith("yearly") ? "yearly" : "monthly",
          amount: session.amount_total ?? 0,
          currency: session.currency ?? "gbp",
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: sub.customer as string,
          serverSecret: serverSecret(),
        });
        if (!user) break;

        // Stripe sends what changed in `event.data.previous_attributes`. The
        // old plan comes from there when the event carries the old price: the
        // switch-plan route stores the new plan before this event arrives, so
        // the stored plan can already be the new one. The stored plan is the
        // fallback when the event has no items or the price is unknown.
        const prev = (
          event.data as {
            previous_attributes?: {
              cancel_at_period_end?: boolean;
              items?: { data?: Array<{ price?: { id?: string } }> };
            };
          }
        ).previous_attributes;
        const prevPriceId = prev?.items?.data?.[0]?.price?.id;
        const oldPlan =
          (prevPriceId ? planIdFromPriceId(prevPriceId) : null) ?? user.subscription.plan;
        // Store what Stripe says now, not what this event carried: events can
        // arrive out of order, and a change booked for the next billing date
        // lives on the schedule, which the payload doesn't include. A booked
        // change or an unpaid upgrade leaves the plan where it is (MOS-93).
        const state = await syncSubscription(user._id, sub.id);
        const newPlan = state.plan;

        // Decode the diff into a meaningful analytics event.
        const wasReactivated =
          prev?.cancel_at_period_end === true && sub.cancel_at_period_end === false;
        const wasCancelled =
          prev?.cancel_at_period_end === false && sub.cancel_at_period_end === true;
        const trackedPlan = newPlan ?? oldPlan ?? null;

        if (wasReactivated) {
          trackServer(user.clerkUserId, "reactivated", { plan: trackedPlan });
        } else if (wasCancelled) {
          trackServer(user.clerkUserId, "cancelled", { plan: trackedPlan });
        } else if (newPlan && oldPlan && oldPlan !== newPlan) {
          const isUpgrade = classifyPlanChange(oldPlan, newPlan) === "upgrade";
          trackServer(user.clerkUserId, isUpgrade ? "upgraded" : "downgraded", {
            from_plan: oldPlan,
            to_plan: newPlan,
          });
        }
        // Otherwise: a booked change, billing-cycle anchor change, etc. — no event.
        break;
      }

      case "subscription_schedule.updated": {
        // Booking a change rewrites the schedule's phases, and that fires only
        // this event. Sync again so a read taken while the schedule was half
        // built can't leave the stored booking stale (MOS-93).
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        const subscriptionId = schedule.subscription ?? schedule.released_subscription;
        if (!subscriptionId) break;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: typeof schedule.customer === "string" ? schedule.customer : schedule.customer.id,
          serverSecret: serverSecret(),
        });
        if (!user) break;
        await syncSubscription(
          user._id,
          typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id,
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: sub.customer as string,
          serverSecret: serverSecret(),
        });
        if (!user) break;

        const prevPlan = user.subscription.plan;
        const wasNonPayment = user.subscription.status === "past_due";

        await convex.mutation(api.users.updateSubscription, {
          userId: user._id,
          status: "expired",
          pendingPlan: null,
          pendingPlanAt: null,
          serverSecret: serverSecret(),
        });

        trackServer(
          user.clerkUserId,
          wasNonPayment ? "expired" : "cancelled",
          {
            plan: prevPlan ?? null,
            days_since_subscribed: user.subscription.subscriptionEndsAt
              ? Math.floor((Date.now() - user._creationTime) / (24 * 60 * 60 * 1000))
              : null,
          }
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: invoice.customer as string,
          serverSecret: serverSecret(),
        });
        if (!user) break;

        // A failed renewal makes the subscription past due. A failed upgrade
        // charge doesn't: Stripe keeps the subscription active on the plan
        // already paid for (MOS-93). So store what the subscription says.
        if (user.subscription.stripeSubscriptionId) {
          await syncSubscription(user._id, user.subscription.stripeSubscriptionId);
        } else {
          await convex.mutation(api.users.updateSubscription, {
            userId: user._id,
            status: "past_due",
            serverSecret: serverSecret(),
          });
        }

        trackServer(user.clerkUserId, "payment_failed", {
          plan: user.subscription.plan ?? null,
          attempt_count: invoice.attempt_count ?? 1,
        });
        // TODO: Send payment failure email (e.g. via Resend or Nodemailer)
        break;
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    await flushAnalytics();
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  // Flush any queued analytics events before serverless cold-stop drops them.
  await flushAnalytics();
  return NextResponse.json({ received: true });
}
