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

  return (
    <div className="space-y-2">
      <p className="text-small font-semibold text-foreground">{t("sectionHeader")}</p>

      {/* Header on/off */}
      <button
        type="button"
        onClick={() => onToggleHeader(!headerOn)}
        className={`w-full py-2 rounded-md text-small font-medium border transition-colors ${
          headerOn
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:bg-muted"
        }`}
      >
        {headerOn ? t("headerOn") : t("headerOff")}
      </button>

      {/* Talker | Banner — disabled when header is off */}
      <div className={`flex gap-2 ${dualDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        <button
          type="button"
          onClick={() => onSetBannerMode(false)}
          disabled={dualDisabled}
          className={`flex-1 py-2 rounded-md text-small font-medium border transition-colors ${
            !inBannerMode
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          {t("headerTalkerMode")}
        </button>
        <button
          type="button"
          onClick={() => onSetBannerMode(true)}
          disabled={dualDisabled}
          className={`flex-1 py-2 rounded-md text-small font-medium border transition-colors ${
            inBannerMode
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          {t("headerBannerMode")}
        </button>
      </div>
    </div>
  );
}
