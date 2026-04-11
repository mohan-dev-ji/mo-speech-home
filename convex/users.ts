import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the subscription tier from the plan field.
 * Tier is never stored — always computed so it can't drift out of sync.
 */
export function tierFromPlan(
  plan: string | undefined
): "free" | "pro" | "max" {
  if (plan?.startsWith("pro")) return "pro";
  if (plan?.startsWith("max")) return "max";
  return "free";
}

// ─── Client-side queries (JWT-verified via ctx.auth) ──────────────────────────

/**
 * Get the currently authenticated user.
 * Identity comes from Clerk JWT — no clerkUserId arg needed.
 * Returns null if not authenticated or user not yet created.
 */
export const getMyUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .first();
  },
});

/**
 * Returns subscription access info for the current user.
 * Used by the useSubscription hook — derives tier from plan, never reads stored tier.
 */
export const getMyAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .first();

    if (!user) return null;

    const { status, subscriptionEndsAt, plan, trialEndsAt, customAccess } =
      user.subscription;
    const now = Date.now();

    const tier = tierFromPlan(plan);

    // Cancelled users retain access until period end
    const isCancelledButActive =
      status === "cancelled" &&
      subscriptionEndsAt != null &&
      subscriptionEndsAt > now;

    const hasFullAccess =
      tier !== "free" && (status === "active" || isCancelledButActive);

    const isTrialing = status === "trial";
    const trialDaysRemaining =
      isTrialing && trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt - now) / 86_400_000))
        : 0;

    return {
      tier,
      status,
      hasFullAccess,
      isTrialing,
      trialDaysRemaining,
      plan: plan ?? null,
      subscriptionEndsAt: subscriptionEndsAt ?? null,
      customAccess: customAccess ?? null,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new user record on first sign-in.
 * Called by the Clerk webhook or AppStateProvider sync effect.
 * Starts user on a 14-day trial.
 */
export const createUser = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    referredBy: v.optional(v.string()), // affiliate code from signup cookie
  },
  handler: async (ctx, args) => {
    // Guard: don't create duplicates
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (existing) return existing._id;

    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days

    const userId = await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      referredBy: args.referredBy,
      subscription: {
        status: "trial",
        trialEndsAt,
      },
      lastActiveAt: Date.now(),
    });

    // Activate any pending invite for this email address.
    // The inviting account owner's record is already in accountMembers with status "pending".
    const pendingInvite = await ctx.db
      .query("accountMembers")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", args.email).eq("status", "pending")
      )
      .first();

    if (pendingInvite) {
      await ctx.db.patch(pendingInvite._id, {
        clerkUserId: args.clerkUserId,
        status: "active",
        joinedAt: Date.now(),
      });
    }

    return userId;
  },
});

/**
 * Update last active timestamp on return visits.
 */
export const updateLastActive = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { lastActiveAt: Date.now() });
  },
});

/**
 * Delete the current user's own record.
 * Called client-side during account deletion — Stripe and Clerk deletion
 * are handled separately (API route for Stripe, user.delete() for Clerk).
 */
export const deleteMyUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();

    if (!user) return;
    await ctx.db.delete(user._id);
  },
});

// ─── Server-side queries (called from API routes via ConvexHttpClient) ────────

/**
 * Look up a user by Clerk ID.
 * Used in API routes (portal, webhook) with service key.
 */
export const getUserByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

/**
 * Look up a user by their Stripe customer ID.
 * Used in the Stripe webhook handler.
 */
export const getUserByStripeCustomerId = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("subscription.stripeCustomerId", args.stripeCustomerId)
      )
      .first();
  },
});

/**
 * Update subscription data from Stripe webhook events.
 * Called server-side via ConvexHttpClient with deploy key.
 * Does NOT accept tier — tier is always derived from plan.
 */
export const updateSubscription = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("expired"),
      v.literal("cancelled"),
      v.literal("past_due")
    ),
    plan: v.optional(
      v.union(
        v.literal("pro_monthly"),
        v.literal("pro_yearly"),
        v.literal("max_monthly"),
        v.literal("max_yearly")
      )
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionEndsAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...fields } = args;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, {
      subscription: {
        ...user.subscription,
        ...fields,
      },
      lastActiveAt: Date.now(),
    });
  },
});

/**
 * Grant or revoke custom admin access (bypasses Stripe subscription check).
 */
export const setCustomAccess = mutation({
  args: {
    userId: v.id("users"),
    isActive: v.boolean(),
    reason: v.string(),
    grantedBy: v.string(), // admin clerkUserId
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...access } = args;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, {
      subscription: {
        ...user.subscription,
        customAccess: {
          isActive: access.isActive,
          reason: access.reason,
          grantedBy: access.grantedBy,
          grantedAt: Date.now(),
          expiresAt: access.expiresAt,
        },
      },
    });
  },
});

/**
 * Get a single user by Convex document ID.
 * Used in admin user detail page.
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * List all users for the admin dashboard.
 * Called server-side with deploy key.
 */
export const listAllUsers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("users").order("desc").take(limit);
  },
});
