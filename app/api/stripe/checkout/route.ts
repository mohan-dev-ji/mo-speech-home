import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe, getPriceId, type PriceTier, type PricePlan } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tier, plan } = body as { tier: PriceTier; plan: PricePlan };

  if (!tier || !plan) {
    return NextResponse.json({ error: "tier and plan are required" }, { status: 400 });
  }

  const priceId = getPriceId(tier, plan);
  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/en/settings?success=true`,
    cancel_url: `${origin}/en/settings?cancelled=true`,
    metadata: {
      clerkUserId: userId,
      tier,
      plan,
    },
  });

  return NextResponse.json({ url: session.url });
}
