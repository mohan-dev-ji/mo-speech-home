import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

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

    // Seed default categories + symbols in the background — runs right after
    // this mutation commits so the profile exists before seeding starts.
    await ctx.scheduler.runAfter(
      0,
      internal.profileCategories.seedDefaultProfile,
      { profileId }
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
      stateFlags: {
        ...profile.stateFlags,
        [args.flag]: args.value,
      } as typeof profile.stateFlags,
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
      stateFlags: { ...profile.stateFlags, grid_size: args.gridSize },
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
      stateFlags: { ...profile.stateFlags, symbol_text_size: args.textSize },
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

    const { profileId, ...updates } = args;
    await ctx.db.patch(profileId, { ...updates, updatedAt: Date.now() });
  },
});
