"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";

type PackStatusInfo = {
  starterPackId: Id<"resourcePacks"> | null;
  libraryPacksById: Record<
    string,
    { tier: "free" | "pro" | "max"; name: { eng: string; hin?: string } }
  >;
};

type DerivedStatus = {
  label: "Default" | "Free" | "Pro" | "Max";
  variant: "default" | "outline" | "success";
};

/**
 * Derive a badge label + variant from an item's `publishedToPackId` and the
 * page-level pack status. Returns null when the item is unpublished.
 *
 * Used by CategoryTile, list rows, sentence rows, and banner editors. The
 * caller should subscribe to `api.resourcePacks.getPacksForAdminStatus` once
 * at the page level and pass it in here for each item.
 *
 * Translation keys for the labels live in `common.badge*` (see translation
 * keys for this chunk).
 */
export function deriveAdminPackStatus(
  publishedToPackId: Id<"resourcePacks"> | undefined,
  packs: PackStatusInfo | undefined
): DerivedStatus | null {
  if (!publishedToPackId || !packs) return null;
  if (packs.starterPackId && publishedToPackId === packs.starterPackId) {
    return { label: "Default", variant: "default" };
  }
  const libraryPack = packs.libraryPacksById[publishedToPackId];
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
  publishedToPackId: Id<"resourcePacks"> | undefined;
  packs: PackStatusInfo | undefined;
  className?: string;
};

/**
 * Convenience wrapper — renders nothing if there's no status. The label text
 * is plain English ("Default", "Free", "Pro", "Max"). For localised labels,
 * pass `getLabel` and call `deriveAdminPackStatus` directly.
 */
export function AdminPackBadge({
  publishedToPackId,
  packs,
  className,
}: AdminPackBadgeProps) {
  const status = deriveAdminPackStatus(publishedToPackId, packs);
  if (!status) return null;
  return (
    <Badge variant={status.variant} className={className}>
      {status.label}
    </Badge>
  );
}

type PackStatusLabelProps = {
  publishedToPackId: Id<"resourcePacks"> | undefined;
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
 *
 * Uses AAC theme tokens via inline style + CSS vars (matches the existing
 * `OVERLAY_BG` pattern in CategoryTile). Caller controls placement; the
 * component just renders an inline-flex pill.
 */
export function PackStatusLabel({
  publishedToPackId,
  packs,
  language,
  className,
}: PackStatusLabelProps) {
  const t = useTranslations("packStatus");

  if (!publishedToPackId || !packs) return null;

  const isStarter =
    packs.starterPackId !== null && publishedToPackId === packs.starterPackId;

  const libraryPack = isStarter
    ? null
    : packs.libraryPacksById[publishedToPackId];

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
