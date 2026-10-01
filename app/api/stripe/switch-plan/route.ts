import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe, getPriceId, isPriceTier, isPricePlan } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";
import { requireBillingOwner } from "@/lib/billingOwner";
import { stripeErrorResponse } from "@/lib/stripeErrors";
import { classifyPlanChange } from "@/lib/planChange";
import { planIdFromPriceId } from "@/lib/subscriptionState";
import { upgradeNow, scheduleChangeAtPeriodEnd } from "@/lib/stripePlanChange";
import { syncSubscriptionQuietly } from "@/lib/subscriptionSync";
import type { SubscriptionPlanId } from "@/types";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = await requireBillingOwner(getToken);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tier, plan } = (body ?? {}) as { tier?: unknown; plan?: unknown };

  if (!isPriceTier(tier) || !isPricePlan(plan)) {
    return NextResponse.json({ error: "tier and plan are required" }, { status: 400 });
  }

  const user = await convex.query(api.users.getUserByClerkId, {
    clerkUserId: userId,
    serverSecret: serverSecret(),
  });
  const subscriptionId = user?.subscription.stripeSubscriptionId;
  if (!user || !subscriptionId) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  try {
    const priceId = getPriceId(tier, plan);
    const targetPlan: SubscriptionPlanId = `${tier}_${plan}`;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // The price Stripe is billing decides what counts as an upgrade. The
    // stored plan covers a subscription on an archived price.
    const currentPlan =
      planIdFromPriceId(subscription.items.data[0]?.price.id ?? "") ??
      user.subscription.plan ??
      null;
    if (!currentPlan) {
      console.error("[stripe:switch-plan] can't tell the current plan", { subscriptionId });
      return NextResponse.json({ error: "billing_misconfigured" }, { status: 500 });
    }

    const kind = classifyPlanChange(currentPlan, targetPlan);
    if (kind === "none") {
      return NextResponse.json({ success: true, outcome: "none" });
    }

    if (kind === "upgrade") {
      // Starts now, charged now. The plan only changes once the charge is paid.
      const result = await upgradeNow(subscription, priceId);
      await syncSubscriptionQuietly(user._id, subscriptionId);
      if (result.applied) {
        return NextResponse.json({ success: true, outcome: "upgraded" });
      }
      if (result.payUrl) {
        // The card was declined or needs authentication: Stripe's page takes it.
        return NextResponse.json({ url: result.payUrl });
      }
      return NextResponse.json({ error: "payment_problem" }, { status: 402 });
    }

    // A lower tier, or the other billing interval: booked for the end of the
    // period already paid for.
    const { effectiveAt } = await scheduleChangeAtPeriodEnd(
      subscription,
      priceId,
      plan === "yearly" ? "year" : "month",
    );
    await syncSubscriptionQuietly(user._id, subscriptionId);
    return NextResponse.json({ success: true, outcome: "scheduled", effectiveAt });
  } catch (err) {
    // Stripe may already have been changed before the failure, so store what
    // it says now: the panel must not show a state that is no longer true.
    await syncSubscriptionQuietly(user._id, subscriptionId);
    return stripeErrorResponse("switch-plan", err);
  }
}
