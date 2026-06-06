import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
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
 * The tier a user can actually *use* right now: "free" | "pro" | "max".
 *
 * Mirrors the `tier` returned by `users.getMyAccess` (and the client
 * `useSubscription`) exactly, so server-side gates agree with the UI:
 *  - active custom-access grant → "max" (admin grants are Max-equivalent);
 *  - else the plan tier, but only if billing is active / cancelled-but-active;
 *  - otherwise "free" (e.g. an expired Pro plan gates as free).
 *
 * Use for tier comparisons that need to distinguish pro vs max (e.g. theme
 * gating). For a simple "any paid access?" check use `userHasFullAccess`.
 */
export function effectiveUserTier(user: Doc<"users">): "free" | "pro" | "max" {
  const { status, subscriptionEndsAt, plan, customAccess } = user.subscription;
  if (isCustomAccessEffective(customAccess)) return "max";
  const planTier = tierFromPlan(plan);
  const now = Date.now();
  const isCancelledButActive =
    status === "cancelled" &&
    subscriptionEndsAt != null &&
    subscriptionEndsAt > now;
  const planAccess =
    planTier !== "free" && (status === "active" || isCancelledButActive);
  return planAccess ? planTier : "free";
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

/**
 * Language tier gate (ADR-011 §3, boolean model). A **Free** account is
 * monolingual: at most one distinct language across `users.locale` + every
 * `studentProfiles.language`. Pro/Max (and custom grants) are unrestricted.
 *
 * Called from the three mutations that write a language (`setMyLocale`,
 * `updateStudentProfile`, `createStudentProfile`) BEFORE the write. Behaviour:
 *
 *  - Pro/Max/grant → no-op (returns empty cascade). All paid paths unchanged.
 *  - Free, change keeps ≤1 distinct language → allowed.
 *  - Free, **instructor** changes the single account language (`kind:"locale"`)
 *    in a way that would diverge → returns `cascadeProfileIds`: the student
 *    profiles the caller must snap to the new language (Free students INHERIT
 *    the instructor's language). Cascade is one-directional (instructor →
 *    students); the instructor can always change the one language.
 *  - Free, a **student** sets its own different language, or a second-language
 *    profile is created (`kind:"profile"`) → `TIER_REQUIRED` (the gated action;
 *    the Free student picker is hidden in the UI, this is the backend net).
 *
 * Returns the profiles to cascade; an empty array means "nothing to do".
 */
export async function assertLanguageAllowed(
  ctx: QueryCtx,
  user: Doc<"users">,
  nextLanguage: string,
  opts: { kind: "locale" } | { kind: "profile"; profileId?: Id<"studentProfiles"> },
): Promise<{ cascadeProfileIds: Id<"studentProfiles">[] }> {
  // Pro / Max / active custom grant: no language cap — paid behaviour untouched.
  if (userHasFullAccess(user)) return { cascadeProfileIds: [] };

  const profiles = await ctx.db
    .query("studentProfiles")
    .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
    .collect();

  const norm = (s: string | undefined) => (s ?? "").trim();
  const next = norm(nextLanguage);

  // Build the distinct-language set as it WOULD be after the proposed change.
  const resulting = new Set<string>();
  if (opts.kind === "locale") {
    if (next) resulting.add(next);
    for (const p of profiles) if (norm(p.language)) resulting.add(norm(p.language));
  } else {
    if (norm(user.locale)) resulting.add(norm(user.locale));
    for (const p of profiles) {
      const lang = opts.profileId && p._id === opts.profileId ? next : norm(p.language);
      if (lang) resulting.add(lang);
    }
    if (!opts.profileId && next) resulting.add(next); // create
  }

  if (resulting.size <= 1) return { cascadeProfileIds: [] };

  // Instructor changing the one account language → cascade students to inherit.
  if (opts.kind === "locale" && next) {
    return {
      cascadeProfileIds: profiles
        .filter((p) => norm(p.language) !== next)
        .map((p) => p._id),
    };
  }

  // A student diverging, or a second-language profile → the gated action.
  throw new ConvexError({
    code: "TIER_REQUIRED",
    required: "pro",
    message: "Multiple languages require Pro or Max.",
  });
}
