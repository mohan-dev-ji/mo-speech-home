"use client";

import type { ReactNode } from "react";

type ToggleButtonProps = {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  // Optional aria-label override for icon-only or unclear-text contexts.
  ariaLabel?: string;
  title?: string;
};

/**
 * A toolbar button with explicit pressed/unpressed state.
 *
 * Visual language matches the existing toolbar buttons (see ListDetailContent's
 * Numbers / Checklist toggles): pressed uses --theme-button-highlight; unpressed
 * uses --theme-card. Disabled state is muted to 50% opacity with cursor-not-allowed.
 *
 * Used for the admin Default + Library toggles (see ADR-008 + the toggle-based
 * library state chunk).
 */
export function ToggleButton({
  pressed,
  disabled = false,
  onClick,
  icon,
  children,
  ariaLabel,
  title,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity"
      style={{
        background: pressed
          ? "var(--theme-button-highlight)"
          : "var(--theme-card)",
        color: pressed ? "var(--theme-text)" : "var(--theme-text-primary)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}
