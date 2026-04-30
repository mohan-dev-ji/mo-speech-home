import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Resolve the accountId of the currently authenticated caller.
 * - Owners: their own users._id
 * - Collaborators: the host account's _id, via accountMembers
 * Returns null when the caller is unauthenticated or has no record.
 */
export async function resolveCallerAccountId(
  ctx: QueryCtx
): Promise<{ accountId: Id<"users">; user: Doc<"users"> } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user) return null;

  // Owner path
  // (default — collaborator path can override below)
  let accountId: Id<"users"> = user._id;

  const membership = await ctx.db
    .query("accountMembers")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
    .first();
  if (membership && membership.status === "active") {
    accountId = membership.accountId;
  }

  return { accountId, user };
}

/**
 * Throwing variant for mutations — fails loudly when there's no caller account.
 */
export async function requireCallerAccountId(
  ctx: QueryCtx
): Promise<{ accountId: Id<"users">; user: Doc<"users"> }> {
  const result = await resolveCallerAccountId(ctx);
  if (!result) throw new Error("Unauthenticated");
  return result;
}
