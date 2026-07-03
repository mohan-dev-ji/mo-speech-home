/**
 * Talker dropbar (2-tab experiment) — the flat fringe board.
 *
 * The dropdown is exactly two fixed tabs backed by two canonical per-account
 * containers, addressed by well-known `librarySourceId` sentinels so seeding
 * (installContentModule) and this get-or-create converge on the same rows:
 *   - Tab 1 "Core words" → one profileCategories row (surface:"core").
 *   - Tab 2 "Phrases"    → one profileFolders row (tree:"phrases").
 */

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireCallerAccountId,
  resolveCallerAccountId,
  requireCallerIsAdmin,
} from "./lib/account";

export const CORE_SLUG = "dropbar-core";
export const PHRASES_SLUG = "dropbar-phrases";

async function findCoreContainer(ctx: QueryCtx | MutationCtx, accountId: Id<"users">) {
  const cats = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  return cats.find((c) => c.librarySourceId === CORE_SLUG) ?? null;
}

async function findPhrasesContainer(ctx: QueryCtx | MutationCtx, accountId: Id<"users">) {
  const folders = await ctx.db
    .query("profileFolders")
    .withIndex("by_library_source_id", (q) => q.eq("librarySourceId", PHRASES_SLUG))
    .collect();
  return folders.find((f) => f.accountId === accountId) ?? null;
}

/**
 * Get-or-create the two dropbar containers for the caller's account. Idempotent;
 * a seeded account already has them (installed from the published defaults), so
 * this only creates empties for accounts that predate the defaults. Tier-agnostic
 * — opening the dropdown must work for everyone; per-item edits gate on Pro.
 */
export const ensureDropbarContainers = mutation({
  args: {},
  handler: async (ctx) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const now = Date.now();

    let core = await findCoreContainer(ctx, accountId);
    if (!core) {
      const id = await ctx.db.insert("profileCategories", {
        accountId,
        name: { en: "Core words" },
        icon: "MessageSquare",
        colour: "zinc",
        order: 0,
        surface: "core",
        librarySourceId: CORE_SLUG,
        librarySourceCategoryKey: "Core words",
        updatedAt: now,
      });
      core = await ctx.db.get(id);
    }

    let phrases = await findPhrasesContainer(ctx, accountId);
    if (!phrases) {
      const id = await ctx.db.insert("profileFolders", {
        accountId,
        tree: "phrases",
        name: { en: "Phrases" },
        order: 0,
        source: "module",
        librarySourceId: PHRASES_SLUG,
        updatedAt: now,
      });
      phrases = await ctx.db.get(id);
    }

    return { coreCategoryId: core!._id, phrasesFolderId: phrases!._id };
  },
});

/** The two container ids (null until ensured/seeded). */
export const getDropbarBoard = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return { coreCategoryId: null, phrasesFolderId: null };
    const core = await findCoreContainer(ctx, resolved.accountId);
    const phrases = await findPhrasesContainer(ctx, resolved.accountId);
    return {
      coreCategoryId: (core?._id ?? null) as Id<"profileCategories"> | null,
      phrasesFolderId: (phrases?._id ?? null) as Id<"profileFolders"> | null,
    };
  },
});

/** Phrases in the dropbar phrases container — same per-phrase shape as getPhraseBanks. */
export const getDropbarPhrases = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const folder = await findPhrasesContainer(ctx, resolved.accountId);
    if (!folder) return [];
    const phrases = await ctx.db
      .query("profilePhrases")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", resolved.accountId))
      .order("asc")
      .collect();
    return phrases
      .filter((p) => p.folderId === folder._id)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        words: [...p.words].sort((a, b) => a.order - b.order),
        audioPath: p.audioPath,
        recordedAudioPath:
          p.recordedAudioPath ??
          (p.audioPath?.startsWith("accounts/") ? p.audioPath : undefined),
      }));
  },
});

/**
 * One-off cleanup: unset `isDefault` on the legacy dropdown defaults (the seven
 * `core-*` category modules and the old default phrase-bank modules) so new
 * accounts seed ONLY the new `dropbar-core` + `dropbar-phrases`. Leaves the
 * main-page category/list/sentence defaults untouched. Admin-only.
 */
export const retireOldDropdownDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const now = Date.now();
    const defaults = await ctx.db
      .query("libraryModules")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();
    let retired = 0;
    for (const m of defaults) {
      const isLegacyCore = m.surface === "core" && m.slug !== CORE_SLUG;
      const isLegacyPhrase = m.tree === "phrases" && m.slug !== PHRASES_SLUG;
      if (isLegacyCore || isLegacyPhrase) {
        await ctx.db.patch(m._id, { isDefault: false, updatedAt: now });
        retired++;
      }
    }
    return { retired };
  },
});
