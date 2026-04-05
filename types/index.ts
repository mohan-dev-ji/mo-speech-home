// Subscription tier — what the user has paid for
export type SubscriptionTier = "free" | "pro" | "business";

// Stripe subscription lifecycle state
export type SubscriptionStatus = "free" | "active" | "cancelled" | "past_due";

export type SubscriptionPlan = "monthly" | "yearly";

export type UserSubscription = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  hasFullAccess: boolean;
  plan: SubscriptionPlan | null;
  subscriptionEndsAt: number | null;
  loading: boolean;
};

// Convex user record shape (mirrors convex/schema.ts)
export type UserRecord = {
  _id: string;
  _creationTime: number;
  clerkUserId: string;
  email: string;
  name?: string;
  subscription: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    subscriptionEndsAt?: number | null;
    plan?: SubscriptionPlan;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  lastActiveAt: number;
};
