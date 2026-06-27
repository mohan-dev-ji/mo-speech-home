/**
 * Module detail (ADR-014) — the full content breakdown behind a library card,
 * the per-type successor to `resourcePacks.getPackDetailV2`. Returns a
 * pack-detail-compatible shape (only the module's own tree is populated) so the
 * detail page can reuse the pack rendering. Symbol references resolve live from
 * the global `symbols` table, exactly like the pack detail query.
 */

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { getModuleBySlug } from "../lib/contentModules";
import { isModuleVisible } from "../lib/contentModuleInstall";

const TREE = v.union(
  v.literal("categories"),
  v.literal("lists"),
  v.literal("sentences")
);

const LIFECYCLE_TABLE = {
  categories: "categoryLifecycle",
  lists: "listLifecycle",
  sentences: "sentenceLifecycle",
} as const;

type ResolvedSymbol = {
  imagePath: string | null;
  label: Record<string, string>;
};

/** Resolve a symbolstix id (or a pre-resolved imagePath) to `{ imagePath, label }`. */
async function resolveSymbolRef(
  ctx: QueryCtx,
  symbolId: string | undefined,
  labelOverride: Record<string, string> | undefined,
  fallbackImagePath: string | undefined,
  fallbackLabel: Record<string, string> | undefined
): Promise<ResolvedSymbol> {
  if (symbolId) {
    const doc = await ctx.db.get(symbolId as Id<"symbols">);
    if (doc) {
      return {
        imagePath: doc.imagePath,
        label: { ...doc.words, ...(labelOverride ?? {}) },
      };
    }
  }
  return {
    imagePath: fallbackImagePath ?? null,
    label: fallbackLabel ?? labelOverride ?? { en: "" },
  };
}

export const getModuleDetail = query({
  args: { tree: TREE, slug: v.string() },
  handler: async (ctx, { tree, slug }) => {
    const module = getModuleBySlug(tree, slug);
    if (!module) return null;

    const lifecycle = await ctx.db
      .query(LIFECYCLE_TABLE[tree])
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (
      !isModuleVisible({
        isStarter: module.isStarter ?? false,
        lifecycle,
        now: Date.now(),
      })
    ) {
      return null;
    }

    const tier = (lifecycle?.tierOverride ?? module.defaultTier) as
      | "free"
      | "pro"
      | "max";

    // Resolve only this module's tree; the other arrays stay empty so the
    // shared detail renderer just skips those sections.
    let categories: Array<{
      name: Record<string, string>;
      icon: string;
      colour: string;
      imagePath: string | null;
      symbols: Array<{ order: number } & ResolvedSymbol>;
    }> = [];
    let lists: Array<{
      name: Record<string, string>;
      items: Array<{ order: number } & ResolvedSymbol>;
    }> = [];
    let sentences: Array<{
      name: Record<string, string>;
      text: Record<string, string> | string | null;
      slots: Array<{ order: number } & ResolvedSymbol>;
    }> = [];

    if (tree === "categories") {
      categories = await Promise.all(
        (module.items as ContentItems["categories"]).map(async (cat) => ({
          name: cat.name,
          icon: cat.icon,
          colour: cat.colour,
          imagePath: cat.imagePath ?? null,
          symbols: await Promise.all(
            cat.symbols.map(async (sym, i) => {
              const kind = sym.imageSourceType ?? "symbolstix";
              if (kind === "symbolstix") {
                return {
                  order: i,
                  ...(await resolveSymbolRef(
                    ctx,
                    sym.symbolId,
                    sym.labelOverride,
                    undefined,
                    undefined
                  )),
                };
              }
              return {
                order: i,
                imagePath: sym.imagePath ?? null,
                label: sym.label ?? sym.labelOverride ?? { en: "" },
              };
            })
          ),
        }))
      );
    } else if (tree === "lists") {
      lists = await Promise.all(
        (module.items as ContentItems["lists"]).map(async (list) => ({
          name: list.name,
          items: await Promise.all(
            list.items.map(async (item, i) => {
              const descriptionRecord =
                typeof item.description === "string"
                  ? { en: item.description }
                  : item.description;
              return {
                order: i,
                ...(await resolveSymbolRef(
                  ctx,
                  item.symbolId,
                  undefined,
                  item.imagePath,
                  descriptionRecord
                )),
              };
            })
          ),
        }))
      );
    } else {
      sentences = await Promise.all(
        (module.items as ContentItems["sentences"]).map(async (sent) => ({
          name: sent.name,
          text: sent.text ?? null,
          slots: await Promise.all(
            sent.slots.map(async (slot, i) => ({
              order: i,
              ...(await resolveSymbolRef(
                ctx,
                slot.symbolId,
                undefined,
                slot.imagePath,
                undefined
              )),
            }))
          ),
        }))
      );
    }

    return {
      tree,
      slug: module.slug,
      name: module.name,
      description: module.description ?? null,
      coverImagePath: module.coverImagePath ?? null,
      tier,
      isStarter: module.isStarter ?? false,
      counts: {
        categories: categories.length,
        lists: lists.length,
        sentences: sentences.length,
      },
      categories,
      lists,
      sentences,
    };
  },
});

// Narrows `module.items` per tree (the discriminated union loses precision once
// `tree` is a runtime branch, so we assert the element type at each use site).
type ContentItems = {
  categories: import("../data/_shared/types").CategoryModule["items"];
  lists: import("../data/_shared/types").ListModule["items"];
  sentences: import("../data/_shared/types").SentenceModule["items"];
};
