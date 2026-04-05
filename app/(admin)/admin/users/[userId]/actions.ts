"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SubscriptionTier, SubscriptionStatus } from "@/types";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function adminSetAccess(
  userId: string,
  tier: SubscriptionTier,
  status: SubscriptionStatus,
) {
  await convex.mutation(api.users.updateSubscription, {
    userId: userId as Id<"users">,
    tier,
    status,
    plan: null,
    subscriptionEndsAt: null,
  });
}
