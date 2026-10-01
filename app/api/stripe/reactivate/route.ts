import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";
import { requireBillingOwner } from "@/lib/billingOwner";
import { stripeErrorResponse } from "@/lib/stripeErrors";
import { syncSubscriptionQuietly } from "@/lib/subscriptionSync";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = await requireBillingOwner(getToken);
  if (denied) return denied;

  const user = await convex.query(api.users.getUserByClerkId, {
    clerkUserId: userId,
    serverSecret: serverSecret(),
  });
  const subscriptionId = user?.subscription.stripeSubscriptionId;
  if (!user || !subscriptionId) {
    return NextResponse.json({ error: "No subscription to reactivate" }, { status: 400 });
  }

  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
    await syncSubscriptionQuietly(user._id, subscriptionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return stripeErrorResponse("reactivate", err);
  }
}
