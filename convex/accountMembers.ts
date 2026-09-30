import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { effectiveUserTier } from "./lib/access";
import { requireCallerAccountId, resolveCallerAccountId } from "./lib/account";

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
 * Owner-only and gated to Max tier, both verified server-side (MOS-94).
 */
export const inviteCollaborator = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { accountId, user, planUser, role } = await requireCallerAccountId(ctx);

    // MOS-94: a carer resolves to the family's account, so without this they
    // could add invites to it. Only the account owner invites.
    if (role === "collaborator") throw new Error("Only the account owner can invite");

    // Server-side Max tier gate: the effective tier, so an expired or unpaid
    // Max plan doesn't pass and an active custom-access grant does. For an
    // owner, planUser is their own row.
    if (effectiveUserTier(planUser) !== "max") throw new Error("Max tier required");

    // MOS-90: invite emails are stored lower-cased and trimmed so they match
    // the (also lower-cased) verified email createUser reads from the token.
    const email = args.email.trim().toLowerCase();
    if (email === user.email.trim().toLowerCase()) {
      throw new Error("You can't invite yourself");
    }

    // Duplicate check — accounts have few members so take(50) is safe
    const existing = await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .take(50);
    if (existing.some((m) => m.email === email)) {
      throw new Error("Already invited");
    }

    return await ctx.db.insert("accountMembers", {
      accountId,
      email,
      role: "collaborator",
      status: "pending",
      invitedAt: Date.now(),
    });
  },
});

/**
 * Server check for POST /api/invite (MOS-94): only an account owner on Max can
 * make Clerk send an invite email, and only to an address they have already
 * invited through inviteCollaborator.
 */
export const canSendInvite = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved || resolved.role !== "owner") return false;
    if (effectiveUserTier(resolved.planUser) !== "max") return false;
    const email = args.email.trim().toLowerCase();
    const pending = await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id_and_status", (q) =>
        q.eq("accountId", resolved.accountId).eq("status", "pending"))
      .take(50);
    return pending.some((m) => m.email === email);
  },
});

/**
 * Join a family from a pending invite on sign-in, for people who already have
 * an account (MOS-94). createUser handles brand-new sign-ups. Same identity
 * rules as createUser (MOS-90): verified email, lower-case match. An account
 * that already has student profiles can't join: accountMembers maps a carer to
 * one family, and joining would hide their own students (owner decision
 * 2026-09-29), so they're told to use a different email.
 */
export const acceptPendingInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "none" as const };
    const email = (identity.email ?? "").trim().toLowerCase();
    if (!email || identity.emailVerified !== true) return { status: "none" as const };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return { status: "none" as const };

    const pending = await ctx.db
      .query("accountMembers")
      .withIndex("by_email_and_status", (q) => q.eq("email", email).eq("status", "pending"))
      .first();
    if (!pending) return { status: "none" as const };
    if (pending.accountId === user._id) return { status: "none" as const };

    const alreadyMember = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .first();
    if (alreadyMember && alreadyMember.status === "active") {
      return { status: "already_member" as const };
    }

    const ownProfile = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .first();
    if (ownProfile) return { status: "has_students" as const };

    await ctx.db.patch(pending._id, {
      clerkUserId: user.clerkUserId,
      status: "active",
      joinedAt: Date.now(),
    });
    return { status: "joined" as const };
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
