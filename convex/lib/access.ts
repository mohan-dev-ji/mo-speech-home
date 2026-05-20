import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { tierFromPlan } from "../users";

/**
 * Whether a stored customAccess grant is currently in effect.
 *
 * A grant is effective iff `isActive === true` AND (no expiry OR expiry is
 * in the future). The DB flag and the wall-clock check are both required —
 * the daily `expireStaleCustomAccessGrants` cron flips `isActive: false`
 * after expiry, but this check is the immediate gate so a grant stops
 * working the second its expiry passes, regardless of cron cadence.
 *
 * Shared between `userHasFullAccess` and the client-facing `getMyAccess`
 * query so the two stay in lockstep.
 */
export function isCustomAccessEffective(
  customAccess: Doc<"users">["subscription"]["customAccess"]
): boolean {
  if (!customAccess?.isActive) return false;
  if (customAccess.expiresAt == null) return true;
  return customAccess.expiresAt > Date.now();
}

/**
 * Plan-gate decision for any Pro+ paid feature.
 *
 * Returns true when the user is on Pro or Max with active billing, OR has
 * been granted custom access by an admin. Used by:
 *   - Resource library load gates (free packs always loadable; non-free packs
 *     require Pro+).
 *   - Authoring mutations: create / edit / delete categories, lists,
 *     sentences, symbols. Free tier is read-only post-starter-pack-seed.
 *   - Modelling triggers and other paid features.
 *
 * Mirrors the `hasFullAccess` calculation in `users.getMyAccess`
 * (convex/users.ts:58-71). Kept in a shared module so mutations across
 * multiple files can guard consistently without duplicating the logic.
 */
export function userHasFullAccess(user: Doc<"users">): boolean {
  const { status, subscriptionEndsAt, plan, customAccess } = user.subscription;
  const tier = tierFromPlan(plan);
  const now = Date.now();

  const isCancelledButActive =
    status === "cancelled" &&
    subscriptionEndsAt != null &&
    subscriptionEndsAt > now;

  const planAccess =
    tier !== "free" && (status === "active" || isCancelledButActive);

  return planAccess || isCustomAccessEffective(customAccess);
}

/**
 * Throws a `TIER_REQUIRED` ConvexError if the caller is on the free tier.
 * Convenience for mutation handlers — call right after you have the user doc.
 *
 * The client surfaces this code as an upgrade nudge; the message is the
 * fallback shown if the client doesn't recognise the code.
 */
export function requireProTier(user: Doc<"users">): void {
  if (!userHasFullAccess(user)) {
    throw new ConvexError({
      code: "TIER_REQUIRED",
      required: "pro",
      message: "Editing requires Pro or Max plan.",
    });
  }
}
