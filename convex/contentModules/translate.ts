/**
 * Module-copy translation support (ADR-014 Task E). The admin route
 * `/api/admin/translate-modules` reads modules via `getModulesForTranslation`,
 * fills missing/changed non-English copy via Gemini (English is master,
 * additive — never overwrites a good translation), and writes each back via
 * `applyModuleTranslation`. The per-row `translationSnapshot` records the English
 * source each translation was made from, so re-runs only touch what changed.
 *
 * Symbol labels are NOT translated here — category symbols resolve their labels
 * live from the global `symbols` table (ADR-014 §4), which the symbol pipeline
 * already translates.
 */

import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireCallerIsAdmin } from "../lib/account";

const localisedString = v.record(v.string(), v.string());

/** All modules with the fields the translator needs (admin-only). */
export const getModulesForTranslation = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const rows = await ctx.db.query("libraryModules").collect();
    rows.sort(
      (a, b) => a.tree.localeCompare(b.tree) || a.slug.localeCompare(b.slug)
    );
    return rows.map((m) => ({
      _id: m._id,
      tree: m.tree,
      slug: m.slug,
      name: m.name,
      description: m.description ?? null,
      items: m.items,
      translationSnapshot: m.translationSnapshot ?? {},
    }));
  },
});

/**
 * Write a module's freshly-translated copy back (admin-only). `items` is the
 * full per-tree array with locale keys filled in; the table schema validates it
 * on patch, so `v.any()` here is safe + avoids re-declaring the union.
 */
export const applyModuleTranslation = mutation({
  args: {
    moduleId: v.id("libraryModules"),
    name: localisedString,
    description: v.optional(localisedString),
    items: v.any(),
    translationSnapshot: localisedString,
  },
  handler: async (ctx, args) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db.get(args.moduleId);
    if (!row) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Module not found." });
    }
    await ctx.db.patch(args.moduleId, {
      name: args.name,
      ...(args.description !== undefined ? { description: args.description } : {}),
      items: args.items,
      translationSnapshot: args.translationSnapshot,
      updatedAt: Date.now(),
    });
    return { moduleId: args.moduleId };
  },
});
