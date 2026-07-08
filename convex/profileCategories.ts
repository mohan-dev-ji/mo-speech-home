import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { resolveCallerAccountId, requireCallerAccountId } from "./lib/account";
import { requireProTier } from "./lib/access";
import { installContentModule } from "./lib/contentModuleInstall";
import type { ContentModule } from "./data/_shared/types";
import { resolveSymbolAudioPath } from "../lib/audio/resolveAudioPath";
import { getLanguage, getVoiceEntry } from "../lib/languages/registry";

// Voice fallback when a caller doesn't pass one — see lib/audio/resolveAudioPath.ts.
// Phase 8.4: callers pass the active profile's resolved `voiceId`; this is the
// final fallback (matches DEFAULT_VOICE_ID in lib/r2-paths.ts).
const DEFAULT_VOICE_ID = "en-GB-News-M";

// ─── Internal: seed ───────────────────────────────────────────────────────────

/**
 * Seed a fresh account at signup by installing every Default ("core") content
 * module (ADR-014 Task D). The `libraryModules` rows flagged `isDefault` are the
 * new-account manifest — published + curated by an admin, no committed JSON.
 * Account-scoped + idempotent: skips if the account already has any categories.
 *
 * Uses `installContentModule` directly (the shared materialise helper), which
 * bypasses tier/visibility/dedup gates — correct for seeding. Order is
 * categories → lists → sentences so the new account's trees read sensibly.
 *
 * If no module is flagged `isDefault`, a new account starts empty until an admin
 * marks default modules (Publish modal → "Default").
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
        `[seedDefaultAccount] account ${args.accountId} already seeded — skipping`
      );
      return;
    }

    const defaults = await ctx.db
      .query("libraryModules")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .collect();
    // categories < lists < sentences alphabetically — install in that order.
    defaults.sort(
      (a, b) => a.tree.localeCompare(b.tree) || a.slug.localeCompare(b.slug)
    );

    let installed = 0;
    for (const row of defaults) {
      // The row's tree + items are correlated in the data even though the table
      // validator types them as the cross-tree union — safe to treat as a
      // ContentModule (same cast rationale as lib/contentModules.rowToStored).
      await installContentModule(
        ctx,
        args.accountId,
        row as unknown as ContentModule
      );
      installed++;
    }
    console.log(
      `[seedDefaultAccount] account ${args.accountId}: installed ${installed} default modules`
    );
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

    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", resolved.accountId))
      .order("asc")
      .collect();
    // ADR-015 §6 — core-word categories never appear on the main board; they
    // surface only in the talker dropdown's Core-words tab.
    return cats.filter((c) => c.surface !== "core");
  },
});

/**
 * Core-word categories (ADR-015 §6) — the `surface:"core"` categories that
 * power the talker dropdown's Core-words tab. Separate from
 * `getProfileCategories` (which excludes them) so the two surfaces never bleed.
 */
export const getCoreWordCategories = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];

    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", resolved.accountId))
      .order("asc")
      .collect();
    return cats.filter((c) => c.surface === "core");
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
  args: {
    profileCategoryId: v.id("profileCategories"),
    // Active profile's resolved ttsVoiceId (Phase 8.4). Falls back to the
    // legacy male voice when omitted.
    voiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const voiceId = args.voiceId ?? DEFAULT_VOICE_ID;
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
              const seeded = audioMap?.[voiceId] === true;
              const defaultPath = resolveSymbolAudioPath(
                voiceId,
                sym.words.en ?? "",
                seeded,
                sym.audioBasename,
              );
              if (defaultPath) audio.en = defaultPath;
            }
            // Phase 15 (Thread 1): a pinned symbol also seeds its pinned-language
            // clip, resolved with a voice for THAT language matching the board
            // voice's gender (persona preserved) — so a tile pinned to English on a
            // Hindi board speaks English, not Hindi. The client resolves audio
            // against the pin (see CategoryDetailContent).
            const pin = ps.pinnedLanguage;
            if (pin && !audio[pin]) {
              const boardGender = getVoiceEntry(voiceId)?.gender;
              const pinVoices = getLanguage(pin)?.voices ?? [];
              const pinnedVoice =
                (boardGender && pinVoices.find((v) => v.gender === boardGender)?.ttsVoiceId) ||
                pinVoices[0]?.ttsVoiceId;
              if (pinnedVoice) {
                const audioMap = sym.audio as Record<string, boolean>;
                const seeded = audioMap?.[pinnedVoice] === true;
                const p = resolveSymbolAudioPath(
                  pinnedVoice,
                  sym.words.en ?? "",
                  seeded,
                  sym.audioBasename,
                );
                if (p) audio[pin] = p;
              }
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
          pinnedLanguage: ps.pinnedLanguage, // Phase 15 (Thread 1)
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
    // When "core", the category joins the structural core-word surface (the
    // talker dropdown's Core-words tab) instead of the main Categories board.
    // getCoreWordCategories / getProfileCategories partition on this field so
    // the two surfaces never bleed (ADR-015 dropdown edit modes).
    surface: v.optional(v.literal("core")),
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
      ...(args.surface && { surface: args.surface }),
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

// ─── Category R2 orphan keys ──────────────────────────────────────────────────

/**
 * Returns the personal R2 keys (uploads, recordings, image-search picks) on
 * a category's symbols, so an orchestrating API route can delete them after a
 * destructive category operation.
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
