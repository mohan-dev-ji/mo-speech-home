import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Resolve the account the currently authenticated caller works in.
 * - Owners: their own users._id; `planUser` is their own row, `role` "owner".
 * - Active collaborators (carers): the host account's _id, via accountMembers;
 *   `planUser` is the host owner's row, so every plan gate reads the family's
 *   plan, not the carer's own (MOS-88). `role` is "collaborator".
 * - A collaborator whose host account no longer exists falls back to being the
 *   owner of their own account rather than failing.
 * `user` is always the caller's own row: use it for per-person settings, and
 * `planUser` for anything the plan decides.
 * Returns null when the caller is unauthenticated or has no record.
 */
export async function resolveCallerAccountId(
  ctx: QueryCtx
): Promise<{
  accountId: Id<"users">;
  user: Doc<"users">;
  /** Whose plan applies: the family owner for an active carer (MOS-88), else `user`. */
  planUser: Doc<"users">;
  role: "owner" | "collaborator";
} | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user) return null;

  const membership = await ctx.db
    .query("accountMembers")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
    .first();
  if (membership && membership.status === "active") {
    const host = await ctx.db.get(membership.accountId);
    if (host) {
      return { accountId: membership.accountId, user, planUser: host, role: "collaborator" };
    }
    // The host deleted their account: the carer is left as the owner of
    // their own account (fall through).
  }

  // Owner path
  return { accountId: user._id, user, planUser: user, role: "owner" };
}

/**
 * Throwing variant for mutations — fails loudly when there's no caller account.
 * Same shape as resolveCallerAccountId: gate plan checks on `planUser`.
 */
export async function requireCallerAccountId(
  ctx: QueryCtx
): Promise<{
  accountId: Id<"users">;
  user: Doc<"users">;
  /** Whose plan applies: the family owner for an active carer (MOS-88), else `user`. */
  planUser: Doc<"users">;
  role: "owner" | "collaborator";
}> {
  const result = await resolveCallerAccountId(ctx);
  if (!result) throw new Error("Unauthenticated");
  return result;
}

/**
 * Whether the signed-in caller's account owns a document with this accountId
 * (MOS-92). Collaborators resolve to the host account, so they own the host's
 * rows. A missing accountId is never owned. Use it in every function that takes
 * a document ID from the client, and return what "not found" returns when it's
 * false, so a stranger learns nothing about the ID.
 */
export async function callerOwnsAccount(
  ctx: QueryCtx,
  accountId: Id<"users"> | undefined,
): Promise<boolean> {
  if (!accountId) return false;
  const resolved = await resolveCallerAccountId(ctx);
  return resolved !== null && resolved.accountId === accountId;
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
