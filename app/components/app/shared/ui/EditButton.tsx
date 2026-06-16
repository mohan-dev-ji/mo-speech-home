"use client";

import { Pencil, LogOut } from "lucide-react";
import { Button } from "./Button";

type EditButtonProps = {
  isEditing: boolean;
  onClick: () => void;
  /** Label shown when not editing — e.g. "Edit list" */
  editLabel: string;
  /** Label shown when editing — e.g. "Exit edit" */
  exitLabel: string;
  /** Optional extra classes appended to the base styling. */
  className?: string;
};

/**
 * Edit / Exit-edit convenience composition over `Button`. Renders the prominent
 * `primary` variant by default; the orange `edit-mode` is used **only as the
 * active highlight while the page is in edit mode** (per the Figma banner). Owns
 * the icon + label flip; all styling lives in `Button` (the Figma "Button" atom).
 */
export function EditButton({
  isEditing,
  onClick,
  editLabel,
  exitLabel,
  className,
}: EditButtonProps) {
  return (
    <Button
      variant={isEditing ? "edit-mode" : "primary"}
      size="sm"
      active={isEditing}
      onClick={onClick}
      className={className}
      icon={
        isEditing ? (
          <LogOut className="w-3.5 h-3.5" />
        ) : (
          <Pencil className="w-3.5 h-3.5" />
        )
      }
    >
      {isEditing ? exitLabel : editLabel}
    </Button>
  );
}
