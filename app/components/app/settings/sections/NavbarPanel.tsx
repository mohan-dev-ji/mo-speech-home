"use client";

import { useTranslations } from "next-intl";
import { PanelLeft, PanelRight } from "lucide-react";
import { useNavbarVariant } from "@/app/contexts/NavbarVariantContext";
import { SettingsSection } from "@/app/components/app/settings/ui/SettingsSection";

/**
 * Navigational Side Bar tab — ports `NavbarModal`. Minimal-mode toggle + side
 * (left/right) chooser, persisted live via `useNavbarVariant()`.
 */
export function NavbarPanel() {
  const t = useTranslations("navbar");
  const { minimal, setMinimal, side, setSide } = useNavbarVariant();

  const SIDES = [
    { value: "left" as const, label: t("left"), icon: PanelLeft },
    { value: "right" as const, label: t("right"), icon: PanelRight },
  ];

  return (
    <div className="flex flex-col gap-theme-gap">
      <SettingsSection title={t("minimalLabel")}>
        <div className="flex items-center justify-between gap-theme-elements">
          <p className="text-theme-s text-theme-secondary-alt-text">{t("minimalHint")}</p>
          <button
            type="button"
            role="switch"
            aria-checked={minimal}
            aria-label={t("minimalLabel")}
            onClick={() => setMinimal(!minimal)}
            className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200"
            style={{ background: minimal ? "var(--theme-success)" : "rgba(0,0,0,0.25)" }}
          >
            <span
              className="absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: minimal ? "translateX(18px)" : "translateX(2px)" }}
            />
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={t("sideLabel")}>
        <p className="text-theme-s text-theme-secondary-alt-text">{t("sideHint")}</p>
        <div className="flex gap-theme-elements" role="radiogroup" aria-label={t("sideLabel")}>
          {SIDES.map(({ value, label, icon: Icon }) => {
            const active = side === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSide(value)}
                className={`flex flex-1 items-center justify-center gap-theme-elements rounded-theme-button border px-theme-btn-x py-theme-btn-y transition-colors ${
                  active
                    ? "border-theme-line bg-theme-surface font-semibold text-theme-alt-text elevation-subtle"
                    : "border-transparent text-theme-secondary-alt-text hover:text-theme-alt-text"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="text-theme-s">{label}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
}
