import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  requireCallerAccountId,
  requireCallerIsAdmin,
  resolveCallerAccountId,
} from "./lib/account";
import { tierFromPlan } from "./users";
import {
  getAllLibraryPacks,
  getLibraryPackBySlug,
  getStarterLibraryPack,
} from "./lib/libraryPacks";
import type {
  LibraryPack,
  LibraryPackCategorySymbol,
} from "./data/library_packs/types";

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
 * Type alias for the symbols-array shape inside a category snapshot.
 */
type CategorySnapshotSymbols = NonNullable<
  Doc<"resourcePacks">["categories"]
>[number]["symbols"];

/**
 * Materialise a category snapshot's symbols into an existing profileCategory.
 * Shared by:
 *   - materialisePackIntoAccount (initial pack load)
 *   - reloadCategoryFromLibrary (per-category reset)
 *
 * Symbol skipping: if a snapshot references a global symbols row that has
 * since been deleted, that single symbol is skipped (no fail). Partial loads
 * are preferred over no-load.
 */
export async function materialiseSymbolsFromCategorySnapshot(
  ctx: MutationCtx,
  accountId: Id<"users">,
  profileCategoryId: Id<"profileCategories">,
  snapshotSymbols: CategorySnapshotSymbols,
  now: number
): Promise<{ symbolsAdded: number; symbolsSkipped: number }> {
  let symbolsAdded = 0;
  let symbolsSkipped = 0;
  let symbolOrder = 0;

  for (const sym of snapshotSymbols) {
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

  return { symbolsAdded, symbolsSkipped };
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
      // Capture the snapshot's original name as a stable join key for
      // reloadCategoryFromLibrary — survives instructor renames.
      librarySourceCategoryKey: cat.name.eng,
      updatedAt: now,
    });
    categoriesAdded++;

    const result = await materialiseSymbolsFromCategorySnapshot(
      ctx,
      accountId,
      profileCategoryId,
      cat.symbols,
      now
    );
    symbolsAdded += result.symbolsAdded;
    symbolsSkipped += result.symbolsSkipped;
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

// ─── V2 (ADR-010): JSON pack materialisation ────────────────────────────────
//
// `materialisePackFromJson` mirrors `materialisePackIntoAccount` but consumes
// the `LibraryPack` JSON shape (no Convex Ids) and uses the pack's `slug`
// string as `librarySourceId` on the created profile rows. Replaces the V1
// helper across all consumers in Phase 5; V1 stays in place until the
// deferred Phase X cleanup so we can roll back if needed.
//
// Reload-defaults flow note: V1 callers pass a Convex `Id<"resourcePacks">`
// to `librarySourceId`; V2 callers pass a slug string. The reload helper
// in `convex/profileCategories.ts` will need to handle both shapes during
// the transition (or be lifted to slug-only after Phase X). Captured here
// to surface during Phase 6/X review.

/**
 * Materialise SymbolStix symbols from a JSON pack's category snapshot into
 * an existing `profileCategory`. Mirrors `materialiseSymbolsFromCategorySnapshot`
 * but consumes the JSON shape (slug-based, no Convex Ids in the snapshot).
 *
 * Symbols are looked up by `symbolId` (loose ref string → Convex `symbols` Id).
 * Missing symbols are skipped, never thrown, so partial loads beat no load.
 */
async function materialiseSymbolsFromJson(
  ctx: MutationCtx,
  accountId: Id<"users">,
  profileCategoryId: Id<"profileCategories">,
  symbols: LibraryPackCategorySymbol[],
  now: number
): Promise<{ symbolsAdded: number; symbolsSkipped: number }> {
  let symbolsAdded = 0;
  let symbolsSkipped = 0;
  let symbolOrder = 0;

  for (const sym of symbols) {
    const symbolDoc = await ctx.db.get(sym.symbolId as Id<"symbols">);
    if (!symbolDoc) {
      symbolsSkipped++;
      continue;
    }

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

  return { symbolsAdded, symbolsSkipped };
}

/**
 * Materialise a JSON `LibraryPack`'s content into an account. Mirrors
 * `materialisePackIntoAccount` exactly in shape; the only differences are
 * (a) it consumes the JSON shape (no Convex Ids in the snapshot), and
 * (b) it sets `librarySourceId = pack.slug` (string) on every created row.
 *
 * Same "loaded content is fully independent" semantics — loading the same
 * pack twice creates duplicates intentionally.
 */
export async function materialisePackFromJson(
  ctx: MutationCtx,
  accountId: Id<"users">,
  pack: LibraryPack
): Promise<{
  slug: string;
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
      librarySourceId: pack.slug,
      librarySourceCategoryKey: cat.name.eng,
      updatedAt: now,
    });
    categoriesAdded++;

    const result = await materialiseSymbolsFromJson(
      ctx,
      accountId,
      profileCategoryId,
      cat.symbols,
      now
    );
    symbolsAdded += result.symbolsAdded;
    symbolsSkipped += result.symbolsSkipped;
  }

  // ── Lists ───────────────────────────────────────────────────────────────
  const lastList = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
    .order("desc")
    .first();
  let nextListOrder = lastList ? lastList.order + 1 : 0;

  for (const list of pack.lists) {
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
      librarySourceId: pack.slug,
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
      librarySourceId: pack.slug,
      updatedAt: now,
    });
    sentencesAdded++;
  }

  return {
    slug: pack.slug,
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

/**
 * V2: Fetch the JSON starter pack and materialise it into an account. Mirrors
 * `loadStarterTemplateInline` but reads from the bundled JSON catalogue
 * (`convex/data/library_packs/_starter.json`) rather than the `resourcePacks`
 * table. Used by `seedDefaultAccount` post-cutover.
 *
 * Returns `{ skipped: true }` when no starter is in the catalogue — caller
 * decides what to do (typically: log a warning, leave the account empty
 * until a starter pack ships in the JSON).
 */
export async function loadStarterTemplateInlineV2(
  ctx: MutationCtx,
  accountId: Id<"users">
): Promise<
  | { skipped: true; reason: "no-starter-pack" }
  | {
      skipped: false;
      slug: string;
      categoriesAdded: number;
      symbolsAdded: number;
      symbolsSkipped: number;
      listsAdded: number;
      sentencesAdded: number;
    }
> {
  const starter = getStarterLibraryPack();
  if (!starter) {
    console.warn(
      "[loadStarterTemplateV2] no starter pack in JSON catalogue — check convex/data/library_packs/_starter.json"
    );
    return { skipped: true, reason: "no-starter-pack" };
  }

  const result = await materialisePackFromJson(ctx, accountId, starter);
  console.log(
    `[loadStarterTemplateV2] account ${accountId}: ${result.categoriesAdded} categories, ${result.symbolsAdded} symbols (${result.symbolsSkipped} skipped), ${result.listsAdded} lists, ${result.sentencesAdded} sentences`
  );
  return { skipped: false, ...result };
}

/**
 * Collect the set of resourcePack IDs (as raw strings) the account already has
 * at least one materialised row linked to, across profileCategories,
 * profileLists, and profileSentences. `librarySourceId` is stored as
 * `v.optional(v.string())` so we keep raw strings here and let callers cast.
 */
async function collectLoadedPackIds(
  ctx: QueryCtx,
  accountId: Id<"users">
): Promise<Set<string>> {
  const [categories, lists, sentences] = await Promise.all([
    ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect(),
    ctx.db
      .query("profileLists")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect(),
    ctx.db
      .query("profileSentences")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect(),
  ]);

  const ids = new Set<string>();
  for (const c of categories) if (c.librarySourceId) ids.add(c.librarySourceId);
  for (const l of lists) if (l.librarySourceId) ids.add(l.librarySourceId);
  for (const s of sentences) if (s.librarySourceId) ids.add(s.librarySourceId);
  return ids;
}

// ─── Public mutations ─────────────────────────────────────────────────────────

/**
 * Load a resource pack into the calling user's account.
 *
 * Plan gate: free-tier users are rejected unless they have customAccess.isActive.
 * The starter pack is loadable through this mutation too, but only by Pro+ —
 * free-tier accounts get the starter via loadStarterTemplate at signup, never
 * through this public path.
 *
 * Dedup gate: rejects with ALREADY_LOADED if the account has any
 * profileCategory/List/Sentence already linked back to this pack via
 * librarySourceId. Account-scoped per ADR-008 — re-loading on a fresh profile
 * is currently out of scope.
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

    const loadedPackIds = await collectLoadedPackIds(ctx, accountId);
    if (loadedPackIds.has(packId)) {
      throw new ConvexError({
        code: "ALREADY_LOADED",
        message: "This pack is already loaded into your account.",
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

/**
 * V2: Internal-mutation wrapper exposing loadStarterTemplateInlineV2 for
 * direct dashboard invocation (testing / one-off recovery). Production
 * callers (seedDefaultAccount post-cutover) use the helper directly.
 *
 * No plan gate — the starter pack is universally available.
 */
export const loadStarterTemplateV2 = internalMutation({
  args: { accountId: v.id("users") },
  handler: async (ctx, { accountId }) => {
    return await loadStarterTemplateInlineV2(ctx, accountId);
  },
});

/**
 * V2: Load a pack from the JSON catalogue into the calling user's account.
 * Mirrors `loadResourcePack` but takes a slug + reads the bundled JSON
 * instead of the `resourcePacks` table.
 *
 * Tier gating: free-tier users without `customAccess.isActive` are rejected
 * unless the pack is the starter (which gets loaded via `loadStarterTemplateV2`
 * during signup anyway). Tier override on the `packLifecycle` row takes
 * precedence over the pack's `defaultTier`.
 *
 * Dedup gate: rejects with ALREADY_LOADED if the caller's account has at
 * least one profile row linked back to this slug via `librarySourceId`.
 * After Phase 5 cutover, V2 stores slug strings in `librarySourceId`; pre-
 * cutover V1 loads stored Convex Ids — those won't match a V2 slug check,
 * so a freshly-cut-over account could load V1-previously-loaded packs
 * again under V2. Acceptable during the dev cutover window since the
 * deployment is wipeable.
 */
export const loadResourcePackV2 = mutation({
  args: { packSlug: v.string() },
  handler: async (ctx, { packSlug }) => {
    const { accountId, user } = await requireCallerAccountId(ctx);

    const pack = getLibraryPackBySlug(packSlug);
    if (!pack) {
      throw new ConvexError({
        code: "PACK_NOT_FOUND",
        message: `Resource pack "${packSlug}" not found in the JSON catalogue.`,
      });
    }

    // Lifecycle row: required for non-starter packs to be loadable. Starter
    // bypasses the gate so signup seeding works even before any lifecycle
    // rows are created.
    const lifecycle = await ctx.db
      .query("packLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", packSlug))
      .first();

    if (!pack.isStarter) {
      if (!lifecycle) {
        throw new ConvexError({
          code: "PACK_NOT_PUBLISHED",
          message: `Resource pack "${packSlug}" exists but has no lifecycle row — not yet published.`,
        });
      }
      const now = Date.now();
      if (lifecycle.publishedAt === undefined || lifecycle.publishedAt > now) {
        throw new ConvexError({
          code: "PACK_NOT_PUBLISHED",
          message: `Resource pack "${packSlug}" is not yet published.`,
        });
      }
      if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now) {
        throw new ConvexError({
          code: "PACK_EXPIRED",
          message: `Resource pack "${packSlug}" has expired.`,
        });
      }
    }

    // Tier gate: starter bypasses; everything else requires Pro+ unless the
    // effective tier (override beats default) is 'free'.
    if (!pack.isStarter) {
      const effectiveTier =
        lifecycle?.tierOverride ?? pack.defaultTier;
      if (effectiveTier !== "free" && !userHasFullAccess(user)) {
        throw new ConvexError({
          code: "TIER_REQUIRED",
          required: effectiveTier,
          message:
            "Resource library requires Pro or Max plan. Upgrade to load this pack.",
        });
      }
    }

    const loadedPackIds = await collectLoadedPackIds(ctx, accountId);
    if (loadedPackIds.has(packSlug)) {
      throw new ConvexError({
        code: "ALREADY_LOADED",
        message: "This pack is already loaded into your account.",
      });
    }

    return await materialisePackFromJson(ctx, accountId, pack);
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return the set of resourcePack IDs the caller has already loaded into their
 * account. Used by LoadPackButton to disable the "Load into profile" CTA for
 * packs the user (or DEFAULT_CATEGORIES seeding via the toggle-publish flow)
 * has materialised content from.
 *
 * Returns an empty array for unauthenticated callers — the public library
 * page renders before sign-in too. Order is not meaningful; consumers should
 * treat the result as a set.
 */
export const getMyLoadedPackIds = query({
  args: {},
  handler: async (ctx): Promise<Id<"resourcePacks">[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const ids = await collectLoadedPackIds(ctx, resolved.accountId);
    return Array.from(ids) as Id<"resourcePacks">[];
  },
});

/**
 * V2 dedup query: every pack slug the caller's account has at least one
 * profile row linked to via `librarySourceId`. Used by V2 `LoadPackButton`
 * to disable the "Load into profile" CTA for already-loaded packs.
 *
 * Reads the same `librarySourceId` field as `getMyLoadedPackIds`; the
 * value is `v.optional(v.string())` in the schema so it holds either a
 * pre-cutover Convex Id (legacy V1 loads) or a post-cutover slug. Callers
 * comparing slugs to this set work correctly post-cutover; pre-cutover
 * legacy Ids show up here but won't match any slug, which is fine.
 */
export const getMyLoadedPackSlugs = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const ids = await collectLoadedPackIds(ctx, resolved.accountId);
    return Array.from(ids);
  },
});

/**
 * Pack metadata (id + name) for every pack the caller's account has at
 * least one row loaded from. Powers the pack-filter dropdown on the
 * categories / lists / sentences listings in instructor and student
 * view. Returns `[]` for unauthenticated callers or accounts with no
 * loaded packs — client gates rendering on length > 0.
 *
 * Sort: alphabetical by English pack name for stable display order.
 */
export const getLoadedPacksForCurrentAccount = query({
  args: {},
  handler: async (
    ctx
  ): Promise<Array<{ _id: Id<"resourcePacks">; name: { eng: string; hin?: string } }>> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const ids = await collectLoadedPackIds(ctx, resolved.accountId);

    const out: Array<{ _id: Id<"resourcePacks">; name: { eng: string; hin?: string } }> = [];
    for (const id of ids) {
      const pack = await ctx.db.get(id as Id<"resourcePacks">);
      if (pack) out.push({ _id: pack._id, name: pack.name });
    }
    out.sort((a, b) => a.name.eng.localeCompare(b.name.eng));
    return out;
  },
});

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

/**
 * Return every `resourcePacks` row in full — used by the ADR-010 migration
 * script (`scripts/pack-migrate.mjs`) to dump existing pack content into
 * JSON files. Sorted with the starter pack first, then alphabetical by
 * English name for stable filenames in the catalogue.
 *
 * Public on purpose: pack content is meant to be public after publish, and
 * this query is invoked via `npx convex run` from the dashboard or a local
 * Node script. Mirrors `getStarterPack`'s exposure model.
 */
export const getAllResourcePacks = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("resourcePacks").collect();
    rows.sort((a, b) => {
      if (a.isStarter && !b.isStarter) return -1;
      if (b.isStarter && !a.isStarter) return 1;
      return a.name.eng.localeCompare(b.name.eng);
    });
    return rows;
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

// Discriminated target for setItemInLibrary toggle-on. Either mints a new pack
// with the given name + tier, or appends the snapshot to an existing pack the
// admin owns. Cover image is derived from the source item on 'create'; on
// 'append' the existing pack's cover is left alone.
const TARGET_VALIDATOR = v.union(
  v.object({
    mode: v.literal("create"),
    name: v.object({
      eng: v.string(),
      hin: v.optional(v.string()),
    }),
    tier: TIER_VALIDATOR,
  }),
  v.object({
    mode: v.literal("append"),
    packId: v.id("resourcePacks"),
  })
);

/**
 * Resolve a `target` to a packId — either create a new pack (empty arrays;
 * snapshot is appended afterwards by the caller's sync helper) or validate
 * the admin owns the chosen existing pack and return its id.
 */
async function resolveTargetPack(
  ctx: MutationCtx,
  target:
    | {
        mode: "create";
        name: { eng: string; hin?: string };
        tier: "free" | "pro" | "max";
      }
    | { mode: "append"; packId: Id<"resourcePacks"> },
  fallbackCoverImagePath: string,
  clerkUserId: string
): Promise<Id<"resourcePacks">> {
  if (target.mode === "create") {
    const now = Date.now();
    return await ctx.db.insert("resourcePacks", {
      name: target.name,
      description: { eng: `Curated by an admin` },
      coverImagePath: fallbackCoverImagePath,
      tags: [],
      featured: false,
      tier: target.tier,
      createdBy: clerkUserId,
      updatedAt: now,
      categories: [],
      lists: [],
      sentences: [],
    });
  }

  // mode === 'append'
  const pack = await ctx.db.get(target.packId);
  if (!pack) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Target pack not found.",
    });
  }
  if (pack.isStarter) {
    throw new ConvexError({
      code: "STARTER_NOT_APPENDABLE",
      message: "Use the Default toggle to add to the starter pack.",
    });
  }
  if (pack.createdBy !== clerkUserId) {
    throw new ConvexError({
      code: "NOT_OWNER",
      message: "You don't own this pack.",
    });
  }
  return pack._id;
}

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
 * On: requires `target`. Either mints a new pack (mode: 'create') with the
 * chosen name + tier, or appends the snapshot to an existing pack the admin
 * owns (mode: 'append'). Rejects if the category is already in any pack.
 * Off: removes from the linked pack (which deletes the pack if it goes empty).
 */
export const setCategoryInLibrary = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    on: v.boolean(),
    target: v.optional(TARGET_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    if (args.on) {
      if (!args.target) {
        throw new ConvexError({
          code: "TARGET_REQUIRED",
          message: "Target required when toggling Library on.",
        });
      }
      if (category.publishedToPackId) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }

      const packId = await resolveTargetPack(
        ctx,
        args.target,
        category.imagePath ?? DEFAULT_PACK_COVER,
        clerkUserId
      );
      await ctx.db.patch(args.profileCategoryId, { publishedToPackId: packId });
      // syncCategoryToPackIfPublished reads back, builds a fresh snapshot,
      // and appends (replacing any prior entry for this source). Works for
      // both create (empty pack) and append (pack with prior content).
      await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);
      return { packId, action: "added" as const };
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
 * Toggle "Library" for a list. See setCategoryInLibrary for target shape.
 */
export const setListInLibrary = mutation({
  args: {
    profileListId: v.id("profileLists"),
    on: v.boolean(),
    target: v.optional(TARGET_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "List not found." });
    }

    if (args.on) {
      if (!args.target) {
        throw new ConvexError({
          code: "TARGET_REQUIRED",
          message: "Target required when toggling Library on.",
        });
      }
      if (list.publishedToPackId) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }

      const packId = await resolveTargetPack(
        ctx,
        args.target,
        list.items[0]?.imagePath ?? DEFAULT_PACK_COVER,
        clerkUserId
      );
      await ctx.db.patch(args.profileListId, { publishedToPackId: packId });
      await syncListToPackIfPublished(ctx, args.profileListId);
      return { packId, action: "added" as const };
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
 * Toggle "Library" for a sentence. See setCategoryInLibrary for target shape.
 */
export const setSentenceInLibrary = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    on: v.boolean(),
    target: v.optional(TARGET_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sentence not found." });
    }

    if (args.on) {
      if (!args.target) {
        throw new ConvexError({
          code: "TARGET_REQUIRED",
          message: "Target required when toggling Library on.",
        });
      }
      if (sentence.publishedToPackId) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }

      const packId = await resolveTargetPack(
        ctx,
        args.target,
        sentence.slots[0]?.imagePath ?? DEFAULT_PACK_COVER,
        clerkUserId
      );
      await ctx.db.patch(args.profileSentenceId, {
        publishedToPackId: packId,
      });
      await syncSentenceToPackIfPublished(ctx, args.profileSentenceId);
      return { packId, action: "added" as const };
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

// ─── V2 (ADR-010): JSON-pack-shaped toggle mutations ─────────────────────────
//
// These replace the V1 toggle mutations above for the new JSON-first authoring
// flow. They:
//  - Write `packSlug` (string) on the profile row instead of `publishedToPackId`
//    (Convex Id).
//  - Create / look up a `packLifecycle` row by slug for visibility metadata.
//  - **Do not touch `resourcePacks`** — content is owned by JSON files, written
//    by the `/api/admin/pack-publish` Next.js route after the modal Save click.
//  - Have no sync helpers — there's nothing to sync because no Convex row holds
//    the content snapshot.
//
// V1 mutations stay in place during the cutover as a rollback safety net (per
// ADR-010 §2). They will be deleted in the deferred Phase X.

const TARGET_VALIDATOR_V2 = v.union(
  v.object({
    mode: v.literal("create"),
    slug: v.string(),
    name: v.object({
      eng: v.string(),
      hin: v.optional(v.string()),
    }),
    description: v.optional(
      v.object({
        eng: v.string(),
        hin: v.optional(v.string()),
      })
    ),
    tier: TIER_VALIDATOR,
  }),
  v.object({
    mode: v.literal("append"),
    slug: v.string(),
  })
);

const STARTER_SLUG = "_starter";

/**
 * Look up or create the starter lifecycle row. Returns the slug. The starter
 * is special: `loadResourcePackV2` bypasses the lifecycle check for it, so
 * the row only matters for admin-status lookups. We create it lazily so
 * fresh deployments don't need a separate seed step.
 */
async function ensureStarterLifecycle(
  ctx: MutationCtx,
  clerkUserId: string
): Promise<string> {
  const existing = await ctx.db
    .query("packLifecycle")
    .withIndex("by_slug", (q) => q.eq("slug", STARTER_SLUG))
    .first();
  if (existing) return STARTER_SLUG;

  // Pull name / description / cover from the JSON starter so the lifecycle
  // row is self-describing even if the picker reads it before next publish.
  const starterJson = getStarterLibraryPack();
  const now = Date.now();
  await ctx.db.insert("packLifecycle", {
    slug: STARTER_SLUG,
    ...(starterJson ? { name: starterJson.name } : {}),
    ...(starterJson ? { description: starterJson.description } : {}),
    ...(starterJson ? { coverImagePath: starterJson.coverImagePath } : {}),
    publishedAt: now,
    featured: false,
    createdBy: clerkUserId,
    updatedAt: now,
  });
  return STARTER_SLUG;
}

/**
 * Resolve a V2 target to a slug. For 'create', validates the slug isn't
 * taken and inserts a new lifecycle row. For 'append', validates the
 * caller owns the existing lifecycle row.
 */
async function resolveTargetLifecycleV2(
  ctx: MutationCtx,
  target:
    | {
        mode: "create";
        slug: string;
        name: { eng: string; hin?: string };
        description?: { eng: string; hin?: string };
        tier: "free" | "pro" | "max";
      }
    | { mode: "append"; slug: string },
  clerkUserId: string
): Promise<string> {
  if (target.mode === "create") {
    // Validate slug shape — must be Convex-path-safe (alphanumeric +
    // underscores + periods, no hyphens) and not collide with the starter.
    if (!/^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/.test(target.slug)) {
      throw new ConvexError({
        code: "INVALID_SLUG",
        message:
          "Slug must be lowercase alphanumeric with underscores only — no hyphens or spaces.",
      });
    }
    if (target.slug === STARTER_SLUG) {
      throw new ConvexError({
        code: "RESERVED_SLUG",
        message: "Slug '_starter' is reserved for the starter pack.",
      });
    }
    const collision = await ctx.db
      .query("packLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", target.slug))
      .first();
    if (collision) {
      throw new ConvexError({
        code: "SLUG_TAKEN",
        message: `Slug "${target.slug}" already exists. Pick a different one.`,
      });
    }

    const now = Date.now();
    await ctx.db.insert("packLifecycle", {
      slug: target.slug,
      name: target.name,
      ...(target.description ? { description: target.description } : {}),
      // Set publishedAt = now so the pack is immediately visible on /library
      // post-publish. Phase 7 admin dashboard will let the admin override
      // (e.g. schedule a Halloween pack to go live on Oct 25).
      publishedAt: now,
      featured: false,
      tierOverride: target.tier,
      createdBy: clerkUserId,
      updatedAt: now,
    });
    return target.slug;
  }

  // mode === 'append'
  const lifecycle = await ctx.db
    .query("packLifecycle")
    .withIndex("by_slug", (q) => q.eq("slug", target.slug))
    .first();
  if (!lifecycle) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `Pack "${target.slug}" not found.`,
    });
  }
  if (lifecycle.slug === STARTER_SLUG) {
    throw new ConvexError({
      code: "STARTER_NOT_APPENDABLE",
      message: "Use the Default toggle to add to the starter pack.",
    });
  }
  if (lifecycle.createdBy !== clerkUserId) {
    throw new ConvexError({
      code: "NOT_OWNER",
      message: "You don't own this pack.",
    });
  }
  return lifecycle.slug;
}

/**
 * V2: Toggle "Default" — starter-pack membership for a category. Writes
 * the slug to `packSlug` instead of touching `resourcePacks`. JSON publish
 * happens via the API route after the modal closes.
 */
export const setCategoryDefaultV2 = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    on: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    if (args.on) {
      if (category.packSlug && category.packSlug !== STARTER_SLUG) {
        throw new ConvexError({
          code: "ALREADY_IN_LIBRARY",
          message:
            "Toggle Library off first — items can only be in one pack at a time.",
        });
      }
      const slug = await ensureStarterLifecycle(ctx, clerkUserId);
      await ctx.db.patch(args.profileCategoryId, {
        packSlug: slug,
        updatedAt: Date.now(),
      });
      return { slug, action: "added" as const };
    } else {
      if (category.packSlug !== STARTER_SLUG) {
        return { slug: STARTER_SLUG, action: "noop" as const };
      }
      await ctx.db.patch(args.profileCategoryId, {
        packSlug: undefined,
        updatedAt: Date.now(),
      });
      return { slug: STARTER_SLUG, action: "removed" as const };
    }
  },
});

/**
 * V2: Toggle "Library" — non-starter pack membership for a category.
 *
 * On: requires `target`. Either creates a new lifecycle row (mode: 'create')
 * with the chosen slug + name + tier, or links to an existing lifecycle row
 * the admin owns (mode: 'append'). Rejects if the category is already
 * published to any pack.
 *
 * Off: clears `packSlug` (the JSON pack content remains until the next
 * `pack-publish` runs and observes no source rows).
 */
export const setCategoryInLibraryV2 = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    on: v.boolean(),
    target: v.optional(TARGET_VALIDATOR_V2),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || category.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    if (args.on) {
      if (!args.target) {
        throw new ConvexError({
          code: "TARGET_REQUIRED",
          message: "Target required when toggling Library on.",
        });
      }
      if (category.packSlug) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }
      const slug = await resolveTargetLifecycleV2(ctx, args.target, clerkUserId);
      await ctx.db.patch(args.profileCategoryId, {
        packSlug: slug,
        updatedAt: Date.now(),
      });
      return { slug, action: "added" as const };
    } else {
      if (!category.packSlug) {
        return { action: "noop" as const };
      }
      if (category.packSlug === STARTER_SLUG) {
        throw new ConvexError({
          code: "USE_DEFAULT_TOGGLE",
          message:
            "This category is in the starter pack — use the Default toggle to remove.",
        });
      }
      await ctx.db.patch(args.profileCategoryId, {
        packSlug: undefined,
        updatedAt: Date.now(),
      });
      return { action: "removed" as const };
    }
  },
});

/** V2: Toggle "Default" for a list. Mirrors `setCategoryDefaultV2`. */
export const setListDefaultV2 = mutation({
  args: {
    profileListId: v.id("profileLists"),
    on: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "List not found." });
    }

    if (args.on) {
      if (list.packSlug && list.packSlug !== STARTER_SLUG) {
        throw new ConvexError({
          code: "ALREADY_IN_LIBRARY",
          message:
            "Toggle Library off first — items can only be in one pack at a time.",
        });
      }
      const slug = await ensureStarterLifecycle(ctx, clerkUserId);
      await ctx.db.patch(args.profileListId, {
        packSlug: slug,
        updatedAt: Date.now(),
      });
      return { slug, action: "added" as const };
    } else {
      if (list.packSlug !== STARTER_SLUG) {
        return { slug: STARTER_SLUG, action: "noop" as const };
      }
      await ctx.db.patch(args.profileListId, {
        packSlug: undefined,
        updatedAt: Date.now(),
      });
      return { slug: STARTER_SLUG, action: "removed" as const };
    }
  },
});

/** V2: Toggle "Library" for a list. Mirrors `setCategoryInLibraryV2`. */
export const setListInLibraryV2 = mutation({
  args: {
    profileListId: v.id("profileLists"),
    on: v.boolean(),
    target: v.optional(TARGET_VALIDATOR_V2),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const list = await ctx.db.get(args.profileListId);
    if (!list || list.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "List not found." });
    }

    if (args.on) {
      if (!args.target) {
        throw new ConvexError({
          code: "TARGET_REQUIRED",
          message: "Target required when toggling Library on.",
        });
      }
      if (list.packSlug) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }
      const slug = await resolveTargetLifecycleV2(ctx, args.target, clerkUserId);
      await ctx.db.patch(args.profileListId, {
        packSlug: slug,
        updatedAt: Date.now(),
      });
      return { slug, action: "added" as const };
    } else {
      if (!list.packSlug) return { action: "noop" as const };
      if (list.packSlug === STARTER_SLUG) {
        throw new ConvexError({
          code: "USE_DEFAULT_TOGGLE",
          message:
            "This list is in the starter pack — use the Default toggle to remove.",
        });
      }
      await ctx.db.patch(args.profileListId, {
        packSlug: undefined,
        updatedAt: Date.now(),
      });
      return { action: "removed" as const };
    }
  },
});

/** V2: Toggle "Default" for a sentence. Mirrors `setCategoryDefaultV2`. */
export const setSentenceDefaultV2 = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    on: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sentence not found." });
    }

    if (args.on) {
      if (sentence.packSlug && sentence.packSlug !== STARTER_SLUG) {
        throw new ConvexError({
          code: "ALREADY_IN_LIBRARY",
          message:
            "Toggle Library off first — items can only be in one pack at a time.",
        });
      }
      const slug = await ensureStarterLifecycle(ctx, clerkUserId);
      await ctx.db.patch(args.profileSentenceId, {
        packSlug: slug,
        updatedAt: Date.now(),
      });
      return { slug, action: "added" as const };
    } else {
      if (sentence.packSlug !== STARTER_SLUG) {
        return { slug: STARTER_SLUG, action: "noop" as const };
      }
      await ctx.db.patch(args.profileSentenceId, {
        packSlug: undefined,
        updatedAt: Date.now(),
      });
      return { slug: STARTER_SLUG, action: "removed" as const };
    }
  },
});

/** V2: Toggle "Library" for a sentence. Mirrors `setCategoryInLibraryV2`. */
export const setSentenceInLibraryV2 = mutation({
  args: {
    profileSentenceId: v.id("profileSentences"),
    on: v.boolean(),
    target: v.optional(TARGET_VALIDATOR_V2),
  },
  handler: async (ctx, args) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const sentence = await ctx.db.get(args.profileSentenceId);
    if (!sentence || sentence.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sentence not found." });
    }

    if (args.on) {
      if (!args.target) {
        throw new ConvexError({
          code: "TARGET_REQUIRED",
          message: "Target required when toggling Library on.",
        });
      }
      if (sentence.packSlug) {
        throw new ConvexError({
          code: "ALREADY_PUBLISHED",
          message:
            "Toggle Default off first — items can only be in one pack at a time.",
        });
      }
      const slug = await resolveTargetLifecycleV2(ctx, args.target, clerkUserId);
      await ctx.db.patch(args.profileSentenceId, {
        packSlug: slug,
        updatedAt: Date.now(),
      });
      return { slug, action: "added" as const };
    } else {
      if (!sentence.packSlug) return { action: "noop" as const };
      if (sentence.packSlug === STARTER_SLUG) {
        throw new ConvexError({
          code: "USE_DEFAULT_TOGGLE",
          message:
            "This sentence is in the starter pack — use the Default toggle to remove.",
        });
      }
      await ctx.db.patch(args.profileSentenceId, {
        packSlug: undefined,
        updatedAt: Date.now(),
      });
      return { action: "removed" as const };
    }
  },
});

/**
 * V2: Update tier override on a packLifecycle row. Mirrors `setLibraryPackTier`
 * but writes to the lifecycle table instead of `resourcePacks`. Starter pack
 * tier remains fixed at free (the JSON `defaultTier` is the source of truth).
 */
export const setLibraryPackTierV2 = mutation({
  args: {
    slug: v.string(),
    tier: TIER_VALIDATOR,
  },
  handler: async (ctx, { slug, tier }) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);

    const lifecycle = await ctx.db
      .query("packLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!lifecycle) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pack not found." });
    }
    if (lifecycle.slug === STARTER_SLUG) {
      throw new ConvexError({
        code: "STARTER_TIER_FIXED",
        message: "Starter pack tier is fixed at free.",
      });
    }
    if (lifecycle.createdBy !== clerkUserId) {
      throw new ConvexError({
        code: "NOT_OWNER",
        message: "You don't own this pack.",
      });
    }

    await ctx.db.patch(lifecycle._id, {
      tierOverride: tier,
      updatedAt: Date.now(),
    });
    return { slug, tier };
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
 * V2: Admin badge data for items in the JSON catalogue world. Joins
 * `packLifecycle` rows with the bundled JSON to surface pack name + tier
 * keyed by slug. Page-level subscriber pattern — pass derived status down
 * to children to avoid one-query-per-item.
 *
 * Always includes a `starterSlug` (the literal `"_starter"`) since the
 * starter pack is a fixed identifier — even if its lifecycle row hasn't
 * been created yet, components can still recognise a row's `packSlug ===
 * "_starter"` as "in the default pack".
 */
export const getPacksForAdminStatusV2 = query({
  args: {},
  handler: async (ctx) => {
    const lifecycleRows = await ctx.db.query("packLifecycle").collect();
    const libraryPacksBySlug: Record<
      string,
      { tier: "free" | "pro" | "max"; name: { eng: string; hin?: string } }
    > = {};

    for (const row of lifecycleRows) {
      if (row.slug === STARTER_SLUG) continue;
      const pack = getLibraryPackBySlug(row.slug);
      if (!pack) continue;
      libraryPacksBySlug[row.slug] = {
        tier: (row.tierOverride ?? pack.defaultTier) as "free" | "pro" | "max",
        name: row.name ?? pack.name,
      };
    }

    return { starterSlug: STARTER_SLUG, libraryPacksBySlug };
  },
});

/**
 * Pack picker source — non-starter packs the calling admin owns. Used by the
 * shared LibraryPackPickerModal "Add to existing" tab. Returns a sorted array
 * (newest first by _creationTime) — the dialogue renders straight from this.
 *
 * Returns `[]` (never errors) when the caller isn't an admin so client code
 * can safely subscribe before opening the dialogue.
 */
export const getMyLibraryPacksForPicker = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const all = await ctx.db.query("resourcePacks").collect();
    const mine = all.filter(
      (p) => !p.isStarter && p.createdBy === identity.subject
    );

    // Newest first
    mine.sort((a, b) => b._creationTime - a._creationTime);

    return mine.map((p) => ({
      _id: p._id,
      name: p.name,
      tier: (p.tier ?? "free") as "free" | "pro" | "max",
    }));
  },
});

/**
 * Read everything the `/api/admin/pack-publish` route needs to build the
 * JSON snapshot for a slug, in one round-trip:
 *
 *   - The `packLifecycle` row (for name / description / cover / tier).
 *   - Every `profileCategory` + `profileSymbol` + `profileList` + `profileSentence`
 *     across the caller's admin account where `packSlug` matches.
 *
 * Admin-only. Returns `null` if no lifecycle row exists for the slug — the
 * publish route handles that as a "create new lifecycle row first" error.
 *
 * The shape is intentionally "raw" — the API route does the snapshot
 * assembly on the Node side, which keeps the Convex query simple and
 * avoids encoding the `LibraryPack` shape twice. The route is the only
 * caller; not a general-purpose query.
 */
export const getPackContentForPublish = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId } = await requireCallerIsAdmin(ctx);

    const lifecycle = await ctx.db
      .query("packLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!lifecycle) return null;

    const allCategories = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    const categories = allCategories.filter((c) => c.packSlug === slug);

    // For each category, fetch the profileSymbols + resolve symbolstix image
    // paths (the JSON pack stores symbolId; the migration / publish path
    // doesn't store the SymbolStix imagePath because materialise re-resolves
    // it at load time). Skip non-symbolstix symbols per ADR-010 §1 (V1 packs
    // are SymbolStix-only — same constraint applies to V2).
    const categoryPayloads = await Promise.all(
      categories.map(async (cat) => {
        const symbols = await ctx.db
          .query("profileSymbols")
          .withIndex("by_profile_category_id_and_order", (q) =>
            q.eq("profileCategoryId", cat._id)
          )
          .order("asc")
          .collect();
        const stixSymbols = symbols.filter(
          (s) => s.imageSource.type === "symbolstix"
        );
        return {
          name: cat.name,
          icon: cat.icon,
          colour: cat.colour,
          imagePath: cat.imagePath,
          symbols: stixSymbols.map((s, i) => ({
            symbolId:
              s.imageSource.type === "symbolstix"
                ? (s.imageSource.symbolId as string)
                : "",
            ...(s.label.eng !== "" || s.label.hin
              ? { labelOverride: s.label }
              : {}),
            ...(s.display ? { display: s.display } : {}),
            order: i,
          })),
        };
      })
    );

    const allLists = await ctx.db
      .query("profileLists")
      .withIndex("by_account_id_and_order", (q) =>
        q.eq("accountId", accountId)
      )
      .order("asc")
      .collect();
    const lists = allLists
      .filter((l) => l.packSlug === slug)
      .map((l, i) => ({
        name: l.name,
        order: i,
        items: [...l.items].sort((a, b) => a.order - b.order),
        ...(l.displayFormat !== undefined
          ? { displayFormat: l.displayFormat }
          : {}),
        ...(l.showNumbers !== undefined
          ? { showNumbers: l.showNumbers }
          : {}),
        ...(l.showChecklist !== undefined
          ? { showChecklist: l.showChecklist }
          : {}),
        ...(l.showFirstThen !== undefined
          ? { showFirstThen: l.showFirstThen }
          : {}),
      }));

    const allSentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_account_id_and_order", (q) =>
        q.eq("accountId", accountId)
      )
      .order("asc")
      .collect();
    const sentences = allSentences
      .filter((s) => s.packSlug === slug)
      .map((s, i) => ({
        name: s.name,
        order: i,
        ...(s.text !== undefined ? { text: s.text } : {}),
        slots: [...s.slots].sort((a, b) => a.order - b.order),
        ...(s.audioPath !== undefined ? { audioPath: s.audioPath } : {}),
      }));

    return {
      lifecycle: {
        slug: lifecycle.slug,
        name: lifecycle.name,
        description: lifecycle.description,
        coverImagePath: lifecycle.coverImagePath,
        tierOverride: lifecycle.tierOverride,
      },
      categories: categoryPayloads,
      lists,
      sentences,
    };
  },
});

/**
 * V2: Pack picker source for the LibraryPackPickerModal "Add to existing"
 * tab. Reads from `packLifecycle` + JSON catalogue: returns every non-starter
 * pack the caller has authored (lifecycle.createdBy === clerkUserId), joined
 * with the pack's name from the bundled JSON.
 *
 * Returns `[]` for non-admin / unauthenticated callers so client code can
 * subscribe before opening the dialogue.
 */
export const getMyLifecyclePacksForPicker = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const lifecycleRows = await ctx.db.query("packLifecycle").collect();
    const mine = lifecycleRows.filter(
      (r) => r.slug !== STARTER_SLUG && r.createdBy === identity.subject
    );

    // Newest first
    mine.sort((a, b) => b._creationTime - a._creationTime);

    return mine
      .map((r) => {
        const pack = getLibraryPackBySlug(r.slug);
        return pack
          ? {
              slug: r.slug,
              name: pack.name,
              tier: (r.tierOverride ?? pack.defaultTier) as
                | "free"
                | "pro"
                | "max",
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
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

/**
 * V2: Public library catalogue from JSON + lifecycle overlay.
 *
 * Reads all `LibraryPack`s from the bundled JSON catalogue and merges them
 * with the corresponding `packLifecycle` rows. A pack is visible iff:
 *   1. A JSON file exists for the slug, AND
 *   2. A `packLifecycle` row exists for the slug, AND
 *   3. `publishedAt` is set and <= now, AND
 *   4. `expiresAt` is unset OR > now.
 *
 * Card shape mirrors V1 with one addition (`slug`) so consumers can call
 * `loadResourcePackV2` post-cutover. `_id` carries the lifecycle row's id
 * for back-compat with any consumer that still tracks packs by Convex Id.
 *
 * The starter pack is included so logged-out visitors see it on the page —
 * the client renders "Already on your account" for signed-in users.
 */
export const getPublicLibraryCatalogueV2 = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const jsonPacks = getAllLibraryPacks();
    const lifecycleRows = await ctx.db.query("packLifecycle").collect();
    const lifecycleBySlug = new Map(lifecycleRows.map((r) => [r.slug, r]));

    return jsonPacks
      .map((p) => {
        const lifecycle = lifecycleBySlug.get(p.slug);
        // Starter pack stays visible even without an explicit lifecycle row
        // so it shows on /library for cold visitors as an on-ramp. Signed-in
        // users see it labelled "Already on your account" via the client-side
        // dedup overlay.
        if (!lifecycle && !p.isStarter) return null;
        if (lifecycle) {
          if (
            lifecycle.publishedAt === undefined ||
            lifecycle.publishedAt > now
          ) {
            return null;
          }
          if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now) {
            return null;
          }
        }

        const effectiveTier = lifecycle?.tierOverride ?? p.defaultTier;
        const effectiveSeason = lifecycle?.seasonOverride;

        return {
          _id: lifecycle?._id ?? null,
          slug: p.slug,
          name: p.name,
          description: p.description,
          coverImagePath: p.coverImagePath,
          season: effectiveSeason,
          tags: [] as string[], // legacy field; JSON shape doesn't carry tags yet
          featured: lifecycle?.featured ?? false,
          tier: effectiveTier,
          isStarter: p.isStarter ?? false,
          counts: {
            categories: p.categories?.length ?? 0,
            lists: p.lists.length,
            sentences: p.sentences.length,
          },
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  },
});
