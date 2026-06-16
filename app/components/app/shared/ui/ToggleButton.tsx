"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";

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
 * Toolbar toggle convenience composition over `Button` (`variant="toggle"`).
 * `pressed` → `active` (highlight); idle is the translucent `card` pill.
 * Styling lives in `Button` (the Figma "Button" atom).
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
    <Button
      variant="toggle"
      size="sm"
      active={pressed}
      disabled={disabled}
      onClick={onClick}
      icon={icon}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </Button>
  );
}
