import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await convex.query(api.users.getUserByClerkId, { clerkUserId: userId });
  if (!user?.subscription.stripeSubscriptionId) {
    return NextResponse.json({ error: "No subscription to reactivate" }, { status: 400 });
  }

  await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return NextResponse.json({ success: true });
}
