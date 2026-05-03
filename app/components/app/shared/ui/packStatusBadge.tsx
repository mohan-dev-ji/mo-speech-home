"use client";

import type { Id } from "@/convex/_generated/dataModel";
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
