"use client";

import { useTranslations } from "next-intl";

/**
 * Small "From pack" pill rendered next to a category name when it was loaded
 * from a library pack (`category.librarySourceId != null`). Provides
 * discoverability for the Reload Defaults button in the edit toolbar.
 *
 * Caller decides whether to mount based on librarySourceId.
 */
export function LibrarySourceBadge() {
  const t = useTranslations("categoryDetail");
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-caption font-medium bg-theme-card text-theme-secondary-text"
      role="note"
    >
      {t("librarySourceBadge")}
    </span>
  );
}
