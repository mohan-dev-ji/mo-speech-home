import { mutation, query } from "./_generated/server";
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
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get the student profile for the current user's account.
 * Returns null if the user has not yet created a profile (onboarding incomplete).
 * Phase 1: one profile per account.
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

    // Instructor path: own account has a profile
    const ownProfile = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .first();
    if (ownProfile) return ownProfile;

    // Collaborator path: active membership on another account → load that account's profile
    const membership = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .first();

    if (!membership || membership.status !== "active") return null;

    return await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", membership.accountId))
      .first();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a student profile after sign-up (onboarding step).
 * Seeds default state flags and sets the chosen language.
 * Guard: one profile per account — returns existing ID if already created.
 */
export const createStudentProfile = mutation({
  args: {
    name: v.string(),
    dateOfBirth: v.optional(v.number()),
    language: v.string(), // "eng" | "hin" — open-ended
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) throw new Error("User record not found");

    // One profile per account in Phase 1
    const existing = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("studentProfiles", {
      accountId: user._id,
      name: args.name,
      dateOfBirth: args.dateOfBirth,
      language: args.language,
      stateFlags: DEFAULT_STATE_FLAGS,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Toggle a single state flag on a student profile.
 * Used by the instructor to adjust the student's live view (e.g. talker_visible).
 * Verifies ownership — collaborators can also call this.
 */
export const setStateFlag = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    flag: v.string(), // key of stateFlags object
    value: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    // Allow account owner or active collaborator
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
      stateFlags: { ...profile.stateFlags, [args.flag]: args.value } as typeof profile.stateFlags,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set the grid size preference for a student profile.
 * large=4 cols, medium=8 cols, small=12 cols.
 * Verifies ownership — collaborators can also call this.
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
 * Set the symbol text size preference for a student profile.
 * small=p-bold, medium=h4, large=h2.
 */
export const setSymbolTextSize = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    textSize: v.union(v.literal("large"), v.literal("medium"), v.literal("small")),
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
 * Update a student profile's editable fields.
 * Verifies the caller owns the account this profile belongs to.
 */
export const updateStudentProfile = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    name: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    language: v.optional(v.string()),
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
