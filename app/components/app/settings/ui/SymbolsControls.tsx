"use client";

export type TextSize = "large" | "medium" | "small" | "xs";

/**
 * Symbols controls — mirrors the Figma "Symbols" section (`1459:22837`):
 * a "Display text label" checkbox, then a "Text size" label + a Large/Medium/
 * Small picker showing a scaled "Aa". The text-size picker is greyed and
 * inert when the label is hidden (existing behaviour).
 */
export function SymbolsControls({
  labelVisible,
  onToggleLabel,
  displayTextLabel,
  textSize,
  onTextSizeChange,
  textSizeLabel,
  options,
}: {
  labelVisible: boolean;
  onToggleLabel: (visible: boolean) => void;
  displayTextLabel: string;
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
  textSizeLabel: string;
  /** `{ size, label }` per option — copy comes from the panel (i18n). */
  options: { size: Exclude<TextSize, "xs">; label: string }[];
}) {
  const previewSize: Record<Exclude<TextSize, "xs">, string> = {
    large: "text-theme-h3",
    medium: "text-theme-h4",
    small: "text-theme-large",
  };

  return (
    <div className="flex flex-col gap-theme-gap">
      <label className="flex cursor-pointer items-center gap-theme-elements">
        <input
          type="checkbox"
          checked={labelVisible}
          onChange={(e) => onToggleLabel(e.target.checked)}
          className="size-4 cursor-pointer rounded accent-[color:var(--theme-primary)]"
        />
        <span className="text-theme-p text-theme-alt-text">{displayTextLabel}</span>
      </label>

      <div className={labelVisible ? "" : "pointer-events-none opacity-40"}>
        <p className="mb-theme-elements text-theme-p text-theme-secondary-alt-text">{textSizeLabel}</p>
        <div className="flex gap-theme-gap">
          {options.map(({ size, label }) => {
            const selected = textSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onTextSizeChange(size)}
                aria-pressed={selected}
                className={`flex flex-1 flex-col gap-theme-elements rounded-theme-sm p-theme-general text-left transition ${
                  selected
                    ? "bg-theme-primary text-theme-button-primary"
                    : "bg-theme-button-primary text-theme-button-secondary opacity-50 hover:opacity-100"
                }`}
              >
                <span className="text-theme-p font-semibold">{label}</span>
                <span className={`${previewSize[size]} font-semibold leading-none`}>Aa</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
