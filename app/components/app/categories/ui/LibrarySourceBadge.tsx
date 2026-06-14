"use client";

import { useTranslations } from "next-intl";

type Props = {
  /**
   * Optional resolved pack display name (already localised). When provided,
   * the badge renders "From <packName>" via the `fromPackBadge` key.
   * When omitted, falls back to the generic "From pack" copy — useful
   * before packsStatus loads.
   */
  packName?: string;
};

/**
 * Small "From pack" pill rendered next to a category / list / sentence
 * name when it was loaded from a library pack
 * (`row.librarySourceId != null`). Provides discoverability of the
 * Reload Defaults flow and signals lineage at a glance.
 *
 * Caller decides whether to mount based on librarySourceId, and resolves
 * the localised pack name from `packsStatus` (the page-level
 * `getPacksForAdminStatusV2` subscription) before passing it in.
 */
export function LibrarySourceBadge({ packName }: Props = {}) {
  const t = useTranslations("packPicker");
  const tFallback = useTranslations("categoryDetail");
  const label = packName
    ? t("fromPackBadge", { packName })
    : tFallback("librarySourceBadge");
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-caption font-medium bg-theme-surface text-theme-secondary-text"
      role="note"
    >
      {label}
    </span>
  );
}
