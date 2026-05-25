import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import { requireProTier } from "./lib/access";
import {
  loadStarterTemplateInlineV2,
  materialiseSymbolsFromJson,
  removeCategoryFromPack,
  syncCategoryToPackIfPublished,
} from "./resourcePacks";
import { getLibraryPackBySlug } from "./lib/libraryPacks";
import { resolveSymbolAudioPath } from "../lib/audio/resolveAudioPath";

// Phase 8.0 voice fallback — see lib/audio/resolveAudioPath.ts. Phase 8.5
// drives this from `studentProfiles.voiceId`.
const DEFAULT_VOICE_ID = "en-GB-News-M";

// ─── Internal: seed ───────────────────────────────────────────────────────────

/**
 * Seed the default categories + symbols onto a fresh account at signup.
 * Account-scoped: idempotent — skips if the account already has any categories.
 *
 * Per ADR-010 (Phase 5): this delegates to `loadStarterTemplateInlineV2`, which
 * materialises the JSON starter pack at `convex/data/library_packs/_starter.json`.
 * The DEFAULT_CATEGORIES module is no longer load-bearing at runtime — it
 * remains in the repo as the historical source-of-truth recipe.
 *
 * Pre-condition: a starter pack JSON file exists in the catalogue with
 * `isStarter: true`. If not, the helper logs a warning and returns; the
 * new account ends up with zero categories until a starter is published.
 */
export const seedDefaultAccount = internalMutation({
  args: {
    accountId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", args.accountId))
      .first();
    if (existing) {
      console.log(
        `[seedDefaultAccount] account ${args.accountId} already has categories — skipping`
      );
      return;
    }

    await loadStarterTemplateInlineV2(ctx, args.accountId);
  },
});

// ─── Dev helpers ─────────────────────────────────────────────────────────────

/**
 * Re-seed default categories for an account.
 * Wipes any existing profileCategories + profileSymbols on the account first.
 * Dev/admin use only.
 */
export const reseedAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const existingSymbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const s of existingSymbols) await ctx.db.delete(s._id);

    const existingCats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
      .collect();
    for (const c of existingCats) await ctx.db.delete(c._id);

    await ctx.scheduler.runAfter(
      0,
      internal.profileCategories.seedDefaultAccount,
      { accountId }
    );

    return {
      deleted: { categories: existingCats.length, symbols: existingSymbols.length },
    };
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getProfileCategory = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.profileCategoryId);
  },
});

/**
 * Return all categories for the caller's account in display order.
 */
export const getProfileCategories = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    return ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", resolved.accountId))
      .order("asc")
      .collect();
  },
});

export const getProfileSymbols = query({
  args: {
    profileCategoryId: v.id("profileCategories"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .order("asc")
      .collect();
  },
});

export const getProfileSymbolsWithImages = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .order("asc")
      .collect();

    return Promise.all(
      rows.map(async (ps) => {
        let imagePath: string | undefined;
        // Map of ISO code → resolved audio path. Per-language overrides on
        // `ps.audio` win for their locale; the default-locale slot is seeded
        // with the SymbolStix default (convention-resolved via
        // `resolveSymbolAudioPath` for symbolstix-backed rows) so other
        // locales fall back through `displayValue()` to it on the client.
        const audio: Record<string, string> = {};

        // 1) Per-language overrides (recordings / tts captured by the instructor).
        const overrides =
          (ps.audio as Record<string, { path: string } | undefined>) ?? {};
        for (const [lang, src] of Object.entries(overrides)) {
          if (src?.path) audio[lang] = src.path;
        }

        if (ps.imageSource.type === "symbolstix") {
          const sym = await ctx.db.get(ps.imageSource.symbolId);
          if (sym) {
            imagePath = sym.imagePath;
            // 2) SymbolStix default — only seed the default-locale slot if no
            //    override already claims it, so user recordings keep winning.
            if (!audio.en) {
              const audioMap = sym.audio as Record<string, boolean>;
              const seeded = audioMap?.[DEFAULT_VOICE_ID] === true;
              const defaultPath = resolveSymbolAudioPath(
                DEFAULT_VOICE_ID,
                sym.words.en ?? "",
                seeded,
                sym.audioBasename,
              );
              if (defaultPath) audio.en = defaultPath;
            }
          }
        } else if (ps.imageSource.type === "placeholder") {
          // No image yet — left undefined so SymbolCard renders its empty
          // state. Label still resolves; tapping the tile opens the editor
          // with the label seeded into the SymbolStix search.
          imagePath = undefined;
        } else {
          const src = ps.imageSource as { imagePath: string };
          imagePath = src.imagePath;
        }

        return {
          _id: ps._id,
          profileCategoryId: ps.profileCategoryId,
          order: ps.order,
          label: ps.label,
          display: ps.display,
          imagePath,
          audio,
        };
      })
    );
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new profileCategory on the caller's account. Mirrors createProfileList /
 * createProfileSentence: a single-field add from the listing-page modal. Colour,
 * icon, image, and symbols are set afterwards via the detail page (BannerEdit).
 *
 * View-mode agnostic — the row is a plain instructor-owned category regardless
 * of whether the caller is in instructor or admin viewMode. Admins promote it to
 * the starter pack or library afterwards via setCategoryDefault /
 * setCategoryInLibrary on the detail page. See ADR-008.
 */
export const createProfileCategory = mutation({
  args: {
    name: v.record(v.string(), v.string()),
    // Optional list of labels — one placeholder profileSymbol is created per
    // non-empty entry, ordered as given. Empty / whitespace-only entries are
    // skipped. The instructor opens each placeholder via SymbolEditorModal;
    // the saved label drives the SymbolStix search so picking a matching
    // symbol is a one-tap action.
    symbolLabels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const last = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
      .order("desc")
      .first();

    const now = Date.now();
    const categoryId = await ctx.db.insert("profileCategories", {
      accountId,
      name: args.name,
      icon: "📁",
      colour: "#6B7280",
      order: last ? last.order + 1 : 0,
      updatedAt: now,
    });

    // Seed placeholder symbols, if any. The category is brand new so there
    // are no existing rows to shift — assign explicit order = index.
    // Empty / whitespace-only entries are skipped.
    const cleaned = (args.symbolLabels ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (let i = 0; i < cleaned.length; i++) {
      await ctx.db.insert("profileSymbols", {
        accountId,
        profileCategoryId: categoryId,
        order: i,
        imageSource: { type: "placeholder" },
        label: { en: cleaned[i] },
        updatedAt: now,
      });
    }

    return categoryId;
  },
});

/**
 * Persist a new order for the categories on the caller's account.
 */
export const reorderCategories = mutation({
  args: {
    orderedIds: v.array(v.id("profileCategories")),
    // When true (admin in admin viewMode), edits to published rows propagate
    // back to the resource pack snapshot. Default false: admin editing in
    // instructor / student view treats edits as personal, leaving the pack
    // untouched. Normal users never have publishedToPackId set anyway, so
    // sync is a no-op for them regardless of the flag.
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      const cat = await ctx.db.get(args.orderedIds[i]);
      if (!cat || cat.accountId !== accountId)
        throw new Error("Category not found or not authorised");
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }

    if (args.propagateToPack) {
      for (const id of args.orderedIds) {
        await syncCategoryToPackIfPublished(ctx, id);
      }
    }
  },
});

export const updateCategoryMeta = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    name: v.optional(
      v.record(v.string(), v.string())
    ),
    colour: v.optional(v.string()),
    imagePath: v.optional(v.string()),
    propagateToPack: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const cat = await ctx.db.get(args.profileCategoryId);
    if (!cat) throw new Error("Category not found");
    if (cat.accountId !== accountId) throw new Error("Not authorised");

    await ctx.db.patch(args.profileCategoryId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.colour !== undefined && { colour: args.colour }),
      ...(args.imagePath !== undefined && { imagePath: args.imagePath }),
      updatedAt: Date.now(),
    });

    if (args.propagateToPack) {
      await syncCategoryToPackIfPublished(ctx, args.profileCategoryId);
    }

    return args.profileCategoryId;
  },
});

export const deleteCategory = mutation({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);

    const cat = await ctx.db.get(args.profileCategoryId);
    if (!cat) throw new Error("Category not found");
    if (cat.accountId !== accountId) throw new Error("Not authorised");

    // Auto-sync: if this category is published, remove the entry from the pack
    // (and delete the pack if it becomes empty + non-starter). Done before the
    // actual delete so the helper can still read the row.
    await removeCategoryFromPack(ctx, args.profileCategoryId);

    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", args.profileCategoryId)
      )
      .collect();

    for (const sym of symbols) await ctx.db.delete(sym._id);

    await ctx.db.delete(args.profileCategoryId);
  },
});

// ─── Reload Defaults ──────────────────────────────────────────────────────────

/**
 * Resets a category that was loaded from a library pack back to the pack's
 * current snapshot. Destructive: replaces all profileSymbols (instructor
 * customisations + extras both gone), patches category-level fields back to
 * the snapshot. Atomic — single transactional mutation.
 *
 * R2 file deletion happens OUTSIDE this mutation, in the orchestrating
 * Next.js API route (Convex mutations can't call AWS SDK). The route reads
 * the orphan keys via getCategoryReloadOrphanKeys BEFORE this mutation runs,
 * then deletes them after.
 *
 * Errors:
 *   NOT_FOUND          — caller doesn't own the category, or category gone
 *   NOT_FROM_LIBRARY   — category has no librarySourceId
 *   PACK_NOT_FOUND     — librarySourceId points to a deleted pack
 *   SNAPSHOT_MISSING   — pack exists but no matching category snapshot inside
 */
export const reloadCategoryFromLibrary = mutation({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, { profileCategoryId }) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    requireProTier(user);
    const category = await ctx.db.get(profileCategoryId);
    if (!category || category.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND" });
    }
    if (!category.librarySourceId) {
      throw new ConvexError({ code: "NOT_FROM_LIBRARY" });
    }
    // Post-ADR-010: `librarySourceId` is a JSON pack slug, not a Convex Id.
    // Resolve via the bundled catalogue.
    const pack = getLibraryPackBySlug(category.librarySourceId);
    if (!pack) {
      throw new ConvexError({ code: "PACK_NOT_FOUND" });
    }

    // Join: prefer librarySourceCategoryKey (rename-resilient); fall back to
    // the default locale's name for rows loaded before that field existed.
    const joinKey = category.librarySourceCategoryKey ?? category.name.en;
    const snapshot = (pack.categories ?? []).find(
      (c) => c.name.en === joinKey
    );
    if (!snapshot) {
      throw new ConvexError({ code: "SNAPSHOT_MISSING" });
    }

    // Delete profileSymbols for this category. R2 file deletion happens in
    // the orchestrating API route — see file-level docstring.
    const oldSymbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", profileCategoryId)
      )
      .collect();
    for (const s of oldSymbols) {
      await ctx.db.delete(s._id);
    }

    const now = Date.now();
    await ctx.db.patch(profileCategoryId, {
      name: snapshot.name,
      icon: snapshot.icon,
      colour: snapshot.colour,
      // Sets to undefined when snapshot lacks one — clears any instructor override.
      imagePath: snapshot.imagePath,
      // Backfill the key on rows that didn't have it (subsequent reloads use it).
      librarySourceCategoryKey:
        category.librarySourceCategoryKey ?? snapshot.name.en,
      updatedAt: now,
    });

    // materialiseSymbolsFromJson handles both SymbolStix and custom-image
    // snapshot shapes — reload-from-library now reproduces image-search /
    // AI / upload symbols too, not just SymbolStix.
    const { symbolsAdded, symbolsSkipped } = await materialiseSymbolsFromJson(
      ctx,
      accountId,
      profileCategoryId,
      snapshot.symbols,
      now
    );

    return { symbolsAdded, symbolsSkipped };
  },
});

/**
 * Returns the personal R2 keys (uploads, recordings, image-search picks) on
 * a category's symbols. Used by the API route BEFORE calling
 * reloadCategoryFromLibrary so it can delete them after the mutation runs.
 *
 * Excludes shared caches: ai-cache/ (aiGenerated images) and audio/<voice>/tts/
 * (TTS cache) are reusable across users and never deleted on reload.
 *
 * Auth-checked. Returns an empty array if the caller doesn't own the category
 * or it isn't from the library — silent empty rather than a throw, since the
 * mutation that follows will throw NOT_FOUND/NOT_FROM_LIBRARY itself.
 */
export const getCategoryReloadOrphanKeys = query({
  args: { profileCategoryId: v.id("profileCategories") },
  handler: async (ctx, { profileCategoryId }) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const { accountId } = resolved;
    const category = await ctx.db.get(profileCategoryId);
    if (!category || category.accountId !== accountId) return [];
    if (!category.librarySourceId) return [];

    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", profileCategoryId)
      )
      .collect();

    const keys: string[] = [];
    for (const s of symbols) {
      // Image: delete only uploaded or image-search (under accounts/ or profiles/).
      // Skip symbolstix (no separate path) and aiGenerated (shared ai-cache/).
      if (
        s.imageSource.type === "userUpload" ||
        s.imageSource.type === "imageSearch"
      ) {
        keys.push(s.imageSource.imagePath);
      }
      // Audio: per-language. Delete the active path if type "recorded", plus
      // any "recorded" alternate. Keep "tts" (cache) and "r2" (SymbolStix
      // default). The per-language map is an open record keyed by ISO code
      // post Phase 8.0 — iterate keys rather than naming locales.
      const audioMap =
        (s.audio as Record<string, { type: string; path: string; alternates?: { recorded?: string } } | undefined>) ?? {};
      for (const a of Object.values(audioMap)) {
        if (!a) continue;
        if (a.type === "recorded") keys.push(a.path);
        if (
          a.alternates?.recorded &&
          a.alternates.recorded !== a.path
        ) {
          keys.push(a.alternates.recorded);
        }
      }
    }
    return keys;
  },
});
