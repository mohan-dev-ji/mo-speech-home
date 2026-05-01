import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Cascade-delete the calling user's entire account.
 *
 * Owner-only: refuses if the caller is an active collaborator on someone
 * else's account. Returns the list of student profile IDs that were
 * removed so the caller (the /api/delete-account route) can wipe the
 * matching `profiles/{profileId}/` prefixes from R2.
 *
 * Stripe and Clerk deletion happen outside this mutation — the API route
 * orchestrates the full sequence.
 */
export const cascadeDeleteAccount = mutation({
  args: {},
  handler: async (ctx): Promise<{ profileIds: Id<"studentProfiles">[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const memberships = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .collect();
    const isCollaboratorElsewhere = memberships.some(
      (m) => m.accountId !== user._id && m.status === "active"
    );
    if (isCollaboratorElsewhere) {
      throw new Error(
        "Only the account owner can delete this account. Contact support to leave a shared account."
      );
    }

    const accountId = user._id;

    const profiles = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const profileIds = profiles.map((p) => p._id);

    for (const profileId of profileIds) {
      const modelling = await ctx.db
        .query("modellingSessions")
        .withIndex("by_profile_id", (q) => q.eq("profileId", profileId))
        .collect();
      for (const m of modelling) await ctx.db.delete(m._id);

      const presence = await ctx.db
        .query("studentViewSessions")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect();
      for (const p of presence) await ctx.db.delete(p._id);
    }

    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of symbols) await ctx.db.delete(row._id);

    const categories = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of categories) await ctx.db.delete(row._id);

    const lists = await ctx.db
      .query("profileLists")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of lists) await ctx.db.delete(row._id);

    const sentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const row of sentences) await ctx.db.delete(row._id);

    const members = await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);

    for (const p of profiles) await ctx.db.delete(p._id);

    await ctx.db.delete(user._id);

    return { profileIds };
  },
});
