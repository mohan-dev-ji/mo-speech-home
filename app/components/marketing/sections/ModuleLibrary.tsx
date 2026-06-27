"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "@/i18n/navigation";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "@/convex/_generated/api";
import { ModuleCard, type ModuleCardData } from "@/app/components/marketing/ui/ModuleCard";
import { ThemeSwatch } from "@/app/components/app/settings/ui/ThemeSwatch";
import { getThemeTokens } from "@/lib/themes/registry";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

type TabKey = "categories" | "lists" | "sentences" | "themes";

type Props = {
  categories: Preloaded<typeof api.contentModules.categories.getPublicCategoryCatalogue>;
  lists: Preloaded<typeof api.contentModules.lists.getPublicListCatalogue>;
  sentences: Preloaded<typeof api.contentModules.sentences.getPublicSentenceCatalogue>;
  themes: Preloaded<typeof api.themes.getPublicThemeCatalogue>;
  locale: string;
};

export function ModuleLibrary({
  categories,
  lists,
  sentences,
  themes,
  locale,
}: Props) {
  const t = useTranslations("library");
  const [tab, setTab] = useState<TabKey>("categories");

  const categoryModules = usePreloadedQuery(categories);
  const listModules = usePreloadedQuery(lists);
  const sentenceModules = usePreloadedQuery(sentences);
  const themeItems = usePreloadedQuery(themes);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "categories", label: t("tabCategories"), count: categoryModules.length },
    { key: "lists", label: t("tabLists"), count: listModules.length },
    { key: "sentences", label: t("tabSentences"), count: sentenceModules.length },
    { key: "themes", label: t("tabThemes"), count: themeItems.length },
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
      {tab === "themes" && (
        <ThemesShowcase themes={themeItems} locale={locale} />
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
  if (modules.length === 0) {
    return (
      <p className="text-body text-muted-foreground py-12 text-center">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {modules.map((m) => (
        <ModuleCard key={m.slug} module={m} tree={tree} locale={locale} />
      ))}
    </div>
  );
}

type ThemeItem = {
  slug: string;
  name: Record<string, string>;
  effectiveTier: "free" | "pro" | "max";
};

/**
 * Themes tab — a showcase, not an installer. Themes apply per-profile inside the
 * app shell (Settings → profile tabs), so the public library can only preview
 * them and route the user to where they apply: signed-in → Settings, signed-out
 * → sign-up. Reuses the in-app {@link ThemeSwatch} for accurate previews.
 */
function ThemesShowcase({
  themes,
  locale,
}: {
  themes: ThemeItem[];
  locale: string;
}) {
  const t = useTranslations("library");
  const router = useRouter();
  const { isSignedIn } = useUser();

  const renderable = themes
    .map((th) => ({ th, tokens: getThemeTokens(th.slug) }))
    .filter((x): x is { th: ThemeItem; tokens: NonNullable<ReturnType<typeof getThemeTokens>> } => !!x.tokens);

  if (renderable.length === 0) {
    return (
      <p className="text-body text-muted-foreground py-12 text-center">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted-foreground">{t("themesShowcaseHint")}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {renderable.map(({ th, tokens }) => (
          <ThemeSwatch
            key={th.slug}
            name={displayString(th.name, locale, DEFAULT_LOCALE)}
            bg={tokens.background}
            primary={tokens.primary}
            line={tokens.line}
            textColor={tokens.altText}
            selected={false}
            onClick={() => router.push(isSignedIn ? "/settings" : "/sign-up")}
          />
        ))}
      </div>
    </div>
  );
}
