/**
 * Phrase content-module plugin (ADR-015). Sibling of `lists.ts` / `sentences.ts`;
 * the Phrases tree's modules — reusable phrase banks surfaced in the talker
 * dropdown. Content + lifecycle live on the `libraryModules` row (tree:
 * "phrases"); install materialises into `profilePhrases` + a Phrases-tree folder.
 */

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import {
  requireCallerAccountId,
  requireCallerIsAdmin,
  resolveCallerAccountId,
} from "../lib/account";
import { userHasFullAccess } from "../lib/access";
import { getAllModules, getModuleBySlug } from "../lib/contentModules";
import {
  assertModuleInstallable,
  installContentModule,
  isModuleInstalled,
  isModuleVisible,
} from "../lib/contentModuleInstall";

const TIER = v.union(v.literal("free"), v.literal("pro"), v.literal("max"));

export const installPhraseModule = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    const module = await getModuleBySlug(ctx, "phrases", slug);
    if (!module) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `Phrase module "${slug}" not found.`,
      });
    }
    assertModuleInstallable({
      slug,
      isStarter: module.isStarter ?? false,
      defaultTier: module.defaultTier,
      lifecycle:
        module.publishedAt === undefined
          ? null
          : {
              publishedAt: module.publishedAt,
              expiresAt: module.expiresAt,
              tierOverride: module.tierOverride,
            },
      hasFullAccess: userHasFullAccess(user),
      now: Date.now(),
    });
    if (await isModuleInstalled(ctx, accountId, slug)) {
      throw new ConvexError({
        code: "ALREADY_INSTALLED",
        message: "This module is already installed into your account.",
      });
    }
    return await installContentModule(ctx, accountId, module);
  },
});

export const getMyInstalledPhraseSlugs = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const folders = await ctx.db
      .query("profileFolders")
      .withIndex("by_account_id_and_tree_and_order", (q) =>
        q.eq("accountId", resolved.accountId).eq("tree", "phrases")
      )
      .collect();
    return folders
      .filter((f) => f.source === "module" && f.librarySourceId)
      .map((f) => f.librarySourceId as string);
  },
});

/** Public catalogue for the library's Phrases tab. See `getPublicListCatalogue`. */
export const getPublicPhraseCatalogue = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const modules = await getAllModules(ctx, "phrases");
    return modules
      .map((module) => {
        const isStarter = module.isStarter ?? false;
        if (
          !isModuleVisible({
            isStarter,
            lifecycle:
              module.publishedAt === undefined
                ? null
                : {
                    publishedAt: module.publishedAt,
                    expiresAt: module.expiresAt,
                  },
            now,
          })
        )
          return null;
        return {
          slug: module.slug,
          name: module.name,
          description: module.description ?? null,
          coverImagePath: module.coverImagePath ?? null,
          isStarter,
          isDefault: module.isDefault ?? false,
          featured: module.featured,
          effectiveTier: (module.tierOverride ?? module.defaultTier) as
            | "free"
            | "pro"
            | "max",
          counts: { phrases: module.items.length },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

/**
 * Personal R2 keys (phrase recordings, word uploads) inside this module's bank.
 * Collected by the uninstall route BEFORE `deletePhraseModule` runs.
 */
export const getPhraseModuleDeleteOrphanKeys = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const folder = await findModuleFolder(ctx, resolved.accountId, slug);
    if (!folder) return [];
    const phrases = await ctx.db
      .query("profilePhrases")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    const keys: string[] = [];
    for (const p of phrases) {
      if (p.recordedAudioPath?.startsWith("accounts/")) keys.push(p.recordedAudioPath);
      if (p.audioPath?.startsWith("accounts/")) keys.push(p.audioPath);
      for (const w of p.words) {
        if (w.imagePath?.startsWith("accounts/")) keys.push(w.imagePath);
      }
    }
    return Array.from(new Set(keys));
  },
});

/**
 * Uninstall a phrase module (ADR-014 §5 / ADR-015): delete the module-sourced
 * bank folder and every phrase inside it. Matched by `librarySourceId` +
 * `source:"module"`, so a user bank of the same name is never touched.
 */
export const deletePhraseModule = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const folder = await findModuleFolder(ctx, accountId, slug);
    if (!folder) {
      throw new ConvexError({
        code: "NOT_INSTALLED",
        message: "This phrase module is not installed.",
      });
    }
    const phrases = await ctx.db
      .query("profilePhrases")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const p of phrases) await ctx.db.delete(p._id);
    await ctx.db.delete(folder._id);
    return { slug, foldersDeleted: 1, itemsDeleted: phrases.length };
  },
});

/** Find the caller's module-sourced "phrases" folder for `slug`, or null. */
async function findModuleFolder(
  ctx: QueryCtx,
  accountId: Id<"users">,
  slug: string
): Promise<Doc<"profileFolders"> | null> {
  const folders = await ctx.db
    .query("profileFolders")
    .withIndex("by_library_source_id", (q) => q.eq("librarySourceId", slug))
    .collect();
  return (
    folders.find(
      (f) =>
        f.accountId === accountId &&
        f.source === "module" &&
        f.tree === "phrases"
    ) ?? null
  );
}

function deriveStatus(
  lifecycle: { publishedAt?: number; expiresAt?: number } | null,
  now: number
): "draft" | "scheduled" | "live" | "expired" {
  if (!lifecycle || lifecycle.publishedAt === undefined) return "draft";
  if (lifecycle.publishedAt > now) return "scheduled";
  if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now)
    return "expired";
  return "live";
}

export const listAllPhraseModulesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const now = Date.now();
    const modules = await getAllModules(ctx, "phrases");
    return modules.map((module) => {
      return {
        slug: module.slug,
        name: module.name,
        description: module.description ?? null,
        coverImagePath: module.coverImagePath ?? null,
        defaultTier: module.defaultTier,
        isStarter: module.isStarter ?? false,
        provenance: module.provenance ?? null,
        lifecycleId: module._id,
        publishedAt: module.publishedAt ?? null,
        expiresAt: module.expiresAt ?? null,
        featured: module.featured,
        tierOverride: module.tierOverride ?? null,
        tags: module.tags ?? [],
        notes: module.notes ?? null,
        updatedAt: module.updatedAt,
        createdBy: module.createdBy,
        status: deriveStatus(module, now),
        effectiveTier: (module.tierOverride ?? module.defaultTier) as
          | "free"
          | "pro"
          | "max",
        counts: { phrases: module.items.length },
      };
    });
  },
});

export const updatePhraseLifecycle = mutation({
  args: {
    slug: v.string(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
    featured: v.optional(v.boolean()),
    tierOverride: v.optional(v.union(TIER, v.null())),
    tags: v.optional(v.union(v.array(v.string()), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) =>
        q.eq("tree", "phrases").eq("slug", args.slug)
      )
      .unique();
    if (!row) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `No phrase module for slug "${args.slug}".`,
      });
    }
    const now = Date.now();
    const patch: Partial<Doc<"libraryModules">> & { updatedAt: number } = {
      updatedAt: now,
    };
    if (args.publishedAt !== undefined)
      patch.publishedAt = args.publishedAt ?? undefined;
    if (args.expiresAt !== undefined)
      patch.expiresAt = args.expiresAt ?? undefined;
    if (args.featured !== undefined) patch.featured = args.featured;
    if (args.tierOverride !== undefined)
      patch.tierOverride = args.tierOverride ?? undefined;
    if (args.tags !== undefined) {
      const normalised = (args.tags ?? [])
        .map((t) => t.toLowerCase().trim().replace(/\s+/g, "-"))
        .filter((t) => t.length > 0);
      patch.tags = Array.from(new Set(normalised));
    }
    if (args.notes !== undefined) patch.notes = args.notes ?? undefined;

    await ctx.db.patch(row._id, patch);
    return { slug: args.slug, lifecycleId: row._id };
  },
});

export const deletePhraseLifecycle = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("libraryModules")
      .withIndex("by_tree_and_slug", (q) =>
        q.eq("tree", "phrases").eq("slug", slug)
      )
      .unique();
    if (row) {
      await ctx.db.patch(row._id, {
        publishedAt: undefined,
        expiresAt: undefined,
        tierOverride: undefined,
        tags: undefined,
        notes: undefined,
        featured: false,
        updatedAt: Date.now(),
      });
    }
    return { slug };
  },
});
