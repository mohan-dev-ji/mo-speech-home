/**
 * Content-module install (ADR-014 §3) — materialise one module into one folder.
 *
 * Installing a module is 1:1 with a default folder: we create a single
 * `profileFolders` row (`source: "module"`) and insert the module's items into
 * it, stamping `folderId` + `librarySourceId` so delete / reload / dedup can
 * find them later. Item ordering is folder-local (0..n) — the tree renders via
 * the `by_folder_id_and_order` index.
 *
 * Mirrors `materialisePackFromJson` (the superseded bundled-pack path) but
 * folder-aware and single-type. Symbol materialisation reuses the shared
 * `materialiseSymbolsFromJson`.
 */

import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { materialiseSymbolsFromJson } from "../resourcePacks";
import type { ContentModule, PackTier } from "../data/_shared/types";

/** The lifecycle fields the install gate needs (shared shape across the three
 * per-type lifecycle tables). */
type LifecycleGate = {
  publishedAt?: number;
  expiresAt?: number;
  tierOverride?: PackTier;
} | null;

/**
 * Visibility + tier gate for installing a module — the per-type equivalent of
 * the inline checks in `loadResourcePackV2`. Table-agnostic: the caller fetches
 * the matching `*Lifecycle` row and computes `hasFullAccess` (via
 * `userHasFullAccess`). Starter modules bypass the gate so signup seeding works
 * before any lifecycle row exists. Throws `ConvexError` on failure.
 */
export function assertModuleInstallable(opts: {
  slug: string;
  isStarter: boolean;
  defaultTier: PackTier;
  lifecycle: LifecycleGate;
  hasFullAccess: boolean;
  now: number;
}): void {
  const { slug, isStarter, defaultTier, lifecycle, hasFullAccess, now } = opts;
  if (isStarter) return;
  if (!lifecycle) {
    throw new ConvexError({
      code: "MODULE_NOT_PUBLISHED",
      message: `Module "${slug}" exists but has no lifecycle row — not yet published.`,
    });
  }
  if (lifecycle.publishedAt === undefined || lifecycle.publishedAt > now) {
    throw new ConvexError({
      code: "MODULE_NOT_PUBLISHED",
      message: `Module "${slug}" is not yet published.`,
    });
  }
  if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now) {
    throw new ConvexError({
      code: "MODULE_EXPIRED",
      message: `Module "${slug}" has expired.`,
    });
  }
  const effectiveTier = lifecycle.tierOverride ?? defaultTier;
  if (effectiveTier !== "free" && !hasFullAccess) {
    throw new ConvexError({
      code: "TIER_REQUIRED",
      required: effectiveTier,
      message:
        "Resource library requires Pro or Max plan. Upgrade to install this module.",
    });
  }
}

export type InstallModuleResult = {
  tree: ContentModule["tree"];
  slug: string;
  // The default folder created for a lists/sentences module (1:1). Undefined
  // for category modules, which install flat (no folder).
  folderId?: Id<"profileFolders">;
  foldersAdded: number; // 1 for lists/sentences, 0 for categories
  itemsAdded: number;
  symbolsAdded: number;
  symbolsSkipped: number;
};

/**
 * Create the default folder for `module` and materialise its items into the
 * caller's account. Caller is responsible for auth, visibility/tier gating, and
 * the dedup check (see `assertModuleNotInstalled`).
 */
export async function installContentModule(
  ctx: MutationCtx,
  accountId: Id<"users">,
  module: ContentModule
): Promise<InstallModuleResult> {
  const now = Date.now();

  // A category IS a group of symbols (it carries its own folder label), so
  // category modules install FLAT — their categories drop straight into the
  // Categories grid with no wrapping folder (ADR-014 addendum). Only the Lists
  // and Sentences trees use the folder primitive, because their items are
  // otherwise one long ungrouped list.
  let folderId: Id<"profileFolders"> | undefined;
  if (module.tree !== "categories") {
    const lastFolder = await ctx.db
      .query("profileFolders")
      .withIndex("by_account_id_and_tree_and_order", (q) =>
        q.eq("accountId", accountId).eq("tree", module.tree)
      )
      .order("desc")
      .first();
    const folderOrder = lastFolder ? lastFolder.order + 1 : 0;
    folderId = await ctx.db.insert("profileFolders", {
      accountId,
      tree: module.tree,
      name: module.name,
      ...(module.icon ? { icon: module.icon } : {}),
      ...(module.colour ? { colour: module.colour } : {}),
      ...(module.coverImagePath ? { imagePath: module.coverImagePath } : {}),
      order: folderOrder,
      source: "module",
      librarySourceId: module.slug,
      updatedAt: now,
    });
  }

  let itemsAdded = 0;
  let symbolsAdded = 0;
  let symbolsSkipped = 0;

  if (module.tree === "categories") {
    // Append categories after the account's existing ones (flat grid order).
    const lastCategory = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
      .order("desc")
      .first();
    let order = lastCategory ? lastCategory.order + 1 : 0;
    for (const cat of module.items) {
      const profileCategoryId = await ctx.db.insert("profileCategories", {
        accountId,
        name: cat.name,
        icon: cat.icon,
        colour: cat.colour,
        ...(cat.imagePath ? { imagePath: cat.imagePath } : {}),
        order: order++,
        librarySourceId: module.slug,
        librarySourceCategoryKey: cat.name.en,
        updatedAt: now,
      });
      itemsAdded++;
      const r = await materialiseSymbolsFromJson(
        ctx,
        accountId,
        profileCategoryId,
        cat.symbols,
        now
      );
      symbolsAdded += r.symbolsAdded;
      symbolsSkipped += r.symbolsSkipped;
    }
  } else if (module.tree === "lists") {
    let order = 0;
    for (const list of module.items) {
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
        order: order++,
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
        folderId,
        librarySourceId: module.slug,
        updatedAt: now,
      });
      itemsAdded++;
    }
  } else {
    // sentences
    let order = 0;
    for (const sentence of module.items) {
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
        order: order++,
        ...(sentence.text !== undefined ? { text: sentence.text } : {}),
        slots,
        ...(sentence.audioPath !== undefined
          ? { audioPath: sentence.audioPath }
          : {}),
        folderId,
        librarySourceId: module.slug,
        updatedAt: now,
      });
      itemsAdded++;
    }
  }

  return {
    tree: module.tree,
    slug: module.slug,
    folderId,
    foldersAdded: folderId ? 1 : 0,
    itemsAdded,
    symbolsAdded,
    symbolsSkipped,
  };
}

/**
 * Dedup gate: returns true if this account already has a module-sourced folder
 * for `slug`. Uses the `by_library_source_id` index, then filters to the
 * account (slugs are not globally unique across accounts).
 */
export async function isModuleInstalled(
  ctx: MutationCtx,
  accountId: Id<"users">,
  slug: string
): Promise<boolean> {
  const existing = await ctx.db
    .query("profileFolders")
    .withIndex("by_library_source_id", (q) => q.eq("librarySourceId", slug))
    .collect();
  return existing.some((f) => f.accountId === accountId);
}

/**
 * Dedup gate for CATEGORY modules, which install flat (no folder). Scans the
 * account's categories for one already sourced from `slug`. A typical account
 * has dozens of categories, so the by_account_id scan is cheap.
 */
export async function isCategoryModuleInstalled(
  ctx: MutationCtx,
  accountId: Id<"users">,
  slug: string
): Promise<boolean> {
  const cats = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  return cats.some((c) => c.librarySourceId === slug);
}
