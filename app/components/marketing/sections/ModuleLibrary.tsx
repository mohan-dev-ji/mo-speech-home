"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "@/convex/_generated/api";
import { ModuleCard, type ModuleCardData } from "@/app/components/marketing/ui/ModuleCard";
import {
  moduleClass,
  MODULE_CLASSES,
  MODULE_CLASS_LABEL_KEY,
  type ModuleClass,
} from "@/app/components/marketing/ui/moduleClass";

type TabKey = "categories" | "lists" | "sentences";

type Props = {
  categories: Preloaded<typeof api.contentModules.categories.getPublicCategoryCatalogue>;
  lists: Preloaded<typeof api.contentModules.lists.getPublicListCatalogue>;
  sentences: Preloaded<typeof api.contentModules.sentences.getPublicSentenceCatalogue>;
  locale: string;
};

export function ModuleLibrary({
  categories,
  lists,
  sentences,
  locale,
}: Props) {
  const t = useTranslations("library");
  const [tab, setTab] = useState<TabKey>("categories");

  const categoryModules = usePreloadedQuery(categories);
  const listModules = usePreloadedQuery(lists);
  const sentenceModules = usePreloadedQuery(sentences);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "categories", label: t("tabCategories"), count: categoryModules.length },
    { key: "lists", label: t("tabLists"), count: listModules.length },
    { key: "sentences", label: t("tabSentences"), count: sentenceModules.length },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t("tabsAriaLabel")}
        className="flex flex-wrap gap-2 border-b border-border"
      >
        {tabs.map((tb) => {
          const active = tb.key === tab;
          return (
            <button
              key={tb.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-body font-medium transition-colors ${
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.label}
              <span className="ml-1.5 text-caption text-muted-foreground">
                {tb.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {tab === "categories" && (
        <ModuleGrid
          modules={categoryModules}
          tree="categories"
          locale={locale}
          emptyLabel={t("empty")}
        />
      )}
      {tab === "lists" && (
        <ModuleGrid
          modules={listModules}
          tree="lists"
          locale={locale}
          emptyLabel={t("empty")}
        />
      )}
      {tab === "sentences" && (
        <ModuleGrid
          modules={sentenceModules}
          tree="sentences"
          locale={locale}
          emptyLabel={t("empty")}
        />
      )}
    </div>
  );
}

function ModuleGrid({
  modules,
  tree,
  locale,
  emptyLabel,
}: {
  modules: ModuleCardData[];
  tree: "categories" | "lists" | "sentences";
  locale: string;
  emptyLabel: string;
}) {
  const t = useTranslations("library");
  const [filter, setFilter] = useState<ModuleClass | "all">("all");

  // Count per display class so we only show filters that have modules.
  const countByClass = useMemo(() => {
    const c: Record<ModuleClass, number> = { default: 0, free: 0, pro: 0, max: 0 };
    for (const m of modules) c[moduleClass(m.isDefault, m.effectiveTier)]++;
    return c;
  }, [modules]);

  const classesPresent = MODULE_CLASSES.filter((c) => countByClass[c] > 0);
  const visible =
    filter === "all"
      ? modules
      : modules.filter((m) => moduleClass(m.isDefault, m.effectiveTier) === filter);

  if (modules.length === 0) {
    return (
      <p className="text-body text-muted-foreground py-12 text-center">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter badges — only render when there's more than one class to pick. */}
      {classesPresent.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {(["all", ...classesPresent] as const).map((c) => {
            const active = filter === c;
            const label =
              c === "all" ? t("filterByClassAll") : t(MODULE_CLASS_LABEL_KEY[c]);
            const count = c === "all" ? modules.length : countByClass[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-caption font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                <span className="ml-1.5 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {visible.map((m) => (
          <ModuleCard key={m.slug} module={m} tree={tree} locale={locale} />
        ))}
      </div>
    </div>
  );
}
