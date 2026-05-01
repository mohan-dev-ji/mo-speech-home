"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useProfile } from "@/app/contexts/ProfileContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

type TextSize = 'large' | 'medium' | 'small' | 'xs';

export function SymbolsModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("symbols");
  const { stateFlags, setSymbolLabelVisible, setSymbolTextSize } = useProfile();

  const [labelVisible, setLabelVisible] = useState(stateFlags.symbol_label_visible ?? true);
  const [textSize, setTextSize] = useState<TextSize>(stateFlags.symbol_text_size ?? 'small');

  const OPTIONS: { size: TextSize; label: string; hint: string }[] = [
    { size: 'large',  label: t('large'),  hint: t('largeHint')  },
    { size: 'medium', label: t('medium'), hint: t('mediumHint') },
    { size: 'small',  label: t('small'),  hint: t('smallHint')  },
  ];

  function handleConfirm() {
    setSymbolLabelVisible(labelVisible);
    setSymbolTextSize(textSize);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">

        {/* Display text toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={labelVisible}
            onChange={(e) => setLabelVisible(e.target.checked)}
            className="w-4 h-4 rounded accent-[color:var(--theme-brand-primary)] cursor-pointer"
          />
          <span className="text-theme-p text-theme-alt-text">{t('displayTextLabel')}</span>
        </label>

        {/* Text size buttons */}
        <div className={labelVisible ? '' : 'opacity-40 pointer-events-none'}>
          <p className="text-theme-s font-semibold text-theme-secondary-text mb-3">{t('textSizeLabel')}</p>
          <div className="flex gap-theme-elements">
            {OPTIONS.map(({ size, label, hint }) => {
              const active = textSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTextSize(size)}
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
