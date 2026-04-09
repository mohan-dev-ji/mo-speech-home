"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SubscriptionTier, SubscriptionStatus, SubscriptionPlanId } from "@/types";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Map tier to a default plan ID for admin overrides
const TIER_TO_PLAN: Record<Exclude<SubscriptionTier, "free">, SubscriptionPlanId> = {
  pro: "pro_monthly",
  max: "max_monthly",
};

export async function adminSetAccess(
  userId: string,
  tier: SubscriptionTier,
  status: SubscriptionStatus,
) {
  await convex.mutation(api.users.updateSubscription, {
    userId: userId as Id<"users">,
    status,
    plan: tier === "free" ? undefined : TIER_TO_PLAN[tier],
  });
}
