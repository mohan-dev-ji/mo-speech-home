import { getTranslations } from "next-intl/server";
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ModuleLibrary } from "@/app/components/marketing/sections/ModuleLibrary";
import type { ModuleTree } from "@/app/components/marketing/ui/InstallModuleButton";

/**
 * The three module trees, as they appear in a URL. Single definition: the
 * library index, the per-tab index and the detail route all validate against
 * this, and `ModuleDetailContent` builds its back link from the same value.
 */
export const MODULE_TREES: readonly ModuleTree[] = [
  "categories",
  "lists",
  "sentences",
];

export function asModuleTree(tree: string): ModuleTree | null {
  return (MODULE_TREES as readonly string[]).includes(tree)
    ? (tree as ModuleTree)
    : null;
}

/**
 * The library catalogue screen, shared by `/library/modules` and
 * `/library/modules/[tree]`. The two routes differ only in which tab opens, so
 * the fetch and the chrome live here rather than being duplicated per route.
 *
 * The tab is a path segment rather than local state or a `?tab=` query so that
 * a tab is linkable — which is what lets a detail page's "back to library"
 * return to the tab the module actually came from. A query string would have
 * forced this page dynamic (or the catalogue behind a Suspense fallback and out
 * of the static HTML); a path segment stays statically rendered.
 */
export async function ModuleLibraryScreen({
  locale,
  initialTab,
}: {
  locale: string;
  initialTab?: ModuleTree;
}) {
  const t = await getTranslations({ locale, namespace: "library" });

  const [categories, lists, sentences] = await Promise.all([
    preloadQuery(api.contentModules.categories.getPublicCategoryCatalogue, {}),
    preloadQuery(api.contentModules.lists.getPublicListCatalogue, {}),
    preloadQuery(api.contentModules.sentences.getPublicSentenceCatalogue, {}),
  ]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <header className="mb-10 text-center">
        <h1 className="text-display font-semibold text-foreground mb-3">
          {t("title")}
        </h1>
        <p className="text-body text-muted-foreground max-w-2xl mx-auto">
          {t("subtitle")}
        </p>
      </header>

      <ModuleLibrary
        categories={categories}
        lists={lists}
        sentences={sentences}
        locale={locale}
        initialTab={initialTab}
      />
    </div>
  );
}
