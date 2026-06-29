/**
 * Content-module readers — the canonical access point for module content
 * (ADR-014, addendum 2026-06-27). The per-type equivalent of
 * `lib/libraryPacks.ts`.
 *
 * Module content is now stored in the `libraryModules` Convex table (one row per
 * module, content **and** lifecycle merged) — NOT bundled JSON. These readers
 * query that table, so they are async and take `ctx`. The bundled JSON files in
 * `convex/data/{categories,lists,sentences}/` are now seed input / git-export
 * artifacts (see `migrations.seedLibraryModulesFromJSON`), not read at runtime.
 *
 * A returned `StoredModule` carries the `ContentModule` content fields PLUS the
 * lifecycle fields off the row, so callers no longer join a separate
 * `*Lifecycle` table for visibility/tier.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  ModuleTree,
  ModuleForTree,
  PackTier,
} from "../data/_shared/types";

/**
 * A module as stored: the tree's `ContentModule` content shape plus the
 * lifecycle/bookkeeping fields merged onto the `libraryModules` row.
 */
export type StoredModule<T extends ModuleTree> = ModuleForTree<T> & {
  publishedAt?: number;
  expiresAt?: number;
  lastPublishedAt?: number;
  tierOverride?: PackTier;
  featured: boolean;
  isDefault?: boolean;
  tags?: string[];
  notes?: string;
  _id: Id<"libraryModules">;
  createdBy: string;
  updatedAt: number;
};

/**
 * Cast a `libraryModules` row to `StoredModule<T>`. Safe because every caller
 * queries by a known `tree` literal (`by_tree_and_slug` / `by_tree`), so the
 * row's `tree` + `items` are guaranteed to match `T` even though the table
 * validator types them as the cross-tree union.
 */
function rowToStored<T extends ModuleTree>(
  row: Doc<"libraryModules">
): StoredModule<T> {
  return row as unknown as StoredModule<T>;
}

/**
 * Look up a module by tree + slug. Returns `null` if no row exists. Callers read
 * visibility/tier from the returned row's merged lifecycle fields.
 */
export async function getModuleBySlug<T extends ModuleTree>(
  ctx: QueryCtx,
  tree: T,
  slug: string
): Promise<StoredModule<T> | null> {
  const row = await ctx.db
    .query("libraryModules")
    .withIndex("by_tree_and_slug", (q) => q.eq("tree", tree).eq("slug", slug))
    .first();
  return row ? rowToStored<T>(row) : null;
}

/** Every module in a tree's catalogue, in stable slug order. */
export async function getAllModules<T extends ModuleTree>(
  ctx: QueryCtx,
  tree: T
): Promise<StoredModule<T>[]> {
  const rows = await ctx.db
    .query("libraryModules")
    .withIndex("by_tree", (q) => q.eq("tree", tree))
    .collect();
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows.map((r) => rowToStored<T>(r));
}
