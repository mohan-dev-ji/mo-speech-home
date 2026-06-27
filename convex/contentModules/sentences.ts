/**
 * Sentence content-module plugin (ADR-014 §1). Sibling of `categories.ts`;
 * content in `convex/data/sentences/<slug>.json`, metadata in `sentenceLifecycle`.
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
import { collectSentenceOrphanKeys } from "../lib/contentModuleDelete";

const TIER = v.union(v.literal("free"), v.literal("pro"), v.literal("max"));

export const installSentenceModule = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    const module = getModuleBySlug("sentences", slug);
    if (!module) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `Sentence module "${slug}" not found in the JSON catalogue.`,
      });
    }
    const lifecycle = await ctx.db
      .query("sentenceLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    assertModuleInstallable({
      slug,
      isStarter: module.isStarter ?? false,
      defaultTier: module.defaultTier,
      lifecycle,
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

export const getMyInstalledSentenceSlugs = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const folders = await ctx.db
      .query("profileFolders")
      .withIndex("by_account_id_and_tree_and_order", (q) =>
        q.eq("accountId", resolved.accountId).eq("tree", "sentences")
      )
      .collect();
    return folders
      .filter((f) => f.source === "module" && f.librarySourceId)
      .map((f) => f.librarySourceId as string);
  },
});

/** Public catalogue for the library's Sentences tab. See `getPublicCategoryCatalogue`. */
export const getPublicSentenceCatalogue = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("sentenceLifecycle").collect();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const now = Date.now();
    return getAllModules("sentences")
      .map((module) => {
        const lifecycle = bySlug.get(module.slug) ?? null;
        const isStarter = module.isStarter ?? false;
        if (!isModuleVisible({ isStarter, lifecycle, now })) return null;
        return {
          slug: module.slug,
          name: module.name,
          description: module.description ?? null,
          coverImagePath: module.coverImagePath ?? null,
          isStarter,
          featured: lifecycle?.featured ?? false,
          effectiveTier: (lifecycle?.tierOverride ?? module.defaultTier) as
            | "free"
            | "pro"
            | "max",
          counts: { sentences: module.items.length },
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  },
});

/**
 * Personal R2 keys (slot uploads, sentence recordings) on the sentences inside
 * this module's folder. Collected by the uninstall route BEFORE
 * `deleteSentenceModule` runs.
 */
export const getSentenceModuleDeleteOrphanKeys = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<string[]> => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) return [];
    const folder = await findModuleFolder(ctx, resolved.accountId, slug);
    if (!folder) return [];
    const sentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    const keys: string[] = [];
    for (const s of sentences) keys.push(...collectSentenceOrphanKeys(s));
    return Array.from(new Set(keys));
  },
});

/**
 * Uninstall a sentence module (ADR-014 §5): delete the module-sourced folder and
 * every sentence inside it. Matched by `librarySourceId` + `source:"module"`.
 * R2 orphans deleted by the route afterwards.
 */
export const deleteSentenceModule = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { accountId } = await requireCallerAccountId(ctx);
    const folder = await findModuleFolder(ctx, accountId, slug);
    if (!folder) {
      throw new ConvexError({
        code: "NOT_INSTALLED",
        message: "This sentence module is not installed.",
      });
    }
    const sentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const s of sentences) await ctx.db.delete(s._id);
    await ctx.db.delete(folder._id);
    return { slug, foldersDeleted: 1, itemsDeleted: sentences.length };
  },
});

/** Find the caller's module-sourced "sentences" folder for `slug`, or null. */
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
        f.tree === "sentences"
    ) ?? null
  );
}

function deriveStatus(
  lifecycle: Doc<"sentenceLifecycle"> | null,
  now: number
): "draft" | "scheduled" | "live" | "expired" {
  if (!lifecycle || lifecycle.publishedAt === undefined) return "draft";
  if (lifecycle.publishedAt > now) return "scheduled";
  if (lifecycle.expiresAt !== undefined && lifecycle.expiresAt <= now)
    return "expired";
  return "live";
}

export const listAllSentenceModulesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const rows = await ctx.db.query("sentenceLifecycle").collect();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const now = Date.now();
    return getAllModules("sentences").map((module) => {
      const lifecycle = bySlug.get(module.slug) ?? null;
      return {
        slug: module.slug,
        name: module.name,
        description: module.description ?? null,
        coverImagePath: module.coverImagePath ?? null,
        defaultTier: module.defaultTier,
        isStarter: module.isStarter ?? false,
        provenance: module.provenance ?? null,
        lifecycleId: lifecycle?._id ?? null,
        publishedAt: lifecycle?.publishedAt ?? null,
        expiresAt: lifecycle?.expiresAt ?? null,
        featured: lifecycle?.featured ?? false,
        tierOverride: lifecycle?.tierOverride ?? null,
        tags: lifecycle?.tags ?? [],
        notes: lifecycle?.notes ?? null,
        updatedAt: lifecycle?.updatedAt ?? null,
        createdBy: lifecycle?.createdBy ?? null,
        status: deriveStatus(lifecycle, now),
        effectiveTier: (lifecycle?.tierOverride ?? module.defaultTier) as
          | "free"
          | "pro"
          | "max",
        counts: { sentences: module.items.length },
      };
    });
  },
});

export const updateSentenceLifecycle = mutation({
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
    const { clerkUserId } = await requireCallerIsAdmin(ctx);
    if (!getModuleBySlug("sentences", args.slug)) {
      throw new ConvexError({
        code: "MODULE_NOT_FOUND",
        message: `No JSON sentence module for slug "${args.slug}".`,
      });
    }
    const existing = await ctx.db
      .query("sentenceLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const now = Date.now();
    const patch: Partial<Doc<"sentenceLifecycle">> & { updatedAt: number } = {
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

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { slug: args.slug, lifecycleId: existing._id };
    }
    const lifecycleId = await ctx.db.insert("sentenceLifecycle", {
      slug: args.slug,
      featured: patch.featured ?? false,
      createdBy: clerkUserId,
      updatedAt: now,
      ...(patch.publishedAt !== undefined && { publishedAt: patch.publishedAt }),
      ...(patch.expiresAt !== undefined && { expiresAt: patch.expiresAt }),
      ...(patch.tierOverride !== undefined && {
        tierOverride: patch.tierOverride,
      }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
    });
    return { slug: args.slug, lifecycleId };
  },
});

export const deleteSentenceLifecycle = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("sentenceLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return { slug };
  },
});
