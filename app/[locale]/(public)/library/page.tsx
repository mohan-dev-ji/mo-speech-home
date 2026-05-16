import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { LibraryGrid } from "@/app/components/marketing/sections/LibraryGrid";

// Statically render the catalogue and revalidate hourly.
// Auth-aware CTAs hydrate client-side via LoadPackButton — the SSR HTML always
// contains pack metadata for SEO crawlers regardless of caller auth state.
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

export default async function LibraryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "library" });

  const preloaded = await preloadQuery(
    api.resourcePacks.getPublicLibraryCatalogueV2,
    {}
  );

  // JSON-LD ItemList for SEO. Reads the same data shipped to the client.
  const packs = preloadedQueryResult(preloaded);
  const isHindi = locale === "hi";
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("title"),
    itemListElement: packs.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: (isHindi && p.name.hin) || p.name.eng,
      description: (isHindi && p.description.hin) || p.description.eng,
    })),
  };

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

      <LibraryGrid preloaded={preloaded} locale={locale} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
    </div>
  );
}
