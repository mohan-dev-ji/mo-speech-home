import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    subscription: v.object({
      // What they've paid for
      tier: v.union(
        v.literal("free"),
        v.literal("pro"),
        v.literal("max")
      ),
      // Stripe subscription lifecycle state
      status: v.union(
        v.literal("free"),
        v.literal("active"),
        v.literal("cancelled"),
        v.literal("past_due")
      ),
      // Access until this timestamp when cancelled (null = no end date)
      subscriptionEndsAt: v.optional(v.union(v.number(), v.null())),
      plan: v.optional(
        v.union(v.literal("monthly"), v.literal("yearly"))
      ),
      stripeCustomerId: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
    }),
    lastActiveAt: v.number(),
    // Note: _creationTime is auto-added by Convex — use instead of createdAt
  })
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_subscription_status", ["subscription.status"])
    .index("by_stripe_customer", ["subscription.stripeCustomerId"]),
});
