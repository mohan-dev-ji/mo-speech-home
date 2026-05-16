"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";

/**
 * V2 (ADR-010): pack status shape keyed by slug. The starter pack is a
 * fixed slug literal (`"_starter"`); library packs are looked up from the
 * page-level `getPacksForAdminStatusV2` query.
 */
export type PackStatusInfo = {
  starterSlug: string;
  libraryPacksBySlug: Record<
    string,
    { tier: "free" | "pro" | "max"; name: { eng: string; hin?: string } }
  >;
};

type DerivedStatus = {
  label: "Default" | "Free" | "Pro" | "Max";
  variant: "default" | "outline" | "success";
};

/**
 * Derive a badge label + variant from an item's `packSlug` and the
 * page-level pack status. Returns null when the item is unpublished.
 *
 * Used by CategoryTile, list rows, sentence rows, and banner editors. The
 * caller should subscribe to `api.resourcePacks.getPacksForAdminStatusV2`
 * once at the page level and pass it in here for each item.
 */
export function deriveAdminPackStatus(
  packSlug: string | undefined,
  packs: PackStatusInfo | undefined
): DerivedStatus | null {
  if (!packSlug || !packs) return null;
  if (packSlug === packs.starterSlug) {
    return { label: "Default", variant: "default" };
  }
  const libraryPack = packs.libraryPacksBySlug[packSlug];
  if (!libraryPack) return null;
  switch (libraryPack.tier) {
    case "free":
      return { label: "Free", variant: "outline" };
    case "pro":
      return { label: "Pro", variant: "default" };
    case "max":
      return { label: "Max", variant: "success" };
  }
}

type AdminPackBadgeProps = {
  packSlug: string | undefined;
  packs: PackStatusInfo | undefined;
  className?: string;
};

export function AdminPackBadge({
  packSlug,
  packs,
  className,
}: AdminPackBadgeProps) {
  const status = deriveAdminPackStatus(packSlug, packs);
  if (!status) return null;
  return (
    <Badge variant={status.variant} className={className}>
      {status.label}
    </Badge>
  );
}

type PackStatusLabelProps = {
  packSlug: string | undefined;
  packs: PackStatusInfo | undefined;
  language: string;
  className?: string;
};

/**
 * Richer admin-only label for an item's pack lineage.
 *
 * - Starter pack → "Default"
 * - Library pack → "{Pack Name} · {Tier}" (localised pack name + tier)
 * - No pack / loading → renders nothing
 */
export function PackStatusLabel({
  packSlug,
  packs,
  language,
  className,
}: PackStatusLabelProps) {
  const t = useTranslations("packStatus");

  if (!packSlug || !packs) return null;

  const isStarter = packSlug === packs.starterSlug;
  const libraryPack = isStarter ? null : packs.libraryPacksBySlug[packSlug];

  if (!isStarter && !libraryPack) return null;

  const baseClass = [
    "inline-flex items-center gap-1 max-w-full rounded-full font-semibold",
    "px-2 py-0.5 text-[10px] uppercase tracking-wide",
    "bg-zinc-800 text-white",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isStarter) {
    return <span className={baseClass}>{t("default")}</span>;
  }

  const packName =
    language === "hin" && libraryPack!.name.hin
      ? libraryPack!.name.hin
      : libraryPack!.name.eng;

  return (
    <span className={baseClass}>
      <span className="truncate">{packName}</span>
      <span className="opacity-50">·</span>
      <span className="opacity-90 shrink-0">{t(libraryPack!.tier)}</span>
    </span>
  );
}
