import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const STALE_AFTER_MS = 30_000;
const HARD_DELETE_AFTER_MS = 5 * 60_000;

export const heartbeatStudentViewSession = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("studentViewSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: now });
    } else {
      await ctx.db.insert("studentViewSessions", {
        profileId: args.profileId,
        sessionId: args.sessionId,
        clerkUserId: identity.subject,
        lastSeen: now,
      });
    }
    return null;
  },
});

export const endStudentViewSession = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("studentViewSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const getActiveStudentViewSessions = query({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    const rows = await ctx.db
      .query("studentViewSessions")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    return rows
      .filter((r) => r.lastSeen > cutoff)
      .map((r) => ({
        sessionId: r.sessionId,
        clerkUserId: r.clerkUserId,
        lastSeen: r.lastSeen,
      }));
  },
});

export const cleanupStaleSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - HARD_DELETE_AFTER_MS;
    const stale = await ctx.db.query("studentViewSessions").collect();
    for (const row of stale) {
      if (row.lastSeen < cutoff) {
        await ctx.db.delete(row._id);
      }
    }
    return null;
  },
});
