"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { LoadPackButton } from "./LoadPackButton";

export type LibraryPack = {
  // _id carries the packLifecycle row id (null for the starter pack if it
  // has no lifecycle row yet). The slug is the canonical identifier post-
  // ADR-010; load/dedup goes through `slug`.
  _id: string | null;
  slug: string;
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
  const coverSrc = `/api/assets?key=${encodeURIComponent(pack.coverImagePath)}`;
  const tierLabel =
    pack.tier === "free"
      ? t("tierBadgeFree")
      : pack.tier === "pro"
        ? t("tierBadgePro")
        : t("tierBadgeMax");

  const detailHref = `/${locale}/library/${pack.slug}`;

  return (
    <article className="flex flex-col bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Cover + title + stats wrap in a single Link so the whole card area
          above the Load button is a navigation target. Load button stays
          outside the Link so its click doesn't bubble into navigation —
          loading is a destructive action that shouldn't fire on a "view
          pack" intent. */}
      <Link
        href={detailHref}
        className="flex flex-col group"
        aria-label={t("detailViewLink") + ": " + name}
      >
        {/* Square cover area, fixed aspect so every card reads uniformly in
            the grid. `object-contain` + padding keeps the whole symbol
            visible at a consistent size, no cropping. */}
        <div className="relative aspect-square bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt={name}
            loading="lazy"
            className="w-full h-full object-contain p-6 transition-transform group-hover:scale-105"
          />
          <div className="absolute top-2 right-2">
            <Badge variant={tierBadgeVariant[pack.tier]}>{tierLabel}</Badge>
          </div>
        </div>
        <div className="flex flex-col p-4 gap-3">
          <h3 className="text-subheading font-semibold text-foreground group-hover:underline">
            {name}
          </h3>
          {/* Stats: vertical list, left-aligned. Each count on its own row.
              Description is intentionally dropped — saved for the detail page
              where there's room for a real marketing line. */}
          <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
            {pack.counts.categories > 0 && (
              <li>{t("itemsCategories", { count: pack.counts.categories })}</li>
            )}
            {pack.counts.lists > 0 && (
              <li>{t("itemsLists", { count: pack.counts.lists })}</li>
            )}
            {pack.counts.sentences > 0 && (
              <li>{t("itemsSentences", { count: pack.counts.sentences })}</li>
            )}
          </ul>
        </div>
      </Link>
      <div className="px-4 pb-4 mt-auto">
        <LoadPackButton
          packSlug={pack.slug}
          packTier={pack.tier}
          isStarter={pack.isStarter}
          locale={locale}
        />
      </div>
    </article>
  );
}
