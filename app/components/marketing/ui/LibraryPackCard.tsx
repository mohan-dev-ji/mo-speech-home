"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { LoadPackButton } from "./LoadPackButton";
import type { Id } from "@/convex/_generated/dataModel";

export type LibraryPack = {
  _id: Id<"resourcePacks">;
  name: { eng: string; hin?: string };
  description: { eng: string; hin?: string };
  coverImagePath: string;
  season?: string;
  tags: string[];
  featured: boolean;
  tier: "free" | "pro" | "max";
  isStarter: boolean;
  counts: { categories: number; lists: number; sentences: number };
};

const tierBadgeVariant: Record<
  LibraryPack["tier"],
  "success" | "default" | "warning"
> = {
  free: "success",
  pro: "default",
  max: "warning",
};

export function LibraryPackCard({
  pack,
  locale,
}: {
  pack: LibraryPack;
  locale: string;
}) {
  const t = useTranslations("library");
  const isHindi = locale === "hi";
  const name = (isHindi && pack.name.hin) || pack.name.eng;
  const description = (isHindi && pack.description.hin) || pack.description.eng;
  const coverSrc = `/api/assets?key=${encodeURIComponent(pack.coverImagePath)}`;
  const tierLabel =
    pack.tier === "free"
      ? t("tierBadgeFree")
      : pack.tier === "pro"
        ? t("tierBadgePro")
        : t("tierBadgeMax");

  return (
    <article className="flex flex-col bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-[3/2] bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverSrc}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <Badge variant={tierBadgeVariant[pack.tier]}>{tierLabel}</Badge>
        </div>
      </div>
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-subheading font-semibold text-foreground">{name}</h3>
          <p className="text-small text-muted-foreground line-clamp-3">
            {description}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-caption text-muted-foreground">
          {pack.counts.categories > 0 && (
            <li className="px-2 py-0.5 rounded-full bg-muted">
              {t("itemsCategories", { count: pack.counts.categories })}
            </li>
          )}
          {pack.counts.lists > 0 && (
            <li className="px-2 py-0.5 rounded-full bg-muted">
              {t("itemsLists", { count: pack.counts.lists })}
            </li>
          )}
          {pack.counts.sentences > 0 && (
            <li className="px-2 py-0.5 rounded-full bg-muted">
              {t("itemsSentences", { count: pack.counts.sentences })}
            </li>
          )}
        </ul>
        <div className="mt-auto pt-2">
          <LoadPackButton
            packId={pack._id}
            packTier={pack.tier}
            isStarter={pack.isStarter}
            locale={locale}
          />
        </div>
      </div>
    </article>
  );
}
