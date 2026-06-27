import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ModuleDetailContent } from "@/app/components/marketing/sections/ModuleDetailContent";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

export const revalidate = 3600;

const TREES = ["categories", "lists", "sentences"] as const;
type Tree = (typeof TREES)[number];

type Props = {
  params: Promise<{ locale: string; tree: string; slug: string }>;
};

function asTree(tree: string): Tree | null {
  return (TREES as readonly string[]).includes(tree) ? (tree as Tree) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tree, slug } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  const validTree = asTree(tree);
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
  const validTree = asTree(tree);
  if (!validTree) notFound();

  const preloaded = await preloadQuery(api.contentModules.detail.getModuleDetail, {
    tree: validTree,
    slug,
  });
  const module = preloadedQueryResult(preloaded);
  if (!module) notFound();

  return <ModuleDetailContent module={module} locale={locale} />;
}
