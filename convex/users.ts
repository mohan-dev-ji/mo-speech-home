import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
 * Used by AppStateProvider to derive hasFullAccess, tier, etc.
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

    const { tier, status, subscriptionEndsAt, plan } = user.subscription;
    const now = Date.now();

    // Cancelled users retain access until period end
    const isCancelledButActive =
      status === "cancelled" &&
      subscriptionEndsAt != null &&
      subscriptionEndsAt > now;

    const hasFullAccess =
      tier !== "free" && (status === "active" || isCancelledButActive);

    return {
      tier,
      status,
      hasFullAccess,
      plan: plan ?? null,
      subscriptionEndsAt: subscriptionEndsAt ?? null,
    };
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new user record on first sign-in.
 * Called by AppStateProvider sync effect.
 */
export const createUser = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Guard: don't create duplicates
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      subscription: {
        tier: "free",
        status: "free",
      },
      lastActiveAt: Date.now(),
    });
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

    if (!user) return; // already gone
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
 */
export const updateSubscription = mutation({
  args: {
    userId: v.id("users"),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("max")),
    status: v.union(
      v.literal("free"),
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("past_due")
    ),
    plan: v.optional(v.union(v.literal("monthly"), v.literal("yearly"))),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionEndsAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { userId, ...subscriptionData } = args;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, {
      subscription: {
        ...user.subscription,
        ...subscriptionData,
      },
      lastActiveAt: Date.now(),
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
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const users = await ctx.db.query("users").order("desc").take(limit);
    return users;
  },
});
