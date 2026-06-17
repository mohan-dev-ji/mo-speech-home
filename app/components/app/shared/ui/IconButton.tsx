"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

/**
 * Icon-only square button — mirrors the Figma "Icon-button" component
 * (Components page `3080:251`, `Style` property: Primary / Neutral / Ghost).
 * 48² box, 24² glyph (centred → the Figma 12px padding), `rounded-theme-button`,
 * `.elevation-subtle`. The shared atom for every icon-only affordance:
 * Edit-panel, symbol/category edit controls, talker controls, Topbar.
 *
 * Variant fills mirror Button's primary/secondary inversion (both fixed :root
 * constants, theme-independent — so the glyph stays legible on any theme):
 *  - `primary` — dark `button-secondary` fill + light `button-primary` glyph; no stroke.
 *  - `neutral` — light `button-primary` fill + dark `button-secondary` glyph + line stroke.
 *  - `ghost`   — transparent + line stroke; glyph = theme `alt-text`.
 *
 * Icon-only → an accessible name is required: pass `label` (→ `aria-label`).
 * The glyph inherits `currentColor`, so the per-variant `text-*` cascades to it.
 */

type Variant = "primary" | "neutral" | "ghost";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  variant?: Variant;
  /** The glyph (e.g. a lucide icon). Forced to 24² via `[&_svg]:size-6`. */
  icon: ReactNode;
  /** Required accessible name for the icon-only control (→ `aria-label`). */
  label: string;
}

const RAISED = "elevation-subtle";

function variantClass(variant: Variant): string {
  switch (variant) {
    case "primary":
      return `bg-theme-button-secondary text-theme-button-primary ${RAISED}`;
    case "neutral":
      return `bg-theme-button-primary text-theme-button-secondary border border-theme-line ${RAISED}`;
    case "ghost":
      return `text-theme-alt-text border border-theme-line ${RAISED}`;
  }
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "primary", icon, label, disabled, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-theme-button [&_svg]:size-6",
        "transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        variantClass(variant),
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
);

IconButton.displayName = "IconButton";
