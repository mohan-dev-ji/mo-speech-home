import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * phase-40 test fixtures only (deleted in phase-40 Task 4). Creates or removes
 * probe rows: users whose clerkUserId starts "user_phase40_", accountMembers
 * and studentProfiles belonging to them, and invites to "@example.invalid".
 */
export const phase40Fixtures = internalMutation({
  args: {
    action: v.union(v.literal("member"), v.literal("invite"), v.literal("cleanup")),
    accountId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.action !== "cleanup") {
      if (!args.accountId || !args.email?.endsWith("@example.invalid")) {
        throw new Error("needs accountId and an @example.invalid email");
      }
      return await ctx.db.insert("accountMembers", {
        accountId: args.accountId,
        email: args.email,
        role: "collaborator",
        status: args.action === "member" ? "active" : "pending",
        invitedAt: Date.now(),
        ...(args.action === "member" && args.clerkUserId
          ? { clerkUserId: args.clerkUserId, joinedAt: Date.now() }
          : {}),
      });
    }
    let removed = 0;
    for await (const m of ctx.db.query("accountMembers")) {
      if (m.email.endsWith("@example.invalid")) { await ctx.db.delete(m._id); removed++; }
    }
    for await (const u of ctx.db.query("users")) {
      if (!u.clerkUserId.startsWith("user_phase40_")) continue;
      for await (const p of ctx.db.query("studentProfiles").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(p._id); removed++;
      }
      // createStudentProfile schedules seedDefaultAccount for the probe's own
      // account, which installs the default modules: remove everything it wrote.
      for await (const r of ctx.db.query("profileSymbols").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      for await (const r of ctx.db.query("profileCategories").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      for await (const r of ctx.db.query("profileLists").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      for await (const r of ctx.db.query("profilePhrases").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      for await (const r of ctx.db.query("profileSentences").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      for await (const r of ctx.db.query("profileFolders").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      for await (const r of ctx.db.query("imageCredits").withIndex("by_account_and_key", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(r._id); removed++;
      }
      await ctx.db.delete(u._id); removed++;
    }
    return { removed };
  },
});
