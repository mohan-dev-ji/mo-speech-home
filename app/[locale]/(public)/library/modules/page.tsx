import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ModuleLibrary } from "@/app/components/marketing/sections/ModuleLibrary";

// Auth-aware install CTAs hydrate client-side; the catalogue itself is public.
// Revalidate hourly like the pack library.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ModuleLibraryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "library" });

  const [categories, lists, sentences, themes] = await Promise.all([
    preloadQuery(api.contentModules.categories.getPublicCategoryCatalogue, {}),
    preloadQuery(api.contentModules.lists.getPublicListCatalogue, {}),
    preloadQuery(api.contentModules.sentences.getPublicSentenceCatalogue, {}),
    preloadQuery(api.themes.getPublicThemeCatalogue, {}),
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
        themes={themes}
        locale={locale}
      />
    </div>
  );
}
