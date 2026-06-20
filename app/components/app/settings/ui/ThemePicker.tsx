"use client";

import { useTranslations } from "next-intl";
import { getThemeTokens } from "@/lib/themes/registry";
import { displayValue } from "@/lib/languages/displayValue";
import { ThemeSwatch } from "./ThemeSwatch";

type Tier = "free" | "pro" | "max";

type ThemeCatalogueItem = {
  slug: string;
  name: Record<string, string>;
  effectiveTier: Tier;
};

/** Relative luminance of a `#RRGGBB` hex; > 0.5 ⇒ a light background. */
function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false; // non-hex (e.g. rgba) backgrounds are our dark themes
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

/**
 * The theme picker — splits the catalogue into Dark / Light / Pro groups, each
 * with its own heading, and renders a {@link ThemeSwatch} per theme using that
 * theme's own hard-coded hex (so swatches preview their true colours). "Pro"
 * collects every tier-gated theme regardless of light/dark.
 *
 * Used by both the Instructor and Student profile tabs; category headings come
 * from the shared `common` namespace.
 */
export function ThemePicker({
  themes,
  value,
  onSelect,
  isLocked,
  uiLocale,
}: {
  themes: ThemeCatalogueItem[];
  value: string;
  onSelect: (slug: string, tier: Tier) => void;
  isLocked: (tier: Tier) => boolean;
  uiLocale: string;
}) {
  const t = useTranslations("common");

  const dark: ThemeCatalogueItem[] = [];
  const light: ThemeCatalogueItem[] = [];
  const pro: ThemeCatalogueItem[] = [];

  for (const th of themes) {
    const tokens = getThemeTokens(th.slug);
    if (!tokens) continue;
    if (th.effectiveTier !== "free") pro.push(th);
    else if (isLightHex(tokens.background)) light.push(th);
    else dark.push(th);
  }

  const groups = [
    { key: "dark", label: t("themesDark"), items: dark },
    { key: "light", label: t("themesLight"), items: light },
    { key: "pro", label: t("themesPro"), items: pro },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-theme-gap">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-theme-elements">
          <p className="text-theme-s font-semibold text-theme-secondary-alt-text">{group.label}</p>
          <div className="grid grid-cols-2 gap-theme-gap sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {group.items.map((th) => {
              const tokens = getThemeTokens(th.slug)!;
              return (
                <ThemeSwatch
                  key={th.slug}
                  name={displayValue(th.name, uiLocale, "en") ?? th.slug}
                  bg={tokens.background}
                  primary={tokens.primary}
                  line={tokens.line}
                  textColor={tokens.altText}
                  selected={value === th.slug}
                  locked={isLocked(th.effectiveTier)}
                  onClick={() => onSelect(th.slug, th.effectiveTier)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
