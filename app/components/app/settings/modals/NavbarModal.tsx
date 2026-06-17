"use client";

import { useTranslations } from "next-intl";
import { PanelLeft, PanelRight } from "lucide-react";
import { useNavbarVariant } from "@/app/contexts/NavbarVariantContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

export function NavbarModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("navbar");
  const { minimal, setMinimal, side, setSide } = useNavbarVariant();

  const SIDES = [
    { value: "left" as const,  label: t("left"),  icon: PanelLeft },
    { value: "right" as const, label: t("right"), icon: PanelRight },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-theme-elements">
        <div className="flex items-center justify-between gap-theme-elements rounded-theme bg-theme-surface px-5 py-4">
          <div className="space-y-1">
            <p className="text-theme-p text-theme-alt-text">{t("minimalLabel")}</p>
            <p className="text-theme-s text-theme-secondary-text">{t("minimalHint")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={minimal}
            aria-label={t("minimalLabel")}
            onClick={() => setMinimal(!minimal)}
            className="relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200"
            style={{
              background: minimal ? "var(--theme-success)" : "rgba(0,0,0,0.25)",
            }}
          >
            <span
              className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
              style={{ transform: minimal ? "translateX(18px)" : "translateX(2px)" }}
            />
          </button>
        </div>

        <div className="rounded-theme bg-theme-surface px-5 py-4 space-y-3">
          <div className="space-y-1">
            <p className="text-theme-p text-theme-alt-text">{t("sideLabel")}</p>
            <p className="text-theme-s text-theme-secondary-text">{t("sideHint")}</p>
          </div>
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
                  className={`flex items-center justify-center gap-theme-elements flex-1 px-theme-btn-x py-theme-btn-y rounded-theme-button border transition-colors ${
                    active
                      ? "bg-theme-surface border-theme-line text-theme-alt-text font-semibold elevation-subtle"
                      : "border-transparent text-theme-secondary-alt-text hover:text-theme-alt-text"
                  }`}
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="text-theme-s">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
