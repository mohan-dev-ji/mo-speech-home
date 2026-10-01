// Subscription tier — derived from plan, not stored directly in DB
export type SubscriptionTier = "free" | "pro" | "max";

// Stripe subscription lifecycle state — must match convex/schema.ts users.subscription.status
export type SubscriptionStatus = "free" | "active" | "expired" | "cancelled" | "past_due";

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
  pendingPlan: SubscriptionPlanId | null;   // a change booked for the next billing date
  pendingPlanAt: number | null;             // ms: when it takes over
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
    pendingPlan?: SubscriptionPlanId;
    pendingPlanAt?: number;
    customAccess?: {
      isActive: boolean;
      reason: string;
      grantedBy: string;
      grantedAt: number;
      expiresAt?: number;
    };
  };
  lastActiveAt: number;
  locale?: string;
  themeSlug?: string;
  // Per-language default voice: { langCode → ttsVoiceId }. Phase 8.4.
  voiceDefaults?: Record<string, string>;
  analyticsOptOut?: boolean;
  stateFlags?: {
    grid_size?: 'large' | 'medium' | 'small';
    symbol_label_visible?: boolean;
    symbol_text_size?: 'large' | 'medium' | 'small' | 'xs';
    reduce_motion?: boolean;
    core_dropdown_visible?: boolean;
  };
};
