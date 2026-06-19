"use client";

import { useTranslations } from "next-intl";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

export type LibraryPack =
  FunctionReturnType<typeof api.resourcePacks.getPublicLibraryCatalogueV2>[number];

// Per-tier accent for the pill text — references theme tokens, never literals.
const TIER_COLOUR: Record<LibraryPack["tier"], string> = {
  free: "var(--theme-create)",
  pro: "var(--theme-brand-primary)",
  max: "var(--theme-enter-mode)",
};

type Props = {
  pack: LibraryPack;
  locale: string;
  isLoaded: boolean;
  isLoading: boolean;
  onLoad: () => void;
};

/**
 * Pack-card (home) — the Figma "Pack-card" component (`1432:20808`): tier pill,
 * pack name, white symbol thumbnail, then a full-width Load / Already-Loaded
 * button. Self-contained presentational card; the parent owns the load action
 * and loaded/loading state.
 */
export function PackCard({ pack, locale, isLoaded, isLoading, onLoad }: Props) {
  const t = useTranslations("home");
  const name = displayString(pack.name, locale, DEFAULT_LOCALE);
  const tierLabel =
    pack.tier === "free" ? t("tierFree") : pack.tier === "pro" ? t("tierPro") : t("tierMax");

  return (
    <div className="flex flex-col items-center gap-theme-gap w-[180px] shrink-0 p-theme-general rounded-theme-pack bg-theme-pack-bg">
      {/* Title block — tier pill + pack name */}
      <div className="flex flex-col items-center gap-2 w-full">
        <span
          className="inline-flex items-center justify-center px-3 py-1 rounded-theme-chip border border-theme-line bg-theme-pill-bg text-theme-s font-semibold"
          style={{ color: TIER_COLOUR[pack.tier] }}
        >
          {tierLabel}
        </span>
        <p className="text-theme-h4 font-semibold text-center text-theme-alt-text truncate w-full">
          {name}
        </p>
      </div>

      {/* White symbol thumbnail */}
      <div className="flex items-center justify-center w-full aspect-square p-theme-general rounded-theme-sm bg-theme-symbol-bg">
        {pack.coverImagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets?key=${encodeURIComponent(pack.coverImagePath)}`}
            alt=""
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        ) : null}
      </div>

      {/* Load / Already-Loaded button */}
      {isLoaded ? (
        <button
          type="button"
          disabled
          className="w-full h-11 rounded-theme-button border border-theme-line bg-theme-button-primary text-theme-button-secondary text-theme-p font-medium opacity-50 cursor-not-allowed elevation-subtle"
        >
          {t("packLoaded")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onLoad}
          disabled={isLoading}
          className="w-full h-11 rounded-theme-button border border-theme-line text-theme-p font-medium transition-opacity disabled:opacity-60 cursor-pointer elevation-subtle"
          style={{ background: "var(--theme-brand-primary)", color: "var(--theme-alt-text)" }}
        >
          {isLoading ? t("packLoading") : t("packLoad")}
        </button>
      )}
    </div>
  );
}
