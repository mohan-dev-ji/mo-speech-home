"use client";

import { Lock } from "lucide-react";

/**
 * A single theme swatch — mirrors the Figma "Theme-picker-module"
 * (`3027:4093`). Each module is a true mini-preview of *its own* theme: the
 * background, dot/primary, divider/line and text colours are hard-coded to that
 * theme's hex (passed in), so the swatches stay accurate no matter which theme
 * is currently active.
 *
 * On  = 2px `primary` border, full opacity.
 * Off = no border, whole module at 50% opacity (sunk into the page), → 100% on hover.
 */
export function ThemeSwatch({
  name,
  bg,
  primary,
  line,
  textColor,
  selected,
  locked,
  onClick,
}: {
  name: string;
  /** This theme's own background hex (`tokens.background`). */
  bg: string;
  /** This theme's own primary hex — dot + selected border (`tokens.primary`). */
  primary: string;
  /** This theme's own hairline hex (`tokens.line`). */
  line: string;
  /** This theme's own main text hex (`tokens.altText`) — legible on its bg. */
  textColor: string;
  selected: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{ backgroundColor: bg, borderColor: selected ? primary : "transparent" }}
      className={`flex min-h-[4.5rem] w-full flex-col gap-theme-elements rounded-theme-sm border-2 border-solid p-theme-general text-left transition ${
        selected ? "" : "opacity-50 hover:opacity-100"
      }`}
    >
      <div className="flex items-center gap-theme-elements">
        <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: primary }} />
        <span className="truncate text-theme-p font-semibold" style={{ color: textColor }}>
          {name}
        </span>
        {locked && <Lock className="ml-auto size-3.5 shrink-0" style={{ color: textColor }} aria-hidden />}
      </div>
      <div className="h-px w-full" style={{ backgroundColor: line }} />
    </button>
  );
}
