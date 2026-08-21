import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModuleLibraryScreen } from "@/app/components/marketing/sections/ModuleLibraryScreen";

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
  // No tree segment — opens on Categories, the pre-existing default.
  return <ModuleLibraryScreen locale={locale} />;
}
