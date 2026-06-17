"use client";

import { useTranslations } from "next-intl";
import { useNavbarVariant } from "@/app/contexts/NavbarVariantContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

export function NavbarModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("navbar");
  const { minimal, setMinimal } = useNavbarVariant();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

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

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
