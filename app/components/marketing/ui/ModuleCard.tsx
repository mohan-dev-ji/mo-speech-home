"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { InstallModuleButton, type ModuleTree } from "./InstallModuleButton";
import {
  moduleClass,
  MODULE_CLASS_BADGE,
  MODULE_CLASS_LABEL_KEY,
} from "./moduleClass";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

export type ModuleCardData = {
  slug: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  coverImagePath: string | null;
  isStarter: boolean;
  isDefault: boolean;
  featured: boolean;
  effectiveTier: "free" | "pro" | "max";
  // Exactly one of these is present, matching the module's tree.
  counts: { categories?: number; lists?: number; sentences?: number; phrases?: number };
};

/**
 * A content-module card for the four-tab library (ADR-014 §3). Sibling of
 * {@link LibraryPackCard} but single-type: the cover + name + count link to the
 * module detail page, while the install button sits outside that link. The whole
 * module installs as one folder.
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
  const detailHref = `/${locale}/library/modules/${tree}/${module.slug}`;
  const coverSrc = module.coverImagePath
    ? `/api/assets?key=${encodeURIComponent(module.coverImagePath)}`
    : null;
  const cls = moduleClass(module.isDefault, module.effectiveTier);
  const tierLabel = t(MODULE_CLASS_LABEL_KEY[cls]);

  // One count line, keyed to the tree this card belongs to.
  const count =
    tree === "categories"
      ? module.counts.categories
      : tree === "lists"
        ? module.counts.lists
        : tree === "sentences"
          ? module.counts.sentences
          : module.counts.phrases;
  const countLabel =
    tree === "categories"
      ? t("itemsCategories", { count: count ?? 0 })
      : tree === "lists"
        ? t("itemsLists", { count: count ?? 0 })
        : tree === "sentences"
          ? t("itemsSentences", { count: count ?? 0 })
          : t("itemsPhrases", { count: count ?? 0 });

  // Phrase modules are install-only — they surface in the talker dropdown, not a
  // detail-preview page — so their card is not a navigation link (ADR-015).
  const linkToDetail = tree !== "phrases";

  const inner = (
    <>
      <div className="relative aspect-square bg-muted">
        {coverSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverSrc}
            alt={name}
            loading="lazy"
            className="w-full h-full object-contain p-6 transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full" aria-hidden />
        )}
        <div className="absolute top-2 right-2">
          <Badge variant={MODULE_CLASS_BADGE[cls]}>{tierLabel}</Badge>
        </div>
      </div>
      <div className="flex flex-col p-4 gap-2">
        <h3 className="text-subheading font-semibold text-foreground group-hover:underline">
          {name}
        </h3>
        <p className="text-caption text-muted-foreground">{countLabel}</p>
      </div>
    </>
  );

  return (
    <article className="flex flex-col bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Cover + name + count link to the detail page (except phrases); the
          install button sits outside the link so installing doesn't fire on a
          "view" intent. */}
      {linkToDetail ? (
        <Link
          href={detailHref}
          className="flex flex-col group"
          aria-label={t("moduleViewLink", { name })}
        >
          {inner}
        </Link>
      ) : (
        <div className="flex flex-col">{inner}</div>
      )}
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
