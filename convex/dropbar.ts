/**
 * Talker dropbar (2-tab experiment) — the flat fringe board.
 *
 * The dropdown is exactly two fixed tabs backed by two canonical per-account
 * containers, addressed by well-known `librarySourceId` sentinels so seeding
 * (installContentModule) and this get-or-create converge on the same rows:
 *   - Tab 1 "Core words" → one profileCategories row (surface:"core").
 *   - Tab 2 "Phrases"    → one profileFolders row (tree:"phrases").
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireCallerAccountId,
  resolveCallerAccountId,
} from "./lib/account";

export const CORE_SLUG = "dropbar-core";
export const PHRASES_SLUG = "dropbar-phrases";

// The core-word modules whose symbols seed the dropbar Core-words tab by
// default — the four "little words" groups. Numbers, Letters and Time are
// reference content that belongs on the Categories board, so they're excluded.
export const DEFAULT_CORE_INJECT_SLUGS = [
  "core-general",
  "core-pronouns",
  "core-joining-words",
  "core-position-words",
];

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

/** Phrases in the dropbar phrases container, resolved per board language. */
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
        // ADR-016 — client collapses sibling variants by board language + shows
        // the "Made in <lang>" badge / author entry.
        authoredLanguage: p.authoredLanguage,
        variantGroupId: p.variantGroupId,
      }));
  },
});

/**
 * Bulk-populate the caller's Core-words tab from the seeded `core-*` library
 * modules — a fast alternative to hand-searching each symbol in the editor.
 * Resolves each module symbol (all symbolstix-backed) and appends it into the
 * next free slot of the dropbar-core container. Idempotent: symbols already on
 * the board (same symbolstix id) are skipped, so re-running only adds new ones.
 * Defaults to the four little-words groups (Numbers/Letters/Time excluded);
 * pass `slugs` to override.
 */
export const injectCoreModulesIntoDropbar = mutation({
  args: { slugs: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const now = Date.now();
    const slugs = args.slugs ?? DEFAULT_CORE_INJECT_SLUGS;

    // Ensure the core container exists (mirrors ensureDropbarContainers).
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
    const coreCategoryId = core!._id;

    // Existing symbols → dedup set (by symbolstix id) + next free slot.
    const existing = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", coreCategoryId)
      )
      .collect();
    const seen = new Set<string>();
    for (const s of existing) {
      if (s.imageSource.type === "symbolstix") seen.add(s.imageSource.symbolId);
    }
    let slot = existing.reduce((m, s) => Math.max(m, s.order), -1) + 1;

    let added = 0;
    let skippedDuplicate = 0;
    let missing = 0;
    let modulesFound = 0;

    for (const slug of slugs) {
      const mod = await ctx.db
        .query("libraryModules")
        .withIndex("by_tree_and_slug", (q) =>
          q.eq("tree", "categories").eq("slug", slug)
        )
        .first();
      if (!mod) continue;
      modulesFound++;

      // Core modules hold a single category item; its `symbols` are
      // `{ order, symbolId, labelOverride? }` (all symbolstix-backed).
      const items = mod.items as Array<{
        symbols: Array<{ order: number; symbolId?: string; labelOverride?: Record<string, string> }>;
      }>;
      const symbols = [...(items[0]?.symbols ?? [])].sort((a, b) => a.order - b.order);

      for (const sym of symbols) {
        if (!sym.symbolId) { missing++; continue; }
        if (seen.has(sym.symbolId)) { skippedDuplicate++; continue; }
        const symbolDoc = await ctx.db.get(sym.symbolId as Id<"symbols">);
        if (!symbolDoc) { missing++; continue; }
        await ctx.db.insert("profileSymbols", {
          accountId,
          profileCategoryId: coreCategoryId,
          order: slot++,
          imageSource: { type: "symbolstix", symbolId: symbolDoc._id },
          label: { ...symbolDoc.words, ...(sym.labelOverride ?? {}) },
          updatedAt: now,
        });
        seen.add(sym.symbolId);
        added++;
      }
    }

    return { added, skippedDuplicate, missing, modulesFound, slugs };
  },
});
