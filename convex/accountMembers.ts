import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * List all collaborators invited to the current user's account.
 * Excludes the account owner — they are not in this table.
 */
/**
 * Get this user's own membership record if they were invited as a collaborator.
 * Returns null if the user is an account owner (not a collaborator on anyone's account).
 */
export const getMyMembership = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return null;

    return await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .first();
  },
});

export const getMyAccountMembers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return null;

    return await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .take(50);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Invite a collaborator by email address.
 * Creates a pending accountMember record.
 * Gated to Max tier — verified server-side.
 */
export const inviteCollaborator = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User record not found");

    // Server-side Max tier gate
    const plan = user.subscription.plan ?? "";
    if (!plan.startsWith("max")) throw new Error("Max tier required");

    // Duplicate check — accounts have few members so take(50) is safe
    const existing = await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .take(50);
    if (existing.some((m) => m.email === args.email)) {
      throw new Error("Already invited");
    }

    return await ctx.db.insert("accountMembers", {
      accountId: user._id,
      email: args.email,
      role: "collaborator",
      status: "pending",
      invitedAt: Date.now(),
    });
  },
});

/**
 * Remove a pending invite or active collaborator from the account.
 */
export const removeMember = mutation({
  args: {
    memberId: v.id("accountMembers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const member = await ctx.db.get(args.memberId);
    if (!member || member.accountId !== user._id) throw new Error("Not authorised");

    await ctx.db.delete(args.memberId);
  },
});
