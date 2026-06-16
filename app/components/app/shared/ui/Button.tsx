"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";

/**
 * The single AAC button — mirrors the Figma "Button" component (Components page,
 * `variant` property). One component, all variants; bound to AAC theme tokens
 * (`--theme-button-*`, `rounded-theme-button`, `.elevation-subtle`).
 *
 * Consolidates the former `EditButton` / `CreateButton` / `ToggleButton` (now
 * the `edit-mode` / `create` / `toggle` variants). `ghost` / `destructive` and
 * the `sm|md|lg` sizes are kept as utility extensions for non-banner usage
 * (settings modals, admin) — they were already part of this component's API.
 *
 * NOT this component: `NavTabButton` (the navbar on/off button) is separate.
 *
 * Token notes:
 *  - `primary`   — whitish `button-primary` fill + dark `button-secondary` text
 *    (Figma "Button" Primary; both are fixed :root constants, theme-independent).
 *  - `secondary` — inverse: dark `button-secondary` fill + whitish `button-primary` text.
 *  - `toggle`    — `active` → highlight + dark text; idle → translucent `card` pill.
 *  - `edit-mode` — orange `enter-mode`; `active` (in-edit) dims to 70%.
 *  - `create`    — green `--theme-create`.
 */

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "toggle"
  | "edit-mode"
  | "create";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Left-aligned icon (Figma `icon-left`). */
  icon?: ReactNode;
  /** Pressed / in-edit state for the `toggle` and `edit-mode` variants. */
  active?: boolean;
}

const RAISED = "elevation-subtle";

function variantClass(variant: Variant, active: boolean): string {
  switch (variant) {
    case "primary":
      return `bg-theme-button-primary text-theme-button-secondary ${RAISED}`;
    case "secondary":
      return `bg-theme-button-secondary text-theme-button-primary ${RAISED}`;
    case "toggle":
      return active
        ? `bg-theme-button-highlight text-theme-text ${RAISED}`
        : "bg-theme-card text-theme-alt-text";
    case "edit-mode":
      return active
        ? // dimmed while in edit (the editing UI carries the visual weight)
          "text-theme-button-primary [background:color-mix(in_srgb,var(--theme-enter-mode)_70%,transparent)]"
        : `bg-theme-enter-mode text-theme-button-primary ${RAISED}`;
    case "create":
      return `bg-theme-create text-theme-button-primary ${RAISED}`;
    case "ghost":
      return "text-theme-alt-text hover:bg-theme-card";
    case "destructive":
      return `bg-theme-warning text-theme-button-primary ${RAISED}`;
  }
}

// Padding / gap / roundness come from theme spacing tokens (shared by every
// control so heights line up); `size` only scales the font.
const sizes: Record<Size, string> = {
  sm: "text-theme-s",
  md: "text-theme-p",
  lg: "text-theme-large",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      active = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-pressed={
        variant === "toggle" || variant === "edit-mode" ? active : undefined
      }
      className={cn(
        "inline-flex items-center justify-center font-medium border border-theme-line",
        "rounded-theme-button px-theme-btn-x py-theme-btn-y gap-theme-elements",
        "transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        sizes[size],
        variantClass(variant, active),
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
);

Button.displayName = "Button";
