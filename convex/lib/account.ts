import { ConvexError } from "convex/values";
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

/**
 * Require the caller to be authenticated AND have role="admin" in their
 * Clerk JWT. Role is sourced from publicMetadata.role via the Convex JWT
 * template — the template must include `"role": "{{user.public_metadata.role}}"`
 * in its claims (Clerk Dashboard → JWT Templates → convex). See ADR-008.
 *
 * Returns the same shape as requireCallerAccountId plus the caller's
 * clerkUserId, so admin-only mutations can stamp createdBy without taking
 * it as an arg.
 *
 * Throws ConvexError({ code: "ADMIN_REQUIRED" }) for non-admin callers.
 * Throws ConvexError({ code: "UNAUTHENTICATED" }) for missing identity / user.
 */
export async function requireCallerIsAdmin(
  ctx: QueryCtx
): Promise<{ accountId: Id<"users">; user: Doc<"users">; clerkUserId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required." });
  }
  const role = (identity as { role?: unknown }).role;
  if (role !== "admin") {
    throw new ConvexError({ code: "ADMIN_REQUIRED", message: "Admin role required." });
  }
  const resolved = await resolveCallerAccountId(ctx);
  if (!resolved) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "No account record." });
  }
  return { ...resolved, clerkUserId: identity.subject };
}
