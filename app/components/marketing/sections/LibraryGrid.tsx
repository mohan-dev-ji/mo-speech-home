"use client";

import { useTranslations } from "next-intl";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "@/convex/_generated/api";
import { LibraryPackCard, type LibraryPack } from "@/app/components/marketing/ui/LibraryPackCard";

type Props = {
  preloaded: Preloaded<typeof api.resourcePacks.getPublicLibraryCatalogueV2>;
  locale: string;
};

export function LibraryGrid({ preloaded, locale }: Props) {
  const t = useTranslations("library");
  const packs = usePreloadedQuery(preloaded);

  if (packs.length === 0) {
    return (
      <p className="text-body text-muted-foreground py-12 text-center">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {packs.map((pack) => (
        <LibraryPackCard key={pack.slug} pack={pack as LibraryPack} locale={locale} />
      ))}
    </div>
  );
}
