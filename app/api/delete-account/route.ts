import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get user from Convex to find Stripe customer ID
    const user = await convex.query(api.users.getUserByClerkId, { clerkUserId: userId });

    if (user?.subscription.stripeCustomerId) {
      // Cancel any active subscriptions before deleting the customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.subscription.stripeCustomerId,
        status: "active",
      });
      await Promise.all(
        subscriptions.data.map((sub) => stripe.subscriptions.cancel(sub.id))
      );

      // Delete the Stripe customer (removes payment methods, history etc.)
      await stripe.customers.del(user.subscription.stripeCustomerId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
