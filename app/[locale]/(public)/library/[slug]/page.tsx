import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { PackDetailContent } from "@/app/components/marketing/sections/PackDetailContent";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

// Re-render hourly so newly published / re-tiered packs roll out without a
// full deploy. Auth-aware CTA hydrates client-side via LoadPackButton.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const preloaded = await preloadQuery(api.resourcePacks.getPackDetailV2, {
    slug,
  });
  const pack = preloadedQueryResult(preloaded);
  if (!pack) {
    const t = await getTranslations({ locale, namespace: "library" });
    return { title: t("metaTitle") };
  }
  const name = displayString(pack.name, locale, DEFAULT_LOCALE);
  const description = displayString(pack.description, locale, DEFAULT_LOCALE);
  return {
    title: `${name} — Mo Speech Library`,
    description,
  };
}

export default async function PackDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const preloaded = await preloadQuery(api.resourcePacks.getPackDetailV2, {
    slug,
  });
  const pack = preloadedQueryResult(preloaded);
  if (!pack) notFound();

  return <PackDetailContent pack={pack} locale={locale} />;
}
