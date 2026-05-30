import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireCallerIsAdmin } from "./lib/account";
import { isCustomAccessEffective } from "./lib/access";

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

    const planTier = tierFromPlan(plan);

    // Cancelled users retain access until period end
    const isCancelledButActive =
      status === "cancelled" &&
      subscriptionEndsAt != null &&
      subscriptionEndsAt > now;

    // Custom-access policy (set by admin decision, recorded in the Phase 7
    // plan): an admin grant is always Max-equivalent. The granted user's
    // tier lifts to "max" for the purposes of UI gating — every Pro and
    // Max feature unlocks. Mirrors what the Max-only API routes already
    // do (image-search, AI imagen, image-search proxy), which OR
    // `customAccess.isActive` with their Max gate.
    //
    // Effectiveness check uses the shared `isCustomAccessEffective` helper
    // (convex/lib/access.ts), which folds in the expiry timestamp — so a
    // grant stops unlocking features the second its expiry passes, even
    // before the daily `expireStaleCustomAccessGrants` cron writes the
    // audit entry.
    const customAccessActive = isCustomAccessEffective(customAccess);
    const tier: "free" | "pro" | "max" = customAccessActive ? "max" : planTier;

    const hasFullAccess =
      customAccessActive ||
      (planTier !== "free" && (status === "active" || isCancelledButActive));

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
 * Called by AppStateProvider sync effect (this build has no Clerk webhook).
 *
 * Returns `{ userId, wasCreated }` so the caller can distinguish first-sign-in
 * from a returning visit. The `wasCreated` flag drives the one-shot
 * `signed_up` analytics event in AppStateProvider — see plan §3.1 + §5.
 */
export const createUser = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    referredBy: v.optional(v.string()), // affiliate code from signup cookie
    locale: v.optional(v.string()),     // 'en' | 'hi' — set from /start or VoiceModal
  },
  handler: async (ctx, args) => {
    // Guard: don't create duplicates
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (existing) return { userId: existing._id, wasCreated: false };

    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days

    const userId = await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      referredBy: args.referredBy,
      locale: args.locale,
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

    return { userId, wasCreated: true };
  },
});

/**
 * Update the current user's analytics opt-out preference.
 * Called from the Settings PrivacyModal. The client also calls
 * `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()` immediately so
 * the change is instant; this mutation persists the choice across devices.
 */
export const setAnalyticsOptOut = mutation({
  args: { optOut: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { analyticsOptOut: args.optOut });
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
 * Grant custom admin access to a user — bypasses Stripe subscription checks
 * for the duration of the grant. Writes the active grant to
 * `subscription.customAccess` and appends a `"granted"` entry to
 * `customAccessHistory` for audit purposes.
 *
 * Phase 7 admin dashboard — see plan at
 * ~/.claude/plans/i-just-completed-this-ancient-floyd.md §3.2 and the MVP
 * pattern at /Users/mohanveraitch/Projects/Mo_Speech/_code/mo-speech-mvp-2.0/convex/admin.ts.
 *
 * Caller must be a Clerk admin. The performing admin's clerkUserId is
 * derived from `requireCallerIsAdmin`, not taken as an arg.
 */
export const grantCustomAccess = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
    expiresAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ code: "USER_NOT_FOUND" });

    const now = Date.now();
    const historyEntry = {
      action: "granted" as const,
      reason: args.reason,
      performedBy: clerkUserId,
      performedAt: now,
      ...(args.expiresAt !== undefined && { expiresAt: args.expiresAt }),
      ...(args.notes !== undefined && { notes: args.notes }),
    };

    await ctx.db.patch(args.userId, {
      subscription: {
        ...target.subscription,
        customAccess: {
          isActive: true,
          reason: args.reason,
          grantedBy: clerkUserId,
          grantedAt: now,
          ...(args.expiresAt !== undefined && { expiresAt: args.expiresAt }),
        },
      },
      customAccessHistory: [...(target.customAccessHistory ?? []), historyEntry],
    });
  },
});

/**
 * Revoke an active custom access grant. Clears `subscription.customAccess`
 * and appends a `"revoked"` entry to `customAccessHistory`. No-op if the
 * user has no active grant (returns silently rather than throwing —
 * convenient for the UI's idempotent "revoke" button).
 */
export const revokeCustomAccess = mutation({
  args: {
    userId: v.id("users"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError({ code: "USER_NOT_FOUND" });
    if (!target.subscription.customAccess) return;

    const now = Date.now();
    const historyEntry = {
      action: "revoked" as const,
      reason: target.subscription.customAccess.reason,
      performedBy: clerkUserId,
      performedAt: now,
      ...(args.notes !== undefined && { notes: args.notes }),
    };

    // Strip customAccess off the subscription via destructure rather than
    // patch — Convex's shallow patch keeps the existing customAccess unless
    // we replace the whole subscription object.
    const { customAccess: _drop, ...subscriptionRest } = target.subscription;
    void _drop;

    await ctx.db.patch(args.userId, {
      subscription: subscriptionRest,
      customAccessHistory: [...(target.customAccessHistory ?? []), historyEntry],
    });
  },
});

/**
 * Cron-driven cleanup: flip expired custom-access grants to revoked.
 *
 * Read-time gates (`userHasFullAccess`, `getMyAccess`) already block
 * expired grants the instant their expiry passes — this mutation is the
 * audit-trail closure so the timeline shows when each grant ended, and
 * `subscription.customAccess` doesn't accumulate stale rows.
 *
 * Idempotent: a row already revoked (or never expired) is skipped. Safe
 * to run repeatedly. Called from `convex/crons.ts`.
 *
 * Scale note: `.collect()` on `users` is fine at current size; revisit
 * past ~10K users by indexing on `subscription.customAccess.isActive`
 * and paginating with `take()` + scheduler self-rescheduling.
 */
export const expireStaleCustomAccessGrants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allUsers = await ctx.db.query("users").collect();
    let expired = 0;
    for (const user of allUsers) {
      const ca = user.subscription.customAccess;
      if (!ca?.isActive) continue;
      if (ca.expiresAt == null) continue;
      if (ca.expiresAt > now) continue;

      const { customAccess: _drop, ...subscriptionRest } = user.subscription;
      void _drop;

      await ctx.db.patch(user._id, {
        subscription: subscriptionRest,
        customAccessHistory: [
          ...(user.customAccessHistory ?? []),
          {
            action: "revoked" as const,
            reason: ca.reason,
            performedBy: "system:expiry",
            performedAt: now,
            notes: `Auto-revoked at expiry (${new Date(ca.expiresAt).toISOString()})`,
          },
        ],
      });
      expired++;
    }
    return { expired };
  },
});

// ─── Instructor preference mutations ─────────────────────────────────────────

/**
 * Save the instructor's UI locale preference.
 * Drives locale routing — 'en' | 'hi'.
 */
export const setMyLocale = mutation({
  args: { locale: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { locale: args.locale });
  },
});

/**
 * Set the account's default voice for a given language ({ lang → ttsVoiceId }).
 * Student profiles in that language inherit this unless they set their own
 * studentProfiles.voiceId override. Phase 8.4 — see lib/audio/resolveVoiceId.ts.
 */
export const setMyVoiceDefault = mutation({
  args: { lang: v.string(), voiceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      voiceDefaults: { ...(user.voiceDefaults ?? {}), [args.lang]: args.voiceId },
    });
  },
});

/**
 * Save the instructor's active theme slug.
 */
export const setMyThemeSlug = mutation({
  args: { themeSlug: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { themeSlug: args.themeSlug });
  },
});

/**
 * Set the instructor's grid size preference (saved to users, not studentProfiles).
 */
export const setMyInstructorGridSize = mutation({
  args: { gridSize: v.union(v.literal("large"), v.literal("medium"), v.literal("small")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      stateFlags: { ...(user.stateFlags ?? {}), grid_size: args.gridSize },
    });
  },
});

/**
 * Set the instructor's symbol text size preference.
 */
export const setMyInstructorSymbolTextSize = mutation({
  args: { textSize: v.union(v.literal("large"), v.literal("medium"), v.literal("small"), v.literal("xs")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      stateFlags: { ...(user.stateFlags ?? {}), symbol_text_size: args.textSize },
    });
  },
});

/**
 * Toggle a single boolean flag in the instructor's stateFlags.
 * Supports: symbol_label_visible, reduce_motion, core_dropdown_visible.
 */
export const setMyInstructorFlag = mutation({
  args: { flag: v.string(), value: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject)).first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      stateFlags: { ...(user.stateFlags ?? {}), [args.flag]: args.value },
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

/**
 * List users with a derived `profileCount` per account. Single query —
 * collects all studentProfiles once and groups by accountId, avoiding
 * one round trip per user.
 *
 * Admin-only. Used by the extended Users list (Phase 7).
 *
 * Note on scale: studentProfiles `.collect()` is fine at current size;
 * once the table grows past a few thousand rows, swap to a denormalised
 * counter on `users` (per Convex guidelines on `.collect().length`).
 */
export const usersWithProfileCount = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireCallerIsAdmin(ctx);

    const users = await ctx.db
      .query("users")
      .order("desc")
      .take(limit ?? 200);

    const profiles = await ctx.db.query("studentProfiles").collect();
    const counts = new Map<string, number>();
    for (const p of profiles) {
      counts.set(p.accountId, (counts.get(p.accountId) ?? 0) + 1);
    }

    return users.map((u) => ({
      ...u,
      profileCount: counts.get(u._id) ?? 0,
    }));
  },
});
