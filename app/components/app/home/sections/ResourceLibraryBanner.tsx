"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Library, ArrowRight } from "lucide-react";

/**
 * Home resource-library banner — the placeholder that replaced the old
 * library-packs carousel when the resource-pack system was torn down (Phase
 * 14.5 Stage 2). For now it's a single full-width hero strip: an H1 that links
 * to the resource-library marketing page (`/library/modules`) so admins have a
 * quick jump while authoring modules.
 *
 * Intended growth path: this becomes an animating module carousel. Keep it a
 * self-contained section so that redesign lands here without touching
 * HomeContent's composition.
 */
export function ResourceLibraryBanner() {
  const t = useTranslations("home");
  const params = useParams();
  const locale = params.locale as string;

  return (
    <Link
      href={`/${locale}/library/modules`}
      aria-label={t("resourceLibraryAria")}
      className="group flex items-center gap-theme-gap w-full min-h-[140px] md:min-h-[180px] p-theme-general rounded-theme-card bg-theme-card text-theme-secondary-alt-text border border-transparent transition-colors hover:bg-theme-surface hover:text-theme-alt-text hover:border-theme-line cursor-pointer"
    >
      <span className="inline-flex items-center justify-center shrink-0 [&_svg]:w-10 [&_svg]:h-10 md:[&_svg]:w-12 md:[&_svg]:h-12">
        <Library />
      </span>

      <span className="flex flex-col gap-1 min-w-0">
        <h1 className="text-theme-h1 font-semibold text-theme-alt-text truncate">
          {t("resourceLibraryTitle")}
        </h1>
        <span className="text-theme-p truncate">
          {t("resourceLibrarySubtitle")}
        </span>
      </span>

      <span className="ml-auto inline-flex items-center justify-center shrink-0 [&_svg]:w-6 [&_svg]:h-6 transition-transform group-hover:translate-x-1">
        <ArrowRight />
      </span>
    </Link>
  );
}
