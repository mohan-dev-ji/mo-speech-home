import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  requireCallerAccountId,
  requireCallerIsAdmin,
} from "./lib/account";
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
 * Creates profileCategory + profileSymbol + profileList + profileSentence
 * records scoped to accountId, with librarySourceId set to the pack's _id.
 *
 * Exported so seedDefaultAccount can call it inline without going through
 * ctx.runMutation (this codebase doesn't use that pattern; cross-mutation
 * effects compose via shared async helpers).
 *
 * Loaded content is fully independent — the library is not touched again.
 * Loading the same pack twice creates duplicates (intentional — matches
 * "load again, get fresh copies" UX).
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
  listsAdded: number;
  sentencesAdded: number;
}> {
  const now = Date.now();
  let categoriesAdded = 0;
  let symbolsAdded = 0;
  let symbolsSkipped = 0;
  let listsAdded = 0;
  let sentencesAdded = 0;

  // ── Categories + symbols ────────────────────────────────────────────────
  // Find current max order for this account so we append rather than overlap.
  const lastCategory = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
    .order("desc")
    .first();
  let nextCategoryOrder = lastCategory ? lastCategory.order + 1 : 0;

  for (const cat of pack.categories ?? []) {
    const profileCategoryId = await ctx.db.insert("profileCategories", {
      accountId,
      name: cat.name,
      icon: cat.icon,
      colour: cat.colour,
      ...(cat.imagePath ? { imagePath: cat.imagePath } : {}),
      order: nextCategoryOrder++,
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
        eng: sym.labelOverride?.eng ?? symbolDoc.words.eng,
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

  // ── Lists ───────────────────────────────────────────────────────────────
  const lastList = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
    .order("desc")
    .first();
  let nextListOrder = lastList ? lastList.order + 1 : 0;

  for (const list of pack.lists) {
    // Re-resolve imagePath for symbolstix-sourced items so updates to the
    // global library propagate. Items without symbolId use snapshotted imagePath.
    const items = await Promise.all(
      list.items.map(async (item) => {
        let imagePath = item.imagePath;
        if (item.symbolId) {
          const sym = await ctx.db.get(item.symbolId as Id<"symbols">);
          if (sym) imagePath = sym.imagePath;
        }
        return {
          order: item.order,
          ...(imagePath !== undefined ? { imagePath } : {}),
          ...(item.description !== undefined
            ? { description: item.description }
            : {}),
          ...(item.audioPath !== undefined
            ? { audioPath: item.audioPath }
            : {}),
          ...(item.activeAudioSource !== undefined
            ? { activeAudioSource: item.activeAudioSource }
            : {}),
          ...(item.defaultAudioPath !== undefined
            ? { defaultAudioPath: item.defaultAudioPath }
            : {}),
          ...(item.generatedAudioPath !== undefined
            ? { generatedAudioPath: item.generatedAudioPath }
            : {}),
          ...(item.recordedAudioPath !== undefined
            ? { recordedAudioPath: item.recordedAudioPath }
            : {}),
          ...(item.imageSourceType !== undefined
            ? { imageSourceType: item.imageSourceType }
            : {}),
        };
      })
    );

    await ctx.db.insert("profileLists", {
      accountId,
      name: list.name,
      order: nextListOrder++,
      items,
      ...(list.displayFormat !== undefined
        ? { displayFormat: list.displayFormat }
        : {}),
      ...(list.showNumbers !== undefined
        ? { showNumbers: list.showNumbers }
        : {}),
      ...(list.showChecklist !== undefined
        ? { showChecklist: list.showChecklist }
        : {}),
      ...(list.showFirstThen !== undefined
        ? { showFirstThen: list.showFirstThen }
        : {}),
      librarySourceId: pack._id,
      updatedAt: now,
    });
    listsAdded++;
  }

  // ── Sentences ───────────────────────────────────────────────────────────
  const lastSentence = await ctx.db
    .query("profileSentences")
    .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
    .order("desc")
    .first();
  let nextSentenceOrder = lastSentence ? lastSentence.order + 1 : 0;

  for (const sentence of pack.sentences) {
    const slots = await Promise.all(
      sentence.slots.map(async (slot) => {
        let imagePath = slot.imagePath;
        if (slot.symbolId) {
          const sym = await ctx.db.get(slot.symbolId as Id<"symbols">);
          if (sym) imagePath = sym.imagePath;
        }
        return {
          order: slot.order,
          ...(imagePath !== undefined ? { imagePath } : {}),
          ...(slot.displayProps !== undefined
            ? { displayProps: slot.displayProps }
            : {}),
        };
      })
    );

    await ctx.db.insert("profileSentences", {
      accountId,
      name: sentence.name,
      order: nextSentenceOrder++,
      ...(sentence.text !== undefined ? { text: sentence.text } : {}),
      slots,
      ...(sentence.audioPath !== undefined
        ? { audioPath: sentence.audioPath }
        : {}),
      librarySourceId: pack._id,
      updatedAt: now,
    });
    sentencesAdded++;
  }

  return {
    packId: pack._id,
    categoriesAdded,
    symbolsAdded,
    symbolsSkipped,
    listsAdded,
    sentencesAdded,
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
      listsAdded: number;
      sentencesAdded: number;
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
    `[loadStarterTemplate] account ${accountId}: ${result.categoriesAdded} categories, ${result.symbolsAdded} symbols (${result.symbolsSkipped} skipped), ${result.listsAdded} lists, ${result.sentencesAdded} sentences`
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

// ─── Snapshot helpers (shared by save + makeDefault) ──────────────────────────

const DEFAULT_PACK_COVER = "static/pack-cover-default.webp";

type CategorySnapshot = NonNullable<Doc<"resourcePacks">["categories"]>[number];
type ListSnapshot = Doc<"resourcePacks">["lists"][number];
type SentenceSnapshot = Doc<"resourcePacks">["sentences"][number];

/**
 * Build a pack-snapshot category from a profileCategory + its profileSymbols.
 * V1 only snapshots symbolstix-typed symbols (per docs/1-inbox/ideas/06-resource-library.md).
 * Non-symbolstix symbols (uploads, AI-generated, image-search) are skipped — packs
 * are SymbolStix-only at this stage.
 */
async function buildCategorySnapshot(
  ctx: MutationCtx,
  category: Doc<"profileCategories">
): Promise<CategorySnapshot> {
  const symbols = await ctx.db
    .query("profileSymbols")
    .withIndex("by_profile_category_id_and_order", (q) =>
      q.eq("profileCategoryId", category._id)
    )
    .order("asc")
    .collect();

  const symbolSnapshot = symbols
    .filter((s) => s.imageSource.type === "symbolstix")
    .map((s, i) => {
      const src = s.imageSource as {
        type: "symbolstix";
        symbolId: Id<"symbols">;
      };
      return {
        symbolId: src.symbolId as string,
        // Always store the label as labelOverride — we don't know if it matches the
        // SymbolStix base without re-fetching, and storing it means re-materialise
        // is deterministic regardless of base-label changes.
        labelOverride: {
          eng: s.label.eng,
          ...(s.label.hin ? { hin: s.label.hin } : {}),
        },
        ...(s.display ? { display: s.display } : {}),
        order: i,
      };
    });

  return {
    sourceProfileCategoryId: category._id,
    name: category.name,
    icon: category.icon,
    colour: category.colour,
    ...(category.imagePath ? { imagePath: category.imagePath } : {}),
    symbols: symbolSnapshot,
  };
}

/**
 * Build a pack-snapshot list from a profileList. Items are snapshotted as-is —
 * V1 doesn't back-resolve symbolId from profileSymbols (deferred enhancement;
 * snapshot stores imagePath as source of truth).
 */
function buildListSnapshot(list: Doc<"profileLists">, order: number): ListSnapshot {
  return {
    sourceProfileListId: list._id,
    name: list.name,
    order,
    items: list.items.map((item) => ({
      order: item.order,
      ...(item.imagePath !== undefined ? { imagePath: item.imagePath } : {}),
      ...(item.description !== undefined
        ? { description: item.description }
        : {}),
      ...(item.audioPath !== undefined ? { audioPath: item.audioPath } : {}),
      ...(item.activeAudioSource !== undefined
        ? { activeAudioSource: item.activeAudioSource }
        : {}),
      ...(item.defaultAudioPath !== undefined
        ? { defaultAudioPath: item.defaultAudioPath }
        : {}),
      ...(item.generatedAudioPath !== undefined
        ? { generatedAudioPath: item.generatedAudioPath }
        : {}),
      ...(item.recordedAudioPath !== undefined
        ? { recordedAudioPath: item.recordedAudioPath }
        : {}),
      ...(item.imageSourceType !== undefined
        ? { imageSourceType: item.imageSourceType }
        : {}),
    })),
    ...(list.displayFormat !== undefined
      ? { displayFormat: list.displayFormat }
      : {}),
    ...(list.showNumbers !== undefined ? { showNumbers: list.showNumbers } : {}),
    ...(list.showChecklist !== undefined
      ? { showChecklist: list.showChecklist }
      : {}),
    ...(list.showFirstThen !== undefined
      ? { showFirstThen: list.showFirstThen }
      : {}),
  };
}

/**
 * Build a pack-snapshot sentence from a profileSentence. Slots are snapshotted as-is.
 */
function buildSentenceSnapshot(
  sentence: Doc<"profileSentences">,
  order: number
): SentenceSnapshot {
  return {
    sourceProfileSentenceId: sentence._id,
    name: sentence.name,
    order,
    ...(sentence.text !== undefined ? { text: sentence.text } : {}),
    slots: sentence.slots.map((slot) => ({
      order: slot.order,
      ...(slot.imagePath !== undefined ? { imagePath: slot.imagePath } : {}),
      ...(slot.displayProps !== undefined
        ? { displayProps: slot.displayProps }
        : {}),
    })),
    ...(sentence.audioPath !== undefined
      ? { audioPath: sentence.audioPath }
      : {}),
  };
}

/**
 * Get the canonical starter pack or throw.
 * Used by makeDefault* mutations. Doesn't auto-create — that's
 * migrations.materialiseStarterPack's job.
 */
async function getStarterPackOrThrow(
  ctx: MutationCtx
): Promise<Doc<"resourcePacks">> {
  const starter = await ctx.db
    .query("resourcePacks")
    .withIndex("by_isStarter", (q) => q.eq("isStarter", true))
    .first();
  if (!starter) {
    throw new ConvexError({
      code: "NO_STARTER_PACK",
      message:
        "No starter pack exists. Run migrations.materialiseStarterPack first.",
    });
  }
  return starter;
}

// ─── Sync helpers (auto-update + toggle on) ───────────────────────────────────
//
// Called from toggle mutations and from the various edit mutations across the
// codebase (profileCategories, profileSymbols, profileLists, profileSentences).
// No-op when the source row is not published; otherwise find-and-replace the
// snapshot entry by sourceProfile*Id and patch the pack. Exported.

/**
 * Sync a profileCategory's snapshot into its published pack. No-op if the
 * category is not published.
 *
 * Replacement logic ("adopt-or-append"):
 * - Drop any existing entry with the same `sourceProfileCategoryId` (this
 *   profile's prior snapshot — replace with fresh content).
 * - Drop any existing UNLINKED entry whose name matches (case-insensitive
 *   eng). These are recipe-derived entries from DEFAULT_CATEGORIES that the
 *   admin is now taking ownership of by toggling Default ON. Without this
 *   the toggle creates a duplicate alongside the recipe entry.
 * - Append the new snapshot.
 */
export async function syncCategoryToPackIfPublished(
  ctx: MutationCtx,
  profileCategoryId: Id<"profileCategories">
): Promise<void> {
  const category = await ctx.db.get(profileCategoryId);
  if (!category?.publishedToPackId) return;
  const pack = await ctx.db.get(category.publishedToPackId);
  if (!pack) return; // pack was deleted; orphan link, ignore

  const snapshot = await buildCategorySnapshot(ctx, category);
  const lowerName = category.name.eng.toLowerCase();

  const updated = (pack.categories ?? []).filter((c) => {
    if (c.sourceProfileCategoryId === profileCategoryId) return false;
    // Adopt unlinked recipe-derived entries with matching name.
    if (!c.sourceProfileCategoryId && c.name.eng.toLowerCase() === lowerName) {
      return false;
    }
    return true;
  });
  updated.push(snapshot);

  await ctx.db.patch(pack._id, {
    categories: updated,
    updatedAt: Date.now(),
  });
}

export async function syncListToPackIfPublished(
  ctx: MutationCtx,
  profileListId: Id<"profileLists">
): Promise<void> {
  const list = await ctx.db.get(profileListId);
  if (!list?.publishedToPackId) return;
  const pack = await ctx.db.get(list.publishedToPackId);
  if (!pack) return;

  const lowerName = list.name.eng.toLowerCase();

  // Same adopt-or-append logic as syncCategoryToPackIfPublished. See its
  // docstring for rationale.
  const remaining = pack.lists.filter((l) => {
    if (l.sourceProfileListId === profileListId) return false;
    if (!l.sourceProfileListId && l.name.eng.toLowerCase() === lowerName) {
      return false;
    }
    return true;
  });
  const snapshot = buildListSnapshot(list, remaining.length);

  await ctx.db.patch(pack._id, {
    lists: [...remaining, snapshot],
    updatedAt: Date.now(),
  });
}

export async function syncSentenceToPackIfPublished(
  ctx: MutationCtx,
  profileSentenceId: Id<"profileSentences">
): Promise<void> {
  const sentence = await ctx.db.get(profileSentenceId);
  if (!sentence?.publishedToPackId) return;
  const pack = await ctx.db.get(sentence.publishedToPackId);
  if (!pack) return;

  const lowerName = sentence.name.eng.toLowerCase();

  const remaining = pack.sentences.filter((s) => {
    if (s.sourceProfileSentenceId === profileSentenceId) return false;
    if (
      !s.sourceProfileSentenceId &&
      s.name.eng.toLowerCase() === lowerName
    ) {
      return false;
    }
    return true;
  });
  const snapshot = buildSentenceSnapshot(sentence, remaining.length);

  await ctx.db.patch(pack._id, {
    sentences: [...remaining, snapshot],
    updatedAt: Date.now(),
  });
}

// ─── Remove helpers (toggle off + cascade delete) ─────────────────────────────
//
// Remove the snapshot entry from the pack. If the pack becomes empty AND it's
// not the starter, delete the pack. Always clear publishedToPackId on the
// profile row. Exported.

export async function removeCategoryFromPack(
  ctx: MutationCtx,
  profileCategoryId: Id<"profileCategories">
): Promise<void> {
  const category = await ctx.db.get(profileCategoryId);
  if (!category?.publishedToPackId) return;
  const pack = await ctx.db.get(category.publishedToPackId);

  if (pack) {
    const updated = (pack.categories ?? []).filter(
      (c) => c.sourceProfileCategoryId !== profileCategoryId
    );
    const isEmpty =
      updated.length === 0 &&
      pack.lists.length === 0 &&
      pack.sentences.length === 0;

    if (isEmpty && !pack.isStarter) {
      await ctx.db.delete(pack._id);
    } else {
      await ctx.db.patch(pack._id, {
        categories: updated,
        updatedAt: Date.now(),
      });
    }
  }

  await ctx.db.patch(profileCategoryId, { publishedToPackId: undefined });
}

export async function removeListFromPack(
  ctx: MutationCtx,
  profileListId: Id<"profileLists">
): Promise<void> {
  const list = await ctx.db.get(profileListId);
  if (!list?.publishedToPackId) return;
  const pack = await ctx.db.get(list.publishedToPackId);

  if (pack) {
    const updated = pack.lists.filter(
      (l) => l.sourceProfileListId !== profileListId
    );
    const isEmpty =
      (pack.categories ?? []).length === 0 &&
      updated.length === 0 &&
      pack.sentences.length === 0;

    if (isEmpty && !pack.isStarter) {
      await ctx.db.delete(pack._id);
    } else {
      await ctx.db.patch(pack._id, {
        lists: updated,
        updatedAt: Date.now(),
      });
    }
  }

  await ctx.db.patch(profileListId, { publishedToPackId: undefined });
}

export async function removeSentenceFromPack(
  ctx: MutationCtx,
  profileSentenceId: Id<"profileSentences">
): Promise<void> {
  const sentence = await ctx.db.get(profileSentenceId);
  if (!sentence?.publishedToPackId) return;
  const pack = await ctx.db.get(sentence.publishedToPackId);

  if (pack) {
    const updated = pack.sentences.filter(
      (s) => s.sourceProfileSentenceId !== profileSentenceId
    );
    const isEmpty =
      (pack.categories ?? []).length === 0 &&
      pack.lists.length === 0 &&
      updated.length === 0;

    if (isEmpty && !pack.isStarter) {
      await ctx.db.delete(pack._id);
    } else {
      await ctx.db.patch(pack._id, {
        sentences: updated,
        updatedAt: Date.now(),
      });
    }
  }

  await ctx.db.patch(profileSentenceId, { publishedToPackId: undefined });
}

// ─── Toggle mutations (admin-only) ────────────────────────────────────────────
//
// Toggle membership in either the starter pack ("Default") or a non-starter
// library pack. Mutual exclusion: an item is in at most one pack. Server
// enforces (UI also disables the unavailable toggle for clarity).

const TIER_VALIDATOR = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("max")
);

/**
 * Toggle "Default" — starter-pack membership for a category.
 *
 * On: validates not already in a non-starter library pack, sets publishedToPackId
 * to the starter, then syncs the snapshot in.
 * Off: removes from starter and clears publishedToPackId.
 */
export const setCategoryDefault = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    on: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerIsAdmin(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    if (args.on) {
      const starter = await getStarterPackOrThrow(ctx);
      // Mutual exclusion: reject if already in a different (non-starter) pack.
      if (
        category.publishedToPackId &&
        category.publishedToPackId !== starter._id
      ) {
        throw new ConvexError({
          code: "ALREADY_IN_LIBRARY",
          message:
            "Toggle Library off first — items can only be in one pack at a time.",
        });
      }
      await ctx.db.patch(args.profileCategoryId, {
        publishedToPackId: starter._id,
      });
      await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);
      return { starterPackId: starter._id, action: "added" as const };
    } else {
      const starter = await getStarterPackOrThrow(ctx);
      // Idempotent: if it's already off (or in some other pack), no-op.
      if (category.publishedToPackId !== starter._id) {
        return { starterPackId: starter._id, action: "noop" as const };
      }
      await removeCategoryFromPack(ctx, args.profileCategoryId);
      return { starterPackId: starter._id, action: "removed" as const };
    }
  },
});

/**
 * Toggle "Library" — non-starter pack membership for a category.
 *
 * On: creates a new resourcePack containing just this category, with the
 * chosen tier; sets publishedToPackId. Rejects if already in any pack.
 * Off: removes from the linked pack (which deletes the pack since it's empty).
 */
export const setCategoryInLibrary = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    on: v.boolean(),
    tier: v.optional(TIER_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    if (args.on) {
      if (!args.tier) {
        throw new ConvexError({
          code: "TIER_REQUIRED",
          message: "Tier required when toggling Library on.",
        });
      }
      if (category.publishedToPackId) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }

      const snapshot = await buildCategorySnapshot(ctx, category);
      const now = Date.now();
      const packId = await ctx.db.insert("resourcePacks", {
        name: category.name,
        description: { eng: `Saved from ${category.name.eng}` },
        coverImagePath: category.imagePath ?? DEFAULT_PACK_COVER,
        tags: [],
        featured: false,
        tier: args.tier,
        createdBy: clerkUserId,
        updatedAt: now,
        categories: [snapshot],
        lists: [],
        sentences: [],
      });

      await ctx.db.patch(args.profileCategoryId, { publishedToPackId: packId });
      return { packId, tier: args.tier, action: "added" as const };
    } else {
      // Validate: not the starter pack
      if (!category.publishedToPackId) {
        return { action: "noop" as const };
      }
      const pack = await ctx.db.get(category.publishedToPackId);
      if (pack?.isStarter) {
        throw new ConvexError({
          code: "USE_DEFAULT_TOGGLE",
          message:
            "This category is in the starter pack — use the Default toggle to remove.",
        });
      }
      await removeCategoryFromPack(ctx, args.profileCategoryId);
      return { action: "removed" as const };
    }
  },
});

/**
 * Toggle "Default" for a list.
 */
export const setListDefault = mutation({
  args: {
    profileListId: v.id("profileLists"),
    on: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerIsAdmin(ctx);

    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "List not found." });
    }

    if (args.on) {
      const starter = await getStarterPackOrThrow(ctx);
      if (list.publishedToPackId && list.publishedToPackId !== starter._id) {
        throw new ConvexError({
          code: "ALREADY_IN_LIBRARY",
          message:
            "Toggle Library off first — items can only be in one pack at a time.",
        });
      }
      await ctx.db.patch(args.profileListId, {
        publishedToPackId: starter._id,
      });
      await syncListToPackIfPublished(ctx, args.profileListId);
      return { starterPackId: starter._id, action: "added" as const };
    } else {
      const starter = await getStarterPackOrThrow(ctx);
      if (list.publishedToPackId !== starter._id) {
        return { starterPackId: starter._id, action: "noop" as const };
      }
      await removeListFromPack(ctx, args.profileListId);
      return { starterPackId: starter._id, action: "removed" as const };
    }
  },
});

/**
 * Toggle "Library" for a list.
 */
export const setListInLibrary = mutation({
  args: {
    profileListId: v.id("profileLists"),
    on: v.boolean(),
    tier: v.optional(TIER_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "List not found." });
    }

    if (args.on) {
      if (!args.tier) {
        throw new ConvexError({
          code: "TIER_REQUIRED",
          message: "Tier required when toggling Library on.",
        });
      }
      if (list.publishedToPackId) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }

      const snapshot = buildListSnapshot(list, 0);
      const now = Date.now();
      const packId = await ctx.db.insert("resourcePacks", {
        name: list.name,
        description: { eng: `Saved from ${list.name.eng}` },
        coverImagePath: list.items[0]?.imagePath ?? DEFAULT_PACK_COVER,
        tags: [],
        featured: false,
        tier: args.tier,
        createdBy: clerkUserId,
        updatedAt: now,
        categories: [],
        lists: [snapshot],
        sentences: [],
      });

      await ctx.db.patch(args.profileListId, { publishedToPackId: packId });
      return { packId, tier: args.tier, action: "added" as const };
    } else {
      if (!list.publishedToPackId) {
        return { action: "noop" as const };
      }
      const pack = await ctx.db.get(list.publishedToPackId);
      if (pack?.isStarter) {
        throw new ConvexError({
          code: "USE_DEFAULT_TOGGLE",
          message:
            "This list is in the starter pack — use the Default toggle to remove.",
        });
      }
      await removeListFromPack(ctx, args.profileListId);
      return { action: "removed" as const };
    }
  },
});

/**
 * Toggle "Default" for a sentence.
 */
export const setSentenceDefault = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    on: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerIsAdmin(ctx);

    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sentence not found." });
    }

    if (args.on) {
      const starter = await getStarterPackOrThrow(ctx);
      if (
        sentence.publishedToPackId &&
        sentence.publishedToPackId !== starter._id
      ) {
        throw new ConvexError({
          code: "ALREADY_IN_LIBRARY",
          message:
            "Toggle Library off first — items can only be in one pack at a time.",
        });
      }
      await ctx.db.patch(args.profileSentenceId, {
        publishedToPackId: starter._id,
      });
      await syncSentenceToPackIfPublished(ctx, args.profileSentenceId);
      return { starterPackId: starter._id, action: "added" as const };
    } else {
      const starter = await getStarterPackOrThrow(ctx);
      if (sentence.publishedToPackId !== starter._id) {
        return { starterPackId: starter._id, action: "noop" as const };
      }
      await removeSentenceFromPack(ctx, args.profileSentenceId);
      return { starterPackId: starter._id, action: "removed" as const };
    }
  },
});

/**
 * Toggle "Library" for a sentence.
 */
export const setSentenceInLibrary = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    on: v.boolean(),
    tier: v.optional(TIER_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sentence not found." });
    }

    if (args.on) {
      if (!args.tier) {
        throw new ConvexError({
          code: "TIER_REQUIRED",
          message: "Tier required when toggling Library on.",
        });
      }
      if (sentence.publishedToPackId) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }

      const snapshot = buildSentenceSnapshot(sentence, 0);
      const now = Date.now();
      const packId = await ctx.db.insert("resourcePacks", {
        name: sentence.name,
        description: { eng: `Saved from ${sentence.name.eng}` },
        coverImagePath: sentence.slots[0]?.imagePath ?? DEFAULT_PACK_COVER,
        tags: [],
        featured: false,
        tier: args.tier,
        createdBy: clerkUserId,
        updatedAt: now,
        categories: [],
        lists: [],
        sentences: [snapshot],
      });

      await ctx.db.patch(args.profileSentenceId, {
        publishedToPackId: packId,
      });
      return { packId, tier: args.tier, action: "added" as const };
    } else {
      if (!sentence.publishedToPackId) {
        return { action: "noop" as const };
      }
      const pack = await ctx.db.get(sentence.publishedToPackId);
      if (pack?.isStarter) {
        throw new ConvexError({
          code: "USE_DEFAULT_TOGGLE",
          message:
            "This sentence is in the starter pack — use the Default toggle to remove.",
        });
      }
      await removeSentenceFromPack(ctx, args.profileSentenceId);
      return { action: "removed" as const };
    }
  },
});

/**
 * Update the tier on a non-starter library pack.
 * Used by the Free/Pro/Max picker in the admin row.
 */
export const setLibraryPackTier = mutation({
  args: {
    packId: v.id("resourcePacks"),
    tier: TIER_VALIDATOR,
  },
  handler: async (ctx, { packId, tier }) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);

    const pack = await ctx.db.get(packId);
    if (!pack) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pack not found." });
    }
    if (pack.isStarter) {
      throw new ConvexError({
        code: "STARTER_TIER_FIXED",
        message: "Starter pack tier is fixed at free.",
      });
    }
    if (pack.createdBy !== clerkUserId) {
      // Soft check — admins can't currently edit other admins' packs.
      // Tighten when multi-admin curation lands.
      throw new ConvexError({
        code: "NOT_OWNER",
        message: "You don't own this pack.",
      });
    }

    await ctx.db.patch(packId, { tier, updatedAt: Date.now() });
    return { packId, tier };
  },
});

// ─── Admin status query ───────────────────────────────────────────────────────

/**
 * Returns the data needed to render admin badges on items: the starter pack ID
 * and a map of all non-starter packs by ID. Components subscribe once at the
 * page level and pass derived status down — avoid one-query-per-item.
 */
export const getPacksForAdminStatus = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("resourcePacks").collect();
    let starterPackId: Id<"resourcePacks"> | null = null;
    const libraryPacksById: Record<
      string,
      { tier: "free" | "pro" | "max"; name: { eng: string; hin?: string } }
    > = {};

    for (const pack of all) {
      if (pack.isStarter) {
        starterPackId = pack._id;
      } else {
        libraryPacksById[pack._id] = {
          tier: pack.tier ?? "free",
          name: pack.name,
        };
      }
    }

    return { starterPackId, libraryPacksById };
  },
});

/**
 * Public catalogue query for the /[locale]/library page.
 *
 * Unauthenticated by design — the library is a discovery surface for cold visitors
 * (SEO, marketing). Returns only metadata + counts; snapshot bodies (categories,
 * lists, sentences arrays with symbol IDs and R2 paths) stay private to avoid
 * exposing SymbolStix-licensed asset paths to anonymous clients.
 *
 * Filters:
 * - Excludes expired seasonals (expiresAt && expiresAt < now)
 *
 * V1 has no draft/publish state: pack creation IS the publish action. Convex's
 * built-in `_creationTime` IS the publish time. When Phase 7 introduces an
 * explicit draft/published workflow, add a `status` field rather than layering
 * meaning on a nullable timestamp.
 *
 * The starter pack is included so logged-out visitors see it as the on-ramp;
 * the client renders "Already on your account" for signed-in users since they
 * were seeded with it.
 */
export const getPublicLibraryCatalogue = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const packs = await ctx.db.query("resourcePacks").collect();
    return packs
      .filter((p) => !p.expiresAt || p.expiresAt > now)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        description: p.description,
        coverImagePath: p.coverImagePath,
        season: p.season,
        tags: p.tags,
        featured: p.featured,
        tier: (p.tier ?? "free") as "free" | "pro" | "max",
        isStarter: p.isStarter ?? false,
        counts: {
          categories: p.categories?.length ?? 0,
          lists: p.lists.length,
          sentences: p.sentences.length,
        },
      }));
  },
});
