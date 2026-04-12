"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useProfile } from "@/app/contexts/ProfileContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";

type GridSize = 'large' | 'medium' | 'small';

export function GridModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("grid");
  const { stateFlags, setGridSize } = useProfile();

  const current = stateFlags.grid_size ?? 'large';
  const [selected, setSelected] = useState<GridSize>(current);

  const OPTIONS: { size: GridSize; label: string; hint: string }[] = [
    { size: 'large',  label: t('large'),  hint: t('largeHint')  },
    { size: 'medium', label: t('medium'), hint: t('mediumHint') },
    { size: 'small',  label: t('small'),  hint: t('smallHint')  },
  ];

  function handleConfirm() {
    setGridSize(selected);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <p className="text-theme-s font-semibold text-theme-secondary-text">{t('sizeLabel')}</p>
        <div className="flex gap-theme-elements">
          {OPTIONS.map(({ size, label, hint }) => {
            const active = selected === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => setSelected(size)}
                className={`flex flex-col items-center gap-1 flex-1 px-theme-btn-x py-theme-btn-y rounded-theme text-center transition-colors ${
                  active
                    ? "bg-theme-button-highlight text-theme-text"
                    : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                }`}
              >
                <span className="text-theme-p font-semibold">{label}</span>
                <span className="text-theme-s opacity-70">{hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleConfirm}>Confirm</Button>
      </DialogFooter>
    </>
  );
}
