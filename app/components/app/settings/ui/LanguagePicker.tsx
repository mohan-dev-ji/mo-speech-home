"use client";

export type LanguageOption = {
  code: string;
  nativeLabel: string;
  status?: string;
};

/**
 * Row of full-width language buttons — mirrors the Figma "Language-picker"
 * (`1459:22718`). Each option is `flex-1`; selected = `button-highlight` + dark
 * text. Beta languages show a small "preview" pill (`previewLabel`).
 *
 * Presentational: the panel owns the language list + persistence.
 */
export function LanguagePicker({
  languages,
  value,
  onSelect,
  previewLabel,
}: {
  languages: LanguageOption[];
  value: string;
  onSelect: (code: string) => void;
  previewLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-theme-gap">
      {languages.map(({ code, nativeLabel, status }) => {
        const selected = value === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onSelect(code)}
            aria-pressed={selected}
            className={`flex flex-1 min-w-[8rem] items-center justify-center gap-1.5 rounded-theme-button border px-theme-btn-x py-theme-btn-y text-theme-p font-medium transition ${
              selected
                ? "border-transparent bg-theme-primary text-theme-button-primary"
                : "border-theme-line bg-theme-button-primary text-theme-button-secondary opacity-50 hover:opacity-100"
            }`}
          >
            <span>{nativeLabel}</span>
            {status === "beta" && (
              <span className="text-theme-xs uppercase tracking-wider">
                {previewLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
