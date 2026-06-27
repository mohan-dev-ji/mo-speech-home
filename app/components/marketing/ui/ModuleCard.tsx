"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { InstallModuleButton, type ModuleTree } from "./InstallModuleButton";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

export type ModuleCardData = {
  slug: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  coverImagePath: string | null;
  isStarter: boolean;
  featured: boolean;
  effectiveTier: "free" | "pro" | "max";
  // Exactly one of these is present, matching the module's tree.
  counts: { categories?: number; lists?: number; sentences?: number };
};

const tierBadgeVariant: Record<
  ModuleCardData["effectiveTier"],
  "success" | "default" | "warning"
> = {
  free: "success",
  pro: "default",
  max: "warning",
};

/**
 * A content-module card for the four-tab library (ADR-014 §3). Sibling of
 * {@link LibraryPackCard} but single-type and non-navigating (module detail
 * pages are out of scope for 13.2). The whole module installs as one folder.
 */
export function ModuleCard({
  module,
  tree,
  locale,
}: {
  module: ModuleCardData;
  tree: ModuleTree;
  locale: string;
}) {
  const t = useTranslations("library");
  const name = displayString(module.name, locale, DEFAULT_LOCALE);
  const coverSrc = module.coverImagePath
    ? `/api/assets?key=${encodeURIComponent(module.coverImagePath)}`
    : null;
  const tierLabel =
    module.effectiveTier === "free"
      ? t("tierBadgeFree")
      : module.effectiveTier === "pro"
        ? t("tierBadgePro")
        : t("tierBadgeMax");

  // One count line, keyed to the tree this card belongs to.
  const count =
    tree === "categories"
      ? module.counts.categories
      : tree === "lists"
        ? module.counts.lists
        : module.counts.sentences;
  const countLabel =
    tree === "categories"
      ? t("itemsCategories", { count: count ?? 0 })
      : tree === "lists"
        ? t("itemsLists", { count: count ?? 0 })
        : t("itemsSentences", { count: count ?? 0 });

  return (
    <article className="flex flex-col bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="relative aspect-square bg-muted">
        {coverSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverSrc}
            alt={name}
            loading="lazy"
            className="w-full h-full object-contain p-6"
          />
        ) : (
          <div className="w-full h-full" aria-hidden />
        )}
        <div className="absolute top-2 right-2">
          <Badge variant={tierBadgeVariant[module.effectiveTier]}>
            {tierLabel}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col p-4 gap-2">
        <h3 className="text-subheading font-semibold text-foreground">{name}</h3>
        <p className="text-caption text-muted-foreground">{countLabel}</p>
      </div>
      <div className="px-4 pb-4 mt-auto">
        <InstallModuleButton
          slug={module.slug}
          tree={tree}
          tier={module.effectiveTier}
        />
      </div>
    </article>
  );
}
