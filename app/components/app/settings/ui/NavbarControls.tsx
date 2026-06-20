"use client";

import { useTranslations } from "next-intl";
import { PanelLeft, PanelRight } from "lucide-react";

/**
 * Navigation sidebar controls — minimal-rail toggle + Left/Right side picker.
 *
 * Presentational: the panel owns the values + persistence (instructor writes
 * `users.stateFlags`, student writes that profile's `studentProfiles.stateFlags`).
 * Copy comes from the shared `navbar` namespace. Side buttons follow the
 * settings on/off system: on = `primary` fill + light text; off =
 * `button-primary` at 50% opacity, rising to 100% on hover.
 */
export function NavbarControls({
  minimal,
  onRight,
  onToggleMinimal,
  onSetRight,
}: {
  minimal: boolean;
  onRight: boolean;
  onToggleMinimal: (next: boolean) => void;
  onSetRight: (next: boolean) => void;
}) {
  const t = useTranslations("navbar");

  const sides = [
    { right: false, label: t("left"), icon: PanelLeft },
    { right: true, label: t("right"), icon: PanelRight },
  ];

  return (
    <div className="flex flex-col gap-theme-gap">
      {/* Minimal rail toggle */}
      <div className="flex items-center justify-between gap-theme-gap">
        <div>
          <p className="text-theme-p text-theme-alt-text">{t("minimalLabel")}</p>
          <p className="text-theme-s text-theme-secondary-alt-text">{t("minimalHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={minimal}
          aria-label={t("minimalLabel")}
          onClick={() => onToggleMinimal(!minimal)}
          className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200"
          style={{ background: minimal ? "var(--theme-success)" : "rgba(0,0,0,0.25)" }}
        >
          <span
            className="absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: minimal ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      {/* Side / handedness picker */}
      <div className="flex flex-col gap-theme-elements">
        <div>
          <p className="text-theme-p text-theme-alt-text">{t("sideLabel")}</p>
          <p className="text-theme-s text-theme-secondary-alt-text">{t("sideHint")}</p>
        </div>
        <div className="flex gap-theme-elements" role="radiogroup" aria-label={t("sideLabel")}>
          {sides.map(({ right, label, icon: Icon }) => {
            const active = onRight === right;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSetRight(right)}
                className={`flex flex-1 items-center justify-center gap-theme-elements rounded-theme-button border px-theme-btn-x py-theme-btn-y text-theme-s font-medium transition ${
                  active
                    ? "border-transparent bg-theme-primary text-theme-button-primary"
                    : "border-theme-line bg-theme-button-primary text-theme-button-secondary opacity-50 hover:opacity-100"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
