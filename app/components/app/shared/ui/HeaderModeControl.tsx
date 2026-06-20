"use client";

import { useTranslations } from "next-intl";

type Props = {
  headerOn: boolean;
  inBannerMode: boolean;
  onToggleHeader: (next: boolean) => void;
  onSetBannerMode: (next: boolean) => void;
};

export function HeaderModeControl({
  headerOn,
  inBannerMode,
  onToggleHeader,
  onSetBannerMode,
}: Props) {
  const t = useTranslations("studentProfile");
  const dualDisabled = !headerOn;

  // Shared on/off styling so every toggle here matches the settings pickers
  // (Figma button variant): on = `--theme-primary` bg + `button-primary` text;
  // off = `button-primary` bg + `button-secondary` text at 50% opacity, → 100% on hover.
  const segment = (active: boolean) =>
    active
      ? "bg-theme-primary text-theme-button-primary border-theme-primary"
      : "bg-theme-button-primary text-theme-button-secondary border-theme-line opacity-50 hover:opacity-100";

  return (
    <div className="flex flex-col gap-theme-elements">
      {/* Header on/off */}
      <button
        type="button"
        onClick={() => onToggleHeader(!headerOn)}
        className={`w-full rounded-theme-button border py-theme-btn-y text-theme-s font-medium transition ${segment(headerOn)}`}
      >
        {headerOn ? t("headerOn") : t("headerOff")}
      </button>

      {/* Talker | Banner — disabled when header is off */}
      <div className={`flex gap-theme-elements ${dualDisabled ? "pointer-events-none opacity-40" : ""}`}>
        <button
          type="button"
          onClick={() => onSetBannerMode(false)}
          disabled={dualDisabled}
          className={`flex-1 rounded-theme-button border py-theme-btn-y text-theme-s font-medium transition ${segment(!inBannerMode)}`}
        >
          {t("headerTalkerMode")}
        </button>
        <button
          type="button"
          onClick={() => onSetBannerMode(true)}
          disabled={dualDisabled}
          className={`flex-1 rounded-theme-button border py-theme-btn-y text-theme-s font-medium transition ${segment(inBannerMode)}`}
        >
          {t("headerBannerMode")}
        </button>
      </div>
    </div>
  );
}
