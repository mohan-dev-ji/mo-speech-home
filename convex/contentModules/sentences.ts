/**
 * Sentence content-module plugin (ADR-014 §1). Sibling of `categories.ts`;
 * content in `convex/data/sentences/<slug>.json`, metadata in `sentenceLifecycle`.
 */

import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
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
} from "../lib/contentModuleInstall";

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
