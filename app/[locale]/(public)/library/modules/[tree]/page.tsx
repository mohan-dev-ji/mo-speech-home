import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ModuleLibraryScreen,
  MODULE_TREES,
  asModuleTree,
} from "@/app/components/marketing/sections/ModuleLibraryScreen";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; tree: string }>;
};

// The three trees are a closed set, so the per-tab pages prerender alongside
// the plain index rather than rendering on first request.
export function generateStaticParams() {
  return MODULE_TREES.map((tree) => ({ tree }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function ModuleLibraryTabPage({ params }: Props) {
  const { locale, tree } = await params;
  setRequestLocale(locale);
  const validTree = asModuleTree(tree);
  if (!validTree) notFound();
  return <ModuleLibraryScreen locale={locale} initialTab={validTree} />;
}
