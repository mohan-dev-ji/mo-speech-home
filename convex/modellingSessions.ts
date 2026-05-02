import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the caller's accountId, load the profile, and confirm the caller is
 * authorised to act on it (owner or active collaborator). Mirrors the auth
 * shape used in studentProfiles.setStateFlag.
 */
async function loadAuthorisedProfile(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<"studentProfiles">,
): Promise<Doc<"studentProfiles"> | null> {
  const caller = await resolveCallerAccountId(ctx);
  if (!caller) return null;

  const profile = await ctx.db.get(profileId);
  if (!profile) return null;
  if (profile.accountId !== caller.accountId) return null;
  return profile;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Start a modelling session. Pre-computes the step path from the symbol's
 * location on the student's board and cancels any existing active session.
 * Only SymbolStix-typed profileSymbols are supported in this slice — custom
 * symbols throw because the schema's symbolId field references the global
 * symbols table.
 */
export const createModellingSession = mutation({
  args: {
    profileId: v.id("studentProfiles"),
    profileSymbolId: v.id("profileSymbols"),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.accountId !== accountId) {
      throw new Error("Not authorised");
    }

    const profileSymbol = await ctx.db.get(args.profileSymbolId);
    if (!profileSymbol || profileSymbol.accountId !== accountId) {
      throw new Error("Symbol not found");
    }

    if (profileSymbol.imageSource.type !== "symbolstix") {
      throw new Error("Only SymbolStix symbols can be modelled in this slice");
    }

    const symbol = await ctx.db.get(profileSymbol.imageSource.symbolId);
    if (!symbol) {
      throw new Error("Symbol record not found");
    }

    // Cancel any sessions still flagged active for this profile. Defensive
    // loop — there should be at most one, but iterate in case of races.
    const stale = await ctx.db
      .query("modellingSessions")
      .withIndex("by_profile_id_and_status", (q) =>
        q.eq("profileId", args.profileId).eq("status", "active"),
      )
      .collect();
    const now = Date.now();
    for (const prev of stale) {
      await ctx.db.patch(prev._id, {
        status: "cancelled",
        completedAt: now,
      });
    }

    return await ctx.db.insert("modellingSessions", {
      profileId: args.profileId,
      initiatedBy: user.clerkUserId,
      symbolId: profileSymbol.imageSource.symbolId,
      symbolPreview: {
        word: symbol.words.eng,
        imagePath: symbol.imagePath,
      },
      steps: [
        { screen: "home", highlight: "categories-nav-button" },
        {
          screen: "categories",
          highlight: `category-tile-${profileSymbol.profileCategoryId}`,
        },
        {
          screen: "category-detail",
          highlight: `symbol-${profileSymbol._id}`,
        },
      ],
      currentStep: 0,
      status: "active",
    });
  },
});

/**
 * Move a session forward by one step. When the final step is reached,
 * status flips to "completed". No-op if the session is already terminal —
 * subscription updates can race with student taps.
 */
export const advanceStep = mutation({
  args: {
    sessionId: v.id("modellingSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const profile = await loadAuthorisedProfile(ctx, session.profileId);
    if (!profile) throw new Error("Not authorised");

    if (session.status !== "active") return null;

    const next = session.currentStep + 1;
    if (next >= session.steps.length) {
      await ctx.db.patch(session._id, {
        status: "completed",
        currentStep: session.steps.length - 1,
        completedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(session._id, { currentStep: next });
    }
    return null;
  },
});

/**
 * Cancel an active session. No-op if already completed or cancelled.
 */
export const cancelModellingSession = mutation({
  args: {
    sessionId: v.id("modellingSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const profile = await loadAuthorisedProfile(ctx, session.profileId);
    if (!profile) throw new Error("Not authorised");

    if (session.status !== "active") return null;

    await ctx.db.patch(session._id, {
      status: "cancelled",
      completedAt: Date.now(),
    });
    return null;
  },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to the active session for a profile. Both the student board
 * and the instructor mirror view subscribe to this — Convex pushes updates
 * to both as the session advances.
 */
export const getActiveModellingSession = query({
  args: {
    profileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    const profile = await loadAuthorisedProfile(ctx, args.profileId);
    if (!profile) return null;

    return await ctx.db
      .query("modellingSessions")
      .withIndex("by_profile_id_and_status", (q) =>
        q.eq("profileId", args.profileId).eq("status", "active"),
      )
      .first();
  },
});

/**
 * Subscribe to a specific session by id. Used by the instructor mirror
 * view once a session has been created.
 */
export const getModellingSessionById = query({
  args: {
    sessionId: v.id("modellingSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const profile = await loadAuthorisedProfile(ctx, session.profileId);
    if (!profile) return null;

    return session;
  },
});
