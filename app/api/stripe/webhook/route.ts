import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type Stripe from "stripe";
import type { SubscriptionPlanId } from "@/types";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Map Stripe price ID to full plan ID (encodes tier + billing interval)
function planIdFromPriceId(priceId: string): SubscriptionPlanId {
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return "pro_monthly";
  if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return "pro_yearly";
  if (priceId === process.env.STRIPE_MAX_MONTHLY_PRICE_ID) return "max_monthly";
  if (priceId === process.env.STRIPE_MAX_YEARLY_PRICE_ID) return "max_yearly";
  // Fallback — treat unknown price as pro_monthly; operator should check Stripe config
  return "pro_monthly";
}

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

        const user = await convex.query(api.users.getUserByClerkId, { clerkUserId });
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
          plan,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
        });
        console.log("[webhook] subscription updated successfully");
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: sub.customer as string,
        });
        if (!user) break;

        const priceId = sub.items.data[0]?.price.id ?? "";
        const status = sub.cancel_at_period_end ? "cancelled"
          : sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : "active";

        await convex.mutation(api.users.updateSubscription, {
          userId: user._id,
          status,
          plan: planIdFromPriceId(priceId),
          subscriptionEndsAt: sub.cancel_at_period_end
            ? (sub.cancel_at ?? sub.items.data[0]?.current_period_end ?? 0) * 1000
            : undefined,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: sub.customer as string,
        });
        if (!user) break;

        await convex.mutation(api.users.updateSubscription, {
          userId: user._id,
          status: "expired",
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const user = await convex.query(api.users.getUserByStripeCustomerId, {
          stripeCustomerId: invoice.customer as string,
        });
        if (!user) break;

        await convex.mutation(api.users.updateSubscription, {
          userId: user._id,
          status: "past_due",
        });
        // TODO: Send payment failure email (e.g. via Resend or Nodemailer)
        break;
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
