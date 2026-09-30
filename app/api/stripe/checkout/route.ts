import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe, getPriceId, isPriceTier, isPricePlan } from "@/lib/stripe";
import { stripeErrorResponse } from "@/lib/stripeErrors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Billing is owner-only (MOS-88): an invited carer must never reach it.
  // A per-request client, so the caller's token isn't shared across requests.
  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "Missing Convex token" }, { status: 401 });
  }
  const accessClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  accessClient.setAuth(token);
  const access = await accessClient.query(api.users.getMyAccess, {});
  if (access?.role === "collaborator") {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

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

  try {
    const priceId = getPriceId(tier, plan);
    const origin = new URL(request.url).origin;
    // ADR-025: Stripe Managed Payments (merchant of record). Off by default —
    // enable only once the live account is on the owner's Ltd. See ADR-025.
    const managedPayments = process.env.STRIPE_MANAGED_PAYMENTS === "true";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/en/settings?success=true`,
      cancel_url: `${origin}/en/settings?cancelled=true`,
      metadata: {
        clerkUserId: userId,
        tier,
        plan,
      },
      // Delayed methods (Bacs/SEPA) must not be offered until the webhook handles async payment; Managed Payments picks its own methods (ADR-025).
      ...(managedPayments ? { managed_payments: { enabled: true } } : { payment_method_types: ["card"] }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return stripeErrorResponse("checkout", err);
  }
}
