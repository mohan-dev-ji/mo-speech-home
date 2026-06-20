"use client";

export type GridSize = "large" | "medium" | "small";

type GridOption = {
  size: GridSize;
  label: string;
  /** Decorative squares-preview density (Figma `Grid-size-picker` `1459:22785`). */
  squares: number;
  barClass: string;
};

/**
 * Three grid-density cards (Large / Medium / Small) — mirrors the Figma
 * "Grid-size-picker" (`1459:22785`). Each card shows a label + a decorative row
 * of squares illustrating density (display-only; it does not change the symbol
 * count). Selected = `--theme-primary` fill + light text.
 */
export function GridSizePicker({
  value,
  onChange,
  options,
}: {
  value: GridSize;
  onChange: (size: GridSize) => void;
  /** `{ size, label }` per option — copy comes from the panel (i18n). */
  options: { size: GridSize; label: string }[];
}) {
  const density: Record<GridSize, Omit<GridOption, "size" | "label">> = {
    large: { squares: 4, barClass: "h-9" },
    medium: { squares: 8, barClass: "h-3.5" },
    small: { squares: 12, barClass: "h-1.5" },
  };

  return (
    <div className="flex gap-theme-gap">
      {options.map(({ size, label }) => {
        const selected = value === size;
        const { squares, barClass } = density[size];
        return (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            aria-pressed={selected}
            className={`flex flex-1 flex-col gap-theme-elements rounded-theme-sm p-theme-general text-left transition ${
              selected
                ? "bg-theme-primary text-theme-button-primary"
                : "bg-theme-button-primary text-theme-button-secondary opacity-50 hover:opacity-100"
            }`}
          >
            <span className="text-theme-p font-semibold">{label}</span>
            <div className="flex items-end gap-1">
              {Array.from({ length: squares }).map((_, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-sm bg-current opacity-80 ${barClass}`}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
