/**
 * Curation publish (ADR-014 Task B, addendum 2026-06-27). The admin curation
 * tool: the owner hand-groups default lists/sentences into folders in their own
 * account, then publishes a folder into the `libraryModules` table so it shows
 * in the library and installs into other accounts. A pure mutation — works in
 * production, no dev server, no commit, no deploy.
 *
 * Categories are NOT published this way: they install flat (no folder), and the
 * default `core` categories module is seeded separately (Task C). Only the
 * foldered trees — lists, sentences — have a folder to publish.
 *
 * R2 assets: personal keys under `accounts/<admin>/…` are PROMOTED at publish to
 * `library_modules/<tree>/<slug>/<kind>/…` by `/api/admin/promote-module-assets`,
 * which passes the resulting key map in as `assetPathMap` (ADR-022). Published
 * modules therefore own their assets and survive an admin uninstall or account
 * deletion. Non-personal keys (symbolstix, TTS cache, legacy library_packs) are
 * passed through untouched.
 */

import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireCallerIsAdmin } from "../lib/account";
import { collectSourcePersonalKeys } from "../lib/personalAssetRefs";
import { needsTranslation } from "../../lib/languages/variants";
import { DEFAULT_LOCALE } from "../../lib/languages/registry";

const TIER = v.union(v.literal("free"), v.literal("pro"), v.literal("max"));

/** Promotion map arg shared by both publish mutations (ADR-022). */
const ASSET_PATH_MAP = v.optional(v.record(v.string(), v.string()));

/**
 * Every personal R2 key the publish source points at, so the caller can copy
 * them to the module-scoped prefix before publishing (ADR-022). Read-only —
 * the copy itself happens in `/api/admin/promote-module-assets`, because a
 * Convex mutation cannot perform R2 I/O.
 */
export const getPublishAssetKeys = query({
  args: {
    tree: v.union(
      v.literal("categories"), v.literal("lists"),
      v.literal("sentences"), v.literal("phrases"),
    ),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Same gate as the publish mutations — this returns raw R2 keys, so it must
    // not be readable by anyone who can guess a document id.
    await requireCallerIsAdmin(ctx);
    return collectSourcePersonalKeys(ctx, args);
  },
});

/** Rewrite one asset path through the promotion map (ADR-022). Unmapped paths —
 * symbolstix, TTS cache, already-promoted keys — pass through untouched. */
function promoted<T extends string | undefined>(
  path: T,
  map: Record<string, string> | undefined,
): T {
  if (!path || !map) return path;
  return (map[path] ?? path) as T;
}

/**
 * Rewrite the asset paths on one `profileLists` item. Field coverage mirrors
 * `listKeys()` in `convex/lib/personalAssetRefs.ts` — every field that can hold
 * a personal key must be rewritten, or the module keeps pointing at the
 * admin's copy. `defaultAudioPath` is symbolstix-derived and never mapped; it
 * is passed through the same helper for symmetry (a no-op).
 */
function promoteListItem<
  T extends {
    imagePath?: string;
    audioPath?: string;
    defaultAudioPath?: string;
    generatedAudioPath?: string;
    recordedAudioPath?: string;
  },
>(it: T, map: Record<string, string> | undefined): T {
  return {
    ...it,
    ...(it.imagePath !== undefined ? { imagePath: promoted(it.imagePath, map) } : {}),
    ...(it.audioPath !== undefined ? { audioPath: promoted(it.audioPath, map) } : {}),
    ...(it.defaultAudioPath !== undefined
      ? { defaultAudioPath: promoted(it.defaultAudioPath, map) }
      : {}),
    ...(it.generatedAudioPath !== undefined
      ? { generatedAudioPath: promoted(it.generatedAudioPath, map) }
      : {}),
    ...(it.recordedAudioPath !== undefined
      ? { recordedAudioPath: promoted(it.recordedAudioPath, map) }
      : {}),
  };
}

/** Rewrite a sentence slot / composition word's `imagePath` (+ `audioPath`
 * where the shape carries one). Mirrors `sentenceKeys()` / `phraseKeys()`. */
function promoteWordLike<T extends { imagePath?: string; audioPath?: string }>(
  w: T,
  map: Record<string, string> | undefined,
): T {
  return {
    ...w,
    ...(w.imagePath !== undefined ? { imagePath: promoted(w.imagePath, map) } : {}),
    ...(w.audioPath !== undefined ? { audioPath: promoted(w.audioPath, map) } : {}),
  };
}

/**
 * Rewrite a composition unit (ADR-015). A `word` unit is word-shaped; a
 * `phrase` unit carries its own clip plus a snapshot of its words, each of
 * which can hold a personal image. Mirrors the `units[]` walk in
 * `sentenceKeys()`.
 */
function promoteUnit<
  T extends {
    imagePath?: string;
    audioPath?: string;
    recordedAudioPath?: string;
    words?: Array<{ imagePath?: string; audioPath?: string }>;
  },
>(u: T, map: Record<string, string> | undefined): T {
  return {
    ...promoteWordLike(u, map),
    ...(u.recordedAudioPath !== undefined
      ? { recordedAudioPath: promoted(u.recordedAudioPath, map) }
      : {}),
    ...(u.words !== undefined
      ? { words: u.words.map((w) => promoteWordLike(w, map)) }
      : {}),
  };
}

/**
 * Rewrite a per-symbol audio override. `symbolKeys()` treats BOTH `path` and
 * `alternates.recorded` as personal, so both are rewritten here — a `tts`-typed
 * entry can still carry a personal recording in `alternates`, and publish emits
 * the whole entry. `alternates.default` / `.generated` are shared paths that
 * never land in the map; passing them through the same helper is a no-op.
 */
function promoteAudioSource<
  T extends {
    path: string;
    alternates?: { default?: string; generated?: string; recorded?: string };
  },
>(a: T, map: Record<string, string> | undefined): T {
  return {
    ...a,
    path: promoted(a.path, map),
    ...(a.alternates !== undefined
      ? {
          alternates: {
            ...a.alternates,
            ...(a.alternates.default !== undefined
              ? { default: promoted(a.alternates.default, map) }
              : {}),
            ...(a.alternates.generated !== undefined
              ? { generated: promoted(a.alternates.generated, map) }
              : {}),
            ...(a.alternates.recorded !== undefined
              ? { recorded: promoted(a.alternates.recorded, map) }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * A NON-source variant sibling whose primary localised field lacks its own
 * language is untranslated junk — skip it at publish so it never seeds (MOS-26,
 * ADR-016 Addendum C: fluent → text, phrase → name). Source rows, and sentences
 * with no `text` (sequence — judged by structure, not text), are always kept.
 */
function isUntranslatedSentence(s: Doc<"profileSentences">): boolean {
  const isSource = !s.variantGroupId || s.variantGroupId === s._id;
  if (isSource || s.text === undefined) return false;
  const lang = s.authoredLanguage ?? DEFAULT_LOCALE;
  const rec = typeof s.text === "string" ? { [lang]: s.text } : s.text;
  return needsTranslation(rec, lang);
}
function isUntranslatedPhrase(p: Doc<"profilePhrases">): boolean {
  const isSource = !p.variantGroupId || p.variantGroupId === p._id;
  if (isSource) return false;
  const lang = p.authoredLanguage ?? DEFAULT_LOCALE;
  return needsTranslation(p.name, lang);
}

export const publishFolderAsModule = mutation({
  args: {
    folderId: v.id("profileFolders"),
    slug: v.string(),
    tier: TIER,
    // When true, the module is a Default ("core") module: auto-installed for new
    // accounts and free to access (tier is forced to "free").
    isDefault: v.optional(v.boolean()),
    // Optional English name override; defaults to the folder's name (all locales
    // preserved, English swapped in when provided).
    name: v.optional(v.string()),
    // ADR-022 — old→new R2 key map from `/api/admin/promote-module-assets`.
    // Absent means "publish without promotion" (R2 unconfigured, or nothing
    // personal to promote); paths then pass through unchanged.
    assetPathMap: ASSET_PATH_MAP,
  },
  handler: async (
    ctx,
    { folderId, slug, tier, isDefault, name, assetPathMap },
  ) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const folder = await ctx.db.get(folderId);
    if (!folder || folder.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found." });
    }
    const tree = folder.tree;
    if (tree !== "lists" && tree !== "sentences" && tree !== "phrases") {
      throw new ConvexError({
        code: "BAD_TREE",
        message:
          "Only list, sentence, and phrase folders can be published as modules.",
      });
    }

    // Serialise the folder's items into the module item shape. The profile rows
    // already match the LibraryPack{List,Sentence} shape (same schema source),
    // so we pass them through sorted by order — mirroring
    // `resourcePacks.getPackContentForPublish`.
    let items: Doc<"libraryModules">["items"];
    if (tree === "lists") {
      const lists = await ctx.db
        .query("profileLists")
        .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
        .order("asc")
        .collect();
      items = lists.map((l, i) => ({
        name: l.name,
        order: i,
        items: [...l.items]
          .sort((a, b) => a.order - b.order)
          .map((it) => promoteListItem(it, assetPathMap)),
        ...(l.displayFormat !== undefined ? { displayFormat: l.displayFormat } : {}),
        ...(l.showNumbers !== undefined ? { showNumbers: l.showNumbers } : {}),
        ...(l.showChecklist !== undefined ? { showChecklist: l.showChecklist } : {}),
        ...(l.showFirstThen !== undefined ? { showFirstThen: l.showFirstThen } : {}),
      }));
    } else if (tree === "sentences") {
      const sentences = (
        await ctx.db
          .query("profileSentences")
          .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
          .order("asc")
          .collect()
      ).filter((s) => !isUntranslatedSentence(s));
      items = sentences.map((s, i) => ({
        name: s.name,
        order: i,
        ...(s.text !== undefined ? { text: s.text } : {}),
        slots: [...s.slots]
          .sort((a, b) => a.order - b.order)
          .map((slot) => promoteWordLike(slot, assetPathMap)),
        ...(s.audioPath !== undefined
          ? { audioPath: promoted(s.audioPath, assetPathMap) }
          : {}),
        ...(s.recordedAudioPath !== undefined
          ? { recordedAudioPath: promoted(s.recordedAudioPath, assetPathMap) }
          : {}),
        ...(s.authoredLanguage ? { authoredLanguage: s.authoredLanguage } : {}),
        ...(s.variantGroupId ? { variantGroupKey: s.variantGroupId } : {}),
        ...(s.units
          ? { units: s.units.map((u) => promoteUnit(u, assetPathMap)) }
          : {}),
        ...(s.playback ? { playback: s.playback } : {}),
      }));
    } else {
      // phrases (ADR-015) — serialise into phrase module items. Per-word audio is
      // not carried at module level (resolves from the symbol); only the
      // whole-phrase audio is preserved.
      const phrases = (
        await ctx.db
          .query("profilePhrases")
          .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folderId))
          .order("asc")
          .collect()
      ).filter((p) => !isUntranslatedPhrase(p));
      items = phrases.map((p, i) => ({
        name: p.name,
        order: i,
        ...(p.audioPath !== undefined
          ? { audioPath: promoted(p.audioPath, assetPathMap) }
          : {}),
        ...(p.recordedAudioPath !== undefined
          ? { recordedAudioPath: promoted(p.recordedAudioPath, assetPathMap) }
          : {}),
        ...(p.authoredLanguage ? { authoredLanguage: p.authoredLanguage } : {}),
        ...(p.variantGroupId ? { variantGroupKey: p.variantGroupId } : {}),
        words: [...p.words]
          .sort((a, b) => a.order - b.order)
          .map((w) => ({
            order: w.order,
            ...(w.imagePath !== undefined
              ? { imagePath: promoted(w.imagePath, assetPathMap) }
              : {}),
            ...(w.label !== undefined ? { label: w.label } : {}),
            ...(w.displayProps !== undefined
              ? { displayProps: w.displayProps }
              : {}),
          })),
      }));
    }

    if (items.length === 0) {
      throw new ConvexError({
        code: "EMPTY_FOLDER",
        message: "This folder has no items to publish.",
      });
    }

    const moduleName = name ? { ...folder.name, en: name } : folder.name;
    // Default modules are always free to access (you can't auto-install a paid
    // module into a free account).
    const effectiveDefault = isDefault ?? false;
    const resolvedTier = effectiveDefault ? "free" : tier;
    const now = Date.now();

    const publishedModuleClass = effectiveDefault ? ("default" as const) : tier;
    const existing = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) => q.eq("tree", tree).eq("slug", slug))
      .unique();

    let moduleId;
    let updated: boolean;
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: moduleName,
        ...(folder.icon ? { icon: folder.icon } : {}),
        ...(folder.colour ? { colour: folder.colour } : {}),
        ...(folder.imagePath
          ? { coverImagePath: promoted(folder.imagePath, assetPathMap) }
          : {}),
        defaultTier: resolvedTier,
        isDefault: effectiveDefault,
        // Log the admin's folder position so default seeds mirror it.
        defaultOrder: folder.order,
        items,
        publishedAt: existing.publishedAt ?? now,
        lastPublishedAt: now,
        updatedAt: now,
      });
      moduleId = existing._id;
      updated = true;
    } else {
      moduleId = await ctx.db.insert("libraryModules", {
        tree,
        slug,
        name: moduleName,
        ...(folder.icon ? { icon: folder.icon } : {}),
        ...(folder.colour ? { colour: folder.colour } : {}),
        ...(folder.imagePath
          ? { coverImagePath: promoted(folder.imagePath, assetPathMap) }
          : {}),
        defaultTier: resolvedTier,
        isDefault: effectiveDefault,
        // Log the admin's folder position so default seeds mirror it.
        defaultOrder: folder.order,
        items,
        publishedAt: now,
        lastPublishedAt: now,
        featured: false,
        createdBy: clerkUserId,
        updatedAt: now,
      });
      updated = false;
    }

    // Provenance back-link on the source folder → drives the modal's Update mode.
    await ctx.db.patch(folderId, {
      publishedModuleSlug: slug,
      publishedModuleClass,
      updatedAt: now,
    });

    return { slug, tree, moduleId, itemCount: items.length, updated };
  },
});

/**
 * Publish a single flat category as its own category module (ADR-014 Task C,
 * owner decision 2026-06-28: each default category is its OWN module, not a
 * bundled "core"). The categories tree installs flat, so there is no folder to
 * publish — this serialises one `profileCategories` row + its symbols into a
 * one-category `CategoryModule`. Symbol serialisation mirrors
 * `resourcePacks.getPackContentForPublish` (symbolstix → `symbolId`; custom →
 * `imagePath` + attribution/recorded audio; placeholders dropped). R2 assets are
 * promoted to the module-scoped prefix (see the folder mutation's note, ADR-022).
 */
export const publishCategoryAsModule = mutation({
  args: {
    profileCategoryId: v.id("profileCategories"),
    slug: v.string(),
    tier: TIER,
    isDefault: v.optional(v.boolean()),
    name: v.optional(v.string()),
    // ADR-022 — see `publishFolderAsModule`.
    assetPathMap: ASSET_PATH_MAP,
  },
  handler: async (
    ctx,
    { profileCategoryId, slug, tier, isDefault, name, assetPathMap },
  ) => {
    const { accountId, clerkUserId } = await requireCallerIsAdmin(ctx);

    const cat = await ctx.db.get(profileCategoryId);
    if (!cat || cat.accountId !== accountId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    const symbolRows = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id_and_order", (q) =>
        q.eq("profileCategoryId", profileCategoryId)
      )
      .order("asc")
      .collect();
    const nonPlaceholder = symbolRows.filter(
      (s) => s.imageSource.type !== "placeholder"
    );
    if (nonPlaceholder.length === 0) {
      throw new ConvexError({
        code: "EMPTY_FOLDER",
        message: "This category has no symbols to publish.",
      });
    }

    const symbols = nonPlaceholder.map((s, i) => {
      const base = { order: i, ...(s.display ? { display: s.display } : {}) };
      if (s.imageSource.type === "symbolstix") {
        const hasAnyLabel = Object.values(s.label).some(
          (vv) => typeof vv === "string" && vv !== ""
        );
        // Carry per-symbol audio overrides through the seed round-trip, but only
        // globally-shareable `tts` clips (voice-keyed R2 paths any account can
        // play). Account-specific recordings can't seed, so they're dropped.
        const audioMap =
          (s.audio as
            | Record<
                string,
                {
                  type: "r2" | "tts" | "recorded";
                  path: string;
                  ttsText?: string;
                  language?: string;
                  alternates?: { default?: string; generated?: string; recorded?: string };
                }
              >
            | undefined) ?? {};
        const shareableAudio = Object.fromEntries(
          Object.entries(audioMap)
            .filter(([, a]) => a?.type === "tts")
            // A `tts` entry can still carry a personal recording in
            // `alternates.recorded` — promote it too (ADR-022).
            .map(([k, a]) => [k, promoteAudioSource(a, assetPathMap)])
        );
        return {
          ...base,
          symbolId: s.imageSource.symbolId as string,
          ...(hasAnyLabel ? { labelOverride: s.label } : {}),
          ...(Object.keys(shareableAudio).length ? { audio: shareableAudio } : {}),
        };
      }
      // Placeholders are filtered out above, so the remaining custom kinds map
      // cleanly to the module image-source union (narrow away "placeholder").
      const imageSourceType = (
        s.imageSource.type === "userUpload" ? "upload" : s.imageSource.type
      ) as "upload" | "imageSearch" | "aiGenerated";
      const audioRec =
        (s.audio as
          | Record<
              string,
              { type: string; path: string; alternates?: { recorded?: string } }
            >
          | undefined) ?? {};
      const englishAudio = audioRec.en;
      const recordedAudioPath = promoted(
        englishAudio?.type === "recorded"
          ? englishAudio.path
          : englishAudio?.alternates?.recorded,
        assetPathMap,
      );
      return {
        ...base,
        imageSourceType,
        imagePath: promoted(
          s.imageSource.type === "imageSearch" ||
            s.imageSource.type === "aiGenerated" ||
            s.imageSource.type === "userUpload"
            ? s.imageSource.imagePath
            : "",
          assetPathMap,
        ),
        label: s.label,
        ...(s.imageSource.type === "imageSearch"
          ? {
              ...(s.imageSource.imageSourceUrl !== undefined
                ? { imageSourceUrl: s.imageSource.imageSourceUrl }
                : {}),
              ...(s.imageSource.attribution !== undefined
                ? { attribution: s.imageSource.attribution }
                : {}),
              ...(s.imageSource.license !== undefined
                ? { license: s.imageSource.license }
                : {}),
            }
          : {}),
        ...(s.imageSource.type === "aiGenerated" &&
        s.imageSource.aiPrompt !== undefined
          ? { aiPrompt: s.imageSource.aiPrompt }
          : {}),
        ...(recordedAudioPath ? { recordedAudioPath } : {}),
      };
    });

    const items: Doc<"libraryModules">["items"] = [
      {
        name: cat.name,
        icon: cat.icon,
        colour: cat.colour,
        ...(cat.imagePath
          ? { imagePath: promoted(cat.imagePath, assetPathMap) }
          : {}),
        symbols,
      },
    ];

    const moduleName = name ? { ...cat.name, en: name } : cat.name;
    const effectiveDefault = isDefault ?? false;
    const resolvedTier = effectiveDefault ? "free" : tier;
    const publishedModuleClass = effectiveDefault ? ("default" as const) : tier;
    const now = Date.now();

    const existing = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) =>
        q.eq("tree", "categories").eq("slug", slug)
      )
      .unique();

    let moduleId;
    let updated: boolean;
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: moduleName,
        // Carry the core-word surface so a published dropbar board re-seeds as
        // surface:"core" (stays off the Categories page, lands in the dropdown).
        ...(cat.surface ? { surface: cat.surface } : {}),
        ...(cat.icon ? { icon: cat.icon } : {}),
        ...(cat.colour ? { colour: cat.colour } : {}),
        ...(cat.imagePath
          ? { coverImagePath: promoted(cat.imagePath, assetPathMap) }
          : {}),
        defaultTier: resolvedTier,
        isDefault: effectiveDefault,
        // Log the admin's category-page position so default seeds mirror it.
        defaultOrder: cat.order,
        items,
        publishedAt: existing.publishedAt ?? now,
        lastPublishedAt: now,
        updatedAt: now,
      });
      moduleId = existing._id;
      updated = true;
    } else {
      moduleId = await ctx.db.insert("libraryModules", {
        tree: "categories",
        ...(cat.surface ? { surface: cat.surface } : {}),
        slug,
        name: moduleName,
        ...(cat.icon ? { icon: cat.icon } : {}),
        ...(cat.colour ? { colour: cat.colour } : {}),
        ...(cat.imagePath
          ? { coverImagePath: promoted(cat.imagePath, assetPathMap) }
          : {}),
        defaultTier: resolvedTier,
        isDefault: effectiveDefault,
        // Log the admin's category-page position so default seeds mirror it.
        defaultOrder: cat.order,
        items,
        publishedAt: now,
        lastPublishedAt: now,
        featured: false,
        createdBy: clerkUserId,
        updatedAt: now,
      });
      updated = false;
    }

    // Provenance back-link on the source category → drives the modal's Update mode.
    await ctx.db.patch(profileCategoryId, {
      publishedModuleSlug: slug,
      publishedModuleClass,
      updatedAt: now,
    });

    return { slug, tree: "categories" as const, moduleId, updated };
  },
});

/**
 * Re-log the seed order of every already-published category from the admin's
 * current Categories-page arrangement, in one pass. Reordering categories shifts
 * their `order`, which leaves each published module's `defaultOrder` stale — so
 * new-account seeds no longer match the admin's layout. Rather than re-publish
 * each category (which needlessly re-serialises symbols + audio), this patches
 * ONLY `defaultOrder` on the linked module, for categories that carry a
 * `publishedModuleSlug`. Unpublished categories are skipped (nothing to sync),
 * and core-word categories are left to the dropbar's own publish flow.
 */
export const syncCategorySeedOrder = mutation({
  args: {},
  handler: async (ctx) => {
    const { accountId } = await requireCallerIsAdmin(ctx);

    const cats = await ctx.db
      .query("profileCategories")
      .withIndex("by_account_id_and_order", (q) => q.eq("accountId", accountId))
      .order("asc")
      .collect();

    const now = Date.now();
    let synced = 0;
    let skipped = 0;
    for (const cat of cats) {
      // Core-word categories live in the talker dropbar, published separately.
      if (cat.surface === "core") continue;
      const slug = cat.publishedModuleSlug;
      if (!slug) {
        skipped++;
        continue;
      }
      const mod = await ctx.db
        .query("libraryModules")
        .withIndex("by_tree_and_slug", (q) =>
          q.eq("tree", "categories").eq("slug", slug)
        )
        .unique();
      if (!mod) {
        skipped++;
        continue;
      }
      if (mod.defaultOrder !== cat.order) {
        await ctx.db.patch(mod._id, { defaultOrder: cat.order, updatedAt: now });
        synced++;
      }
    }

    return { synced, skipped };
  },
});
