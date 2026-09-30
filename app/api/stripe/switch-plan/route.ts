import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe, getPriceId, isPriceTier, isPricePlan } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";
import { requireBillingOwner } from "@/lib/billingOwner";
import { stripeErrorResponse } from "@/lib/stripeErrors";

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
  if (!user?.subscription.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  try {
    const priceId = getPriceId(tier, plan);
    const subscription = await stripe.subscriptions.retrieve(user.subscription.stripeSubscriptionId);
    const currentItemId = subscription.items.data[0]?.id;

    if (!currentItemId) {
      return NextResponse.json({ error: "No subscription item found" }, { status: 400 });
    }

    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      items: [{ id: currentItemId, price: priceId }],
      // Defer price change to next billing date — no immediate invoice.
      // New tier access is granted immediately via the subscription.updated webhook.
      proration_behavior: "none",
      // Switching tiers always reactivates a cancelling subscription.
      cancel_at_period_end: false,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return stripeErrorResponse("switch-plan", err);
  }
}
