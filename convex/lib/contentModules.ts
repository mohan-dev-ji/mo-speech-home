/**
 * Content-module readers — the canonical access point for module content
 * (ADR-014). The per-type equivalent of `lib/libraryPacks.ts`.
 *
 * All reads of module content (catalogue listing, install, default seed) go
 * through these helpers. They consume the bundled JSON maps in
 * `convex/data/{categories,lists,sentences}/_index.ts`; no Convex DB reads. Per
 * ADR-010's preserved storage model, JSON is the source of truth for content;
 * visibility (publish window / tier) is decided separately against the per-type
 * `*Lifecycle` overlay tables.
 */

import { CATEGORY_MODULES } from "../data/categories/_index";
import { LIST_MODULES } from "../data/lists/_index";
import { SENTENCE_MODULES } from "../data/sentences/_index";
import type {
  ContentModule,
  ModuleTree,
  ModuleForTree,
} from "../data/_shared/types";

/** The three bundled catalogues, keyed by tree. */
const MODULE_MAPS: { [T in ModuleTree]: Record<string, ModuleForTree<T>> } = {
  categories: CATEGORY_MODULES,
  lists: LIST_MODULES,
  sentences: SENTENCE_MODULES,
};

/**
 * Look up a module by tree + slug. Returns `null` if no JSON file exists.
 * Callers must still check the matching `*Lifecycle` row for visibility.
 */
export function getModuleBySlug<T extends ModuleTree>(
  tree: T,
  slug: string
): ModuleForTree<T> | null {
  return MODULE_MAPS[tree][slug] ?? null;
}

/** Every slug in a tree's catalogue, in stable alphabetical order. */
export function getAllModuleSlugs(tree: ModuleTree): string[] {
  return Object.keys(MODULE_MAPS[tree]).sort();
}

/** Every module in a tree's catalogue. Order matches `getAllModuleSlugs`. */
export function getAllModules<T extends ModuleTree>(
  tree: T
): ModuleForTree<T>[] {
  const map = MODULE_MAPS[tree];
  return getAllModuleSlugs(tree).map((slug) => map[slug]);
}

/**
 * The starter modules for a tree (those flagged `isStarter`). The default-load
 * manifest (`_defaults.json`) is the authoritative new-account seed list; this
 * helper is a convenience for flagging/repair tooling.
 */
export function getStarterModules<T extends ModuleTree>(
  tree: T
): ModuleForTree<T>[] {
  return getAllModules(tree).filter((m) => m.isStarter);
}

/** Look up a module across all three trees (slugs are unique per tree, not
 * globally — prefer the tree-scoped lookup when the tree is known). */
export function findModuleAnyTree(
  slug: string
): { tree: ModuleTree; module: ContentModule } | null {
  for (const tree of ["categories", "lists", "sentences"] as const) {
    const module = MODULE_MAPS[tree][slug];
    if (module) return { tree, module };
  }
  return null;
}
