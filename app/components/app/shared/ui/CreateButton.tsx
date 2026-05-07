"use client";

import { Plus } from "lucide-react";

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
 * Universal "Create new" button.
 *
 * Uses `--theme-create` (the dedicated create-affordance green token) as a
 * solid fill so create / add buttons stand out from neutral toolbar buttons
 * in any theme. Pairs naturally with the orange `EditButton` in the same
 * banner — green = make, orange = modify.
 *
 * Labels are consumer-supplied so the component stays translation-agnostic.
 *
 * Currently used on:
 *   - app/components/app/lists/sections/ListsModeContent.tsx
 *   - app/components/app/lists/modals/CreateListModal.tsx (inline button,
 *     same `--theme-create` token but custom layout — not yet migrated to
 *     this component)
 *
 * Future: replace remaining inline create / add buttons across the app
 * once the visual treatment has stabilised in production use.
 */
export function CreateButton({
  onClick,
  label,
  disabled = false,
  className,
}: CreateButtonProps) {
  const baseClass = [
    "flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm",
    "text-theme-s font-semibold transition-opacity hover:opacity-90",
    "disabled:opacity-40 disabled:cursor-not-allowed",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-[var(--theme-create)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
      style={{
        background: "var(--theme-create)",
        color: "#fff",
      }}
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
