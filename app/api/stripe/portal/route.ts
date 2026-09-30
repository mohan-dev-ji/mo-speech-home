import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";
import { stripeErrorResponse } from "@/lib/stripeErrors";

export const dynamic = "force-dynamic";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

  const user = await convex.query(api.users.getUserByClerkId, {
    clerkUserId: userId,
    serverSecret: serverSecret(),
  });

  if (!user?.subscription.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe first." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return stripeErrorResponse("portal", err);
  }
}
