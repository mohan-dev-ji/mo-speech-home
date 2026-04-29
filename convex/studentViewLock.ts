import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

async function assertProfileOwnedByCaller(
  ctx: MutationCtx,
  profileId: Id<"studentProfiles">,
): Promise<Doc<"studentProfiles">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user) throw new Error("User record not found");

  const profile = await ctx.db.get(profileId);
  if (!profile) throw new Error("Profile not found");
  if (profile.accountId !== user._id) throw new Error("Not authorized for this profile");

  return profile;
}

export const lockStudentView = mutation({
  args: { profileId: v.id("studentProfiles") },
  handler: async (ctx, args) => {
    await assertProfileOwnedByCaller(ctx, args.profileId);
    await ctx.db.patch(args.profileId, {
      studentViewLocked: true,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const unlockStudentView = mutation({
  args: { profileId: v.id("studentProfiles") },
  handler: async (ctx, args) => {
    await assertProfileOwnedByCaller(ctx, args.profileId);
    await ctx.db.patch(args.profileId, {
      studentViewLocked: false,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getStudentViewLockState = query({
  args: { profileId: v.id("studentProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) return null;
    return { locked: !!profile.studentViewLocked };
  },
});
