import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireCallerAccountId } from "./lib/account";
import { tierFromPlan } from "./users";

/**
 * Resource library mutations and queries.
 *
 * Phase 6 foundation chunk:
 * - loadResourcePack — public mutation; users with Pro+ load a pack into their account
 * - loadStarterTemplate — internal mutation; called by seedDefaultAccount on new accounts
 * - getStarterPack — query; returns the canonical starter pack or null
 *
 * The shared helper materialisePackIntoAccount handles the actual content insertion.
 *
 * Pack invariants:
 * - At most one pack has isStarter: true. Enforced at the materialisation layer
 *   (see migrations.materialiseStarterPack, not here).
 * - librarySourceId on profile records is a loose ref back to resourcePacks._id —
 *   used only for reload-defaults; never enforced as a foreign key.
 *
 * See ADR-008 and docs/1-inbox/ideas/06-resource-library.md.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Plan-gate decision for resource library access.
 * Mirrors the hasFullAccess logic in users.getMyAccess (convex/users.ts:58–71)
 * plus the customAccess bypass pattern used in app/api/image-search/proxy/route.ts.
 *
 * Returns true when the user is on Pro or Max with active billing, OR has been
 * granted custom access by an admin.
 */
function userHasFullAccess(user: Doc<"users">): boolean {
  const { status, subscriptionEndsAt, plan, customAccess } = user.subscription;
  const tier = tierFromPlan(plan);
  const now = Date.now();

  const isCancelledButActive =
    status === "cancelled" &&
    subscriptionEndsAt != null &&
    subscriptionEndsAt > now;

  const planAccess =
    tier !== "free" && (status === "active" || isCancelledButActive);

  const customAccessActive = customAccess?.isActive ?? false;

  return planAccess || customAccessActive;
}

/**
 * Materialise a resource pack's snapshot content into an account.
 * Creates profileCategory + profileSymbol records (and, in future chunks,
 * profileList + profileSentence records) scoped to accountId, with
 * librarySourceId set to the pack's _id.
 *
 * Exported so seedDefaultAccount can call it inline without going through
 * ctx.runMutation (this codebase doesn't use that pattern; cross-mutation
 * effects compose via shared async helpers).
 *
 * Loaded content is fully independent — the library is not touched again.
 * Loading the same pack twice creates duplicates (intentional — matches
 * "load again, get fresh copies" UX).
 *
 * Foundation-chunk note: lists and sentences are not yet wired in. The starter
 * pack always ships with empty lists/sentences arrays. When save-to-library
 * mutations land in the next chunk, the snapshot shape will be defined and
 * this helper will iterate them.
 */
export async function materialisePackIntoAccount(
  ctx: MutationCtx,
  accountId: Id<"users">,
  pack: Doc<"resourcePacks">
): Promise<{
  packId: Id<"resourcePacks">;
  categoriesAdded: number;
  symbolsAdded: number;
  symbolsSkipped: number;
}> {
  const now = Date.now();
  let categoriesAdded = 0;
  let symbolsAdded = 0;
  let symbolsSkipped = 0;

  // Find current max order for this account so we append rather than overlap.
  const last = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
    .order("desc")
    .first();
  let nextOrder = last ? last.order + 1 : 0;

  for (const cat of pack.categories ?? []) {
    const profileCategoryId = await ctx.db.insert("profileCategories", {
      accountId,
      name: cat.name,
      icon: cat.icon,
      colour: cat.colour,
      ...(cat.imagePath ? { imagePath: cat.imagePath } : {}),
      order: nextOrder++,
      librarySourceId: pack._id,
      updatedAt: now,
    });
    categoriesAdded++;

    let symbolOrder = 0;
    for (const sym of cat.symbols) {
      // pack.categories[].symbols[].symbolId is a loose string ref. For SymbolStix
      // packs (the only shape supported today per docs/1-inbox/ideas/06-resource-library.md)
      // it points at convex-home's symbols table.
      const symbolDoc = await ctx.db.get(sym.symbolId as Id<"symbols">);
      if (!symbolDoc) {
        // Symbol was deleted from the global library since the pack was authored.
        // Skip rather than fail — partial loads are better than no load.
        symbolsSkipped++;
        continue;
      }

      // Build label: pack-level override beats SymbolStix words.
      const label = {
        eng:
          sym.labelOverride?.eng ?? symbolDoc.words.eng,
        ...(sym.labelOverride?.hin ?? symbolDoc.words.hin
          ? { hin: sym.labelOverride?.hin ?? symbolDoc.words.hin }
          : {}),
      };

      await ctx.db.insert("profileSymbols", {
        accountId,
        profileCategoryId,
        order: symbolOrder++,
        imageSource: {
          type: "symbolstix",
          symbolId: symbolDoc._id,
        },
        label,
        ...(sym.display ? { display: sym.display } : {}),
        updatedAt: now,
      });
      symbolsAdded++;
    }
  }

  // TODO (next chunk): iterate pack.lists → insert profileLists rows
  // TODO (next chunk): iterate pack.sentences → insert profileSentences rows
  if (pack.lists.length > 0 || pack.sentences.length > 0) {
    console.warn(
      `[materialisePackIntoAccount] pack ${pack._id} has lists (${pack.lists.length}) or sentences (${pack.sentences.length}) — not yet implemented in foundation chunk; skipping`
    );
  }

  return {
    packId: pack._id,
    categoriesAdded,
    symbolsAdded,
    symbolsSkipped,
  };
}

/**
 * Fetch the canonical starter pack and materialise it into an account.
 * Exported so seedDefaultAccount can inline this without going through
 * ctx.runMutation. The internalMutation wrapper below (loadStarterTemplate)
 * exposes the same logic for direct dashboard testing.
 *
 * Returns { skipped: true } when no starter pack exists. Caller responsibility:
 * decide what to do (typically: log a warning, leave the account empty until
 * an admin runs migrations.materialiseStarterPack).
 */
export async function loadStarterTemplateInline(
  ctx: MutationCtx,
  accountId: Id<"users">
): Promise<
  | { skipped: true; reason: "no-starter-pack" }
  | {
      skipped: false;
      packId: Id<"resourcePacks">;
      categoriesAdded: number;
      symbolsAdded: number;
      symbolsSkipped: number;
    }
> {
  const starter = await ctx.db
    .query("resourcePacks")
    .withIndex("by_isStarter", (q) => q.eq("isStarter", true))
    .first();

  if (!starter) {
    console.warn(
      "[loadStarterTemplate] no starter pack — run migrations.materialiseStarterPack to populate"
    );
    return { skipped: true, reason: "no-starter-pack" };
  }

  const result = await materialisePackIntoAccount(ctx, accountId, starter);
  console.log(
    `[loadStarterTemplate] account ${accountId}: ${result.categoriesAdded} categories, ${result.symbolsAdded} symbols (${result.symbolsSkipped} skipped)`
  );
  return { skipped: false, ...result };
}

// ─── Public mutations ─────────────────────────────────────────────────────────

/**
 * Load a resource pack into the calling user's account.
 *
 * Plan gate: free-tier users are rejected unless they have customAccess.isActive.
 * The starter pack is loadable through this mutation too, but only by Pro+ —
 * free-tier accounts get the starter via loadStarterTemplate at signup, never
 * through this public path.
 */
export const loadResourcePack = mutation({
  args: { packId: v.id("resourcePacks") },
  handler: async (ctx, { packId }) => {
    const { accountId, user } = await requireCallerAccountId(ctx);

    if (!userHasFullAccess(user)) {
      throw new ConvexError({
        code: "TIER_REQUIRED",
        required: "pro",
        message:
          "Resource library requires Pro or Max plan. Upgrade to load this pack.",
      });
    }

    const pack = await ctx.db.get(packId);
    if (!pack) {
      throw new ConvexError({
        code: "PACK_NOT_FOUND",
        message: `Resource pack ${packId} not found.`,
      });
    }

    return await materialisePackIntoAccount(ctx, accountId, pack);
  },
});

// ─── Internal mutations ───────────────────────────────────────────────────────

/**
 * Internal-mutation wrapper exposing loadStarterTemplateInline for direct
 * dashboard invocation (testing / one-off recovery). Production callers
 * (seedDefaultAccount) use the helper directly.
 *
 * No plan gate — the starter pack is universally available, including to free-tier
 * users (every account gets seeded on signup).
 */
export const loadStarterTemplate = internalMutation({
  args: { accountId: v.id("users") },
  handler: async (ctx, { accountId }) => {
    return await loadStarterTemplateInline(ctx, accountId);
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get the canonical starter pack, or null if none exists.
 * Used by the materialisation tooling and (future) admin dashboard.
 */
export const getStarterPack = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("resourcePacks")
      .withIndex("by_isStarter", (q) => q.eq("isStarter", true))
      .first();
  },
});
