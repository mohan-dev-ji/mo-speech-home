"use client";

import { Pencil, LogOut } from "lucide-react";

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
 * Universal Edit / Exit-edit button.
 *
 * Uses `--theme-enter-mode` (the orange edit-mode token) as a solid fill so
 * the affordance stands out from the rest of the toolbar in any theme. The
 * same vivid colour stays in both states; only the icon + label flip,
 * mirroring how dashed outlines around editable items also use this token.
 *
 * Labels are consumer-supplied (no embedded translations) so the component
 * stays dumb and reusable across `lists`, `categoryDetail`, `sentences`, etc.
 *
 * Currently used on:
 *   - app/components/app/lists/sections/ListDetailContent.tsx
 *
 * Future: replace inline Edit buttons across the app once the visual
 * treatment has stabilised in production use.
 */
export function EditButton({
  isEditing,
  onClick,
  editLabel,
  exitLabel,
  className,
}: EditButtonProps) {
  const baseClass = [
    "flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm",
    "text-theme-s font-semibold transition-opacity hover:opacity-90",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-[var(--theme-enter-mode)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={baseClass}
      style={{
        // Solid orange when off, dimmed when on — the in-edit state is
        // muted so the rest of the editing UI (dashed outlines, controls)
        // can carry the visual weight.
        background: isEditing
          ? "color-mix(in srgb, var(--theme-enter-mode) 70%, transparent)"
          : "var(--theme-enter-mode)",
        color: "#fff",
      }}
      aria-pressed={isEditing}
    >
      {isEditing ? (
        <LogOut className="w-3.5 h-3.5" />
      ) : (
        <Pencil className="w-3.5 h-3.5" />
      )}
      {isEditing ? exitLabel : editLabel}
    </button>
  );
}
