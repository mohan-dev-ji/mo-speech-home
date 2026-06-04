import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireCallerIsAdmin } from "./lib/account";
import { assertLanguageAllowed } from "./lib/access";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Keys that have been removed from the schema but may still exist on older
// student profile documents. Strip these before spreading stateFlags into
// `ctx.db.patch`, otherwise Convex rejects the write with a schema error.
const DEPRECATED_FLAG_KEYS = ["first_thens_visible"] as const;

function cleanStateFlags<T extends Record<string, unknown>>(flags: T): T {
  const cleaned = { ...flags } as Record<string, unknown>;
  for (const key of DEPRECATED_FLAG_KEYS) delete cleaned[key];
  return cleaned as T;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_STATE_FLAGS = {
  home_visible: true,
  search_visible: true,
  categories_visible: true,
  settings_visible: false,
  talker_visible: true,
  talker_banner_toggle: true,
  play_modal_visible: true,
  voice_input_enabled: true,
  audio_autoplay: true,
  modelling_push: false,
  core_dropdown_visible: true,
  reduce_motion: false,
  grid_size: "large" as const,
  symbol_label_visible: true,
  symbol_text_size: "small" as const,
  lists_visible: true,
  sentences_visible: true,
  student_can_edit: false,
  quick_settings_visible: false,
  header_in_banner_mode: false,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get the active student profile for the current user.
 * Resolution order:
 *   1. users.activeProfileId (if set and valid)
 *   2. First profile found for the account (backwards compat / first-time)
 *   3. Collaborator path: active membership → host account's active profile
 * Returns null if no profile exists (onboarding needed).
 */
export const getMyStudentProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return null;

    // Instructor path: own account
    if (user.activeProfileId) {
      const active = await ctx.db.get(user.activeProfileId);
      if (active && active.accountId === user._id) return active;
    }
    const firstOwn = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .first();
    if (firstOwn) return firstOwn;

    // Collaborator path: active membership on another account
    const membership = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .first();
    if (!membership || membership.status !== "active") return null;

    const hostUser = await ctx.db.get(membership.accountId);
    if (!hostUser) return null;

    if (hostUser.activeProfileId) {
      const hostActive = await ctx.db.get(hostUser.activeProfileId);
      if (hostActive) return hostActive;
    }
    return await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", membership.accountId))
      .first();
  },
});

/**
 * Get all student profiles belonging to the current user's own account.
 * Returns [] for collaborators (they don't own profiles).
 * Used by the profile switcher in Settings.
 */
export const getMyStudentProfiles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return [];

    return await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .collect();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new student profile on this account.
 * Multiple profiles per account are allowed.
 * The new profile becomes the active profile immediately.
 */
export const createStudentProfile = mutation({
  args: {
    name: v.string(),
    dateOfBirth: v.optional(v.number()),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User record not found");

    // Language tier gate (ADR-011 §3): Free is monolingual. A new profile in a
    // language that differs from the account's existing language is the gated
    // action (onboarding sets the account locale first so the first profile
    // matches). Throws TIER_REQUIRED for Free; no-op for Pro/Max.
    await assertLanguageAllowed(ctx, user, args.language, { kind: "profile" });

    const profileId = await ctx.db.insert("studentProfiles", {
      accountId: user._id,
      name: args.name,
      dateOfBirth: args.dateOfBirth,
      language: args.language,
      stateFlags: DEFAULT_STATE_FLAGS,
      updatedAt: Date.now(),
    });

    // New profile becomes active immediately
    await ctx.db.patch(user._id, { activeProfileId: profileId });

    // Seed default categories + symbols at the ACCOUNT level — idempotent, only
    // seeds if the account has no categories yet. New student profiles share
    // the existing account library; first profile creation triggers the seed.
    await ctx.scheduler.runAfter(
      0,
      internal.profileCategories.seedDefaultAccount,
      { accountId: user._id }
    );

    return profileId;
  },
});

/**
 * Switch the active profile on the current user's account.
 * Verifies the profile belongs to the caller's own account.
 */
export const setActiveProfile = mutation({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.accountId !== user._id)
      throw new Error("Profile not found or not authorised");

    await ctx.db.patch(user._id, { activeProfileId: args.profileId });
  },
});

/**
 * Delete a student profile.
 * Cannot delete the last remaining profile on an account.
 * If the deleted profile was active, switches to the next available profile.
 */
export const deleteStudentProfile = mutation({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.accountId !== user._id)
      throw new Error("Not authorised");

    const allProfiles = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .collect();

    if (allProfiles.length <= 1)
      throw new Error("Cannot delete the only profile");

    // If deleting the active profile, switch to another before deleting
    if (user.activeProfileId === args.profileId) {
      const next = allProfiles.find((p) => p._id !== args.profileId);
      if (next) await ctx.db.patch(user._id, { activeProfileId: next._id });
    }

    // Clean up per-student tracking (content lives at account level — never deleted here)
    const sessions = await ctx.db
      .query("modellingSessions")
      .withIndex("by_profile_id", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    const presence = await ctx.db
      .query("studentViewSessions")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const p of presence) await ctx.db.delete(p._id);

    await ctx.db.delete(args.profileId);
  },
});

/**
 * Toggle a single state flag on a student profile.
 * Verifies ownership — collaborators can also call this.
 */
export const setStateFlag = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    flag: v.string(),
    value: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const isOwner = profile.accountId === user._id;
    const isCollaborator =
      !isOwner &&
      !!(await ctx.db
        .query("accountMembers")
        .withIndex("by_clerk_user_id", (q) =>
          q.eq("clerkUserId", user.clerkUserId)
        )
        .first());

    if (!isOwner && !isCollaborator) throw new Error("Not authorised");

    await ctx.db.patch(args.profileId, {
      stateFlags: cleanStateFlags({
        ...profile.stateFlags,
        [args.flag]: args.value,
      }) as typeof profile.stateFlags,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set the grid size preference. large=4 cols, medium=8 cols, small=12 cols.
 */
export const setGridSize = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    gridSize: v.union(v.literal("large"), v.literal("medium"), v.literal("small")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const isOwner = profile.accountId === user._id;
    const isCollaborator =
      !isOwner &&
      !!(await ctx.db
        .query("accountMembers")
        .withIndex("by_clerk_user_id", (q) =>
          q.eq("clerkUserId", user.clerkUserId)
        )
        .first());

    if (!isOwner && !isCollaborator) throw new Error("Not authorised");

    await ctx.db.patch(args.profileId, {
      stateFlags: cleanStateFlags({ ...profile.stateFlags, grid_size: args.gridSize }),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set the symbol text size preference.
 */
export const setSymbolTextSize = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    textSize: v.union(
      v.literal("large"),
      v.literal("medium"),
      v.literal("small"),
      v.literal("xs")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const isOwner = profile.accountId === user._id;
    const isCollaborator =
      !isOwner &&
      !!(await ctx.db
        .query("accountMembers")
        .withIndex("by_clerk_user_id", (q) =>
          q.eq("clerkUserId", user.clerkUserId)
        )
        .first());

    if (!isOwner && !isCollaborator) throw new Error("Not authorised");

    await ctx.db.patch(args.profileId, {
      stateFlags: cleanStateFlags({ ...profile.stateFlags, symbol_text_size: args.textSize }),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update a student profile's editable fields (name, language, dateOfBirth).
 * Only the account owner can do this.
 */
export const updateStudentProfile = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    name: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    language: v.optional(v.string()),
    themeSlug: v.optional(v.string()),
    // ttsVoiceId override for this student. Pass `null` to clear it (→ inherit
    // the account default for the profile's language). Phase 8.4.
    voiceId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user || profile.accountId !== user._id) throw new Error("Not authorised");

    // Language tier gate (ADR-011 §3): on Free, a student may not set its own
    // language different from the (single) account language — that's the gated
    // action (the Free student picker is hidden in the UI; this is the net).
    // No-op for Pro/Max, or when language isn't changing.
    if (args.language !== undefined) {
      await assertLanguageAllowed(ctx, user, args.language, {
        kind: "profile",
        profileId: args.profileId,
      });
    }

    const { profileId, voiceId, ...updates } = args;
    const patch: Record<string, unknown> = { ...updates, updatedAt: Date.now() };
    // `null` clears the override (patch to undefined removes the field);
    // a string sets it; omitted leaves it untouched.
    if (voiceId !== undefined) patch.voiceId = voiceId === null ? undefined : voiceId;
    await ctx.db.patch(profileId, patch);
  },
});

/**
 * One-shot migration to strip deprecated stateFlags keys (e.g. first_thens_visible)
 * from every profile owned by the authenticated user. Run from any window in
 * the app's dev console:
 *   await window.__convex.mutation('studentProfiles:cleanupDeprecatedFlags', {})
 * Or invoke from the Convex dashboard. Idempotent — safe to run repeatedly.
 */
export const cleanupDeprecatedFlags = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User record not found");

    const profiles = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .collect();

    let cleaned = 0;
    for (const profile of profiles) {
      const flags = profile.stateFlags as Record<string, unknown>;
      const hasDeprecated = DEPRECATED_FLAG_KEYS.some((k) => k in flags);
      if (!hasDeprecated) continue;
      await ctx.db.patch(profile._id, {
        stateFlags: cleanStateFlags(profile.stateFlags),
        updatedAt: Date.now(),
      });
      cleaned += 1;
    }
    return { cleaned, total: profiles.length };
  },
});


/**
 * Admin-only: list studentProfiles for a given accountId. Used by the
 * admin user-detail page (Phase 7 §3.7) to render a read-only summary
 * of the account's student profiles.
 *
 * Caller must be a Clerk admin — enforced via `requireCallerIsAdmin`.
 */
export const listProfilesForAccount = query({
  args: { accountId: v.id("users") },
  handler: async (ctx, { accountId }) => {
    await requireCallerIsAdmin(ctx);
    const profiles = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    return profiles.map((p) => ({
      _id: p._id,
      _creationTime: p._creationTime,
      name: p.name,
      language: p.language,
      themeSlug: p.themeSlug ?? null,
      updatedAt: p.updatedAt,
      studentViewLocked: p.studentViewLocked ?? false,
    }));
  },
});
