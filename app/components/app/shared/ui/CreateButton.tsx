"use client";

import { Plus } from "lucide-react";
import { Button } from "./Button";

type CreateButtonProps = {
  onClick: () => void;
  /** Visible label — always supplied by the consumer so it can be localised
   *  in the right namespace ("Create list", "Create sentence", etc.). */
  label: string;
  disabled?: boolean;
  /** Optional extra classes appended to the base styling. */
  className?: string;
};

/**
 * "Create new" convenience composition over `Button`. Renders the `primary`
 * variant (per the Figma banner — all banner actions are primary); adds the
 * `Plus` icon. Styling lives in `Button` (the Figma "Button" atom).
 */
export function CreateButton({
  onClick,
  label,
  disabled = false,
  className,
}: CreateButtonProps) {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={className}
      icon={<Plus className="w-3.5 h-3.5" />}
    >
      {label}
    </Button>
  );
}
