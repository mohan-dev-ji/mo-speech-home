"use client";

/**
 * A single Settings tab — mirrors the Figma "Tab" component (`3028:4334`).
 *
 * Underline style (NOT the `NavTabButton` pill): the active tab gets a 3px
 * `--theme-primary` bottom border + SemiBold `alt-text`; inactive tabs are
 * Regular `secondary-alt-text` with no underline. Each tab is `flex-1` so the
 * row divides evenly. Border is always present (transparent when inactive) so
 * the active underline adds no height shift.
 */
export function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 min-w-0 flex items-center justify-center p-theme-btn-y text-theme-p truncate transition-colors border-b-[3px] ${
        active
          ? "border-theme-primary text-theme-alt-text font-semibold"
          : "border-transparent text-theme-secondary-alt-text font-normal hover:text-theme-alt-text"
      }`}
    >
      {label}
    </button>
  );
}
