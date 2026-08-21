import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ModuleDetailContent } from "@/app/components/marketing/sections/ModuleDetailContent";
import { asModuleTree } from "@/app/components/marketing/sections/ModuleLibraryScreen";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; tree: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tree, slug } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  const validTree = asModuleTree(tree);
  if (!validTree) return { title: t("metaTitle") };
  const preloaded = await preloadQuery(api.contentModules.detail.getModuleDetail, {
    tree: validTree,
    slug,
  });
  const module = preloadedQueryResult(preloaded);
  if (!module) return { title: t("metaTitle") };
  return {
    title: `${displayString(module.name, locale, DEFAULT_LOCALE)} — Mo Speech Library`,
    description: module.description
      ? displayString(module.description, locale, DEFAULT_LOCALE)
      : undefined,
  };
}

export default async function ModuleDetailPage({ params }: Props) {
  const { locale, tree, slug } = await params;
  setRequestLocale(locale);
  const validTree = asModuleTree(tree);
  if (!validTree) notFound();

  const preloaded = await preloadQuery(api.contentModules.detail.getModuleDetail, {
    tree: validTree,
    slug,
  });
  const module = preloadedQueryResult(preloaded);
  if (!module) notFound();

  return <ModuleDetailContent module={module} locale={locale} />;
}
