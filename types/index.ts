// Subscription tier — derived from plan, not stored directly in DB
export type SubscriptionTier = "free" | "pro" | "max";

// Stripe subscription lifecycle state — must match convex/schema.ts users.subscription.status
export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled" | "past_due";

// Billing interval (used in pricing UI)
export type SubscriptionPlan = "monthly" | "yearly";

// Full plan ID — encodes tier + billing interval
export type SubscriptionPlanId =
  | "pro_monthly"
  | "pro_yearly"
  | "max_monthly"
  | "max_yearly";

// Derive tier from plan ID
export function deriveTier(plan?: string | null): SubscriptionTier {
  if (!plan) return "free";
  if (plan.startsWith("max")) return "max";
  if (plan.startsWith("pro")) return "pro";
  return "free";
}

export type UserSubscription = {
  tier: SubscriptionTier;   // derived client-side via deriveTier(plan)
  status: SubscriptionStatus;
  hasFullAccess: boolean;
  plan: SubscriptionPlanId | null;
  subscriptionEndsAt: number | null;
  loading: boolean;
};

// Convex user record shape (mirrors convex/schema.ts users table)
export type UserRecord = {
  _id: string;
  _creationTime: number;
  clerkUserId: string;
  email: string;
  name?: string;
  subscription: {
    status: SubscriptionStatus;
    plan?: SubscriptionPlanId;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionEndsAt?: number | null;
    trialEndsAt?: number | null;
  };
  lastActiveAt: number;
};
