"use client";

// Composes the main TalkerBar area with the TalkerDropdown.
//
//  ┌────────────────────────────────[rounded-theme, banner bg]──────────────┐
//  │  [TalkerBar — white chip area]          │  [▷ play pill]               │
//  │                                          │  [✕ clear] [💾 save]         │
//  └──────────────────────────────────────────┴──────────────────────────────┘
//        ↕  TalkerDropdown centres itself here (80% chip width, fixed pos)

import { useState, useEffect, useRef } from 'react';
import { Volume2, X, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TalkerBar } from './TalkerBar';
import type { TalkerSymbolItem } from './TalkerBar';
import { TalkerDropdown } from './TalkerDropdown';

export type { TalkerSymbolItem } from './TalkerBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type TalkerSectionProps = {
  symbols: TalkerSymbolItem[];
  placeholder?: string;
  language: string;
  onChipTap: (item: TalkerSymbolItem) => void;
  onPlaySentence: () => void;
  onClear: () => void;
  onSave?: () => void;
  onQuickSymbolTap: (label: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TalkerSection({
  symbols,
  placeholder,
  language,
  onChipTap,
  onPlaySentence,
  onClear,
  onSave,
  onQuickSymbolTap,
}: TalkerSectionProps) {
  const t = useTranslations('talker');

  // mainRef    → bottom of main bar (TalkerDropdown.anchorBottom)
  // chipAreaRef → left + width of chip area (TalkerDropdown.anchorLeft/Width)
  const mainRef     = useRef<HTMLDivElement>(null);
  const chipAreaRef = useRef<HTMLDivElement>(null);

  const [anchorPos, setAnchorPos] = useState({ bottom: 0, left: 0, width: 0 });

  const hasSymbols = symbols.length > 0;

  // Measure on mount and whenever the window resizes
  useEffect(() => {
    function measure() {
      const main = mainRef.current?.getBoundingClientRect();
      const chip = chipAreaRef.current?.getBoundingClientRect();
      if (!main || !chip) return;
      setAnchorPos({ bottom: main.bottom, left: chip.left, width: chip.width });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <div>
      {/* ── Main bar ──────────────────────────────────────────────────────── */}
      <div
        ref={mainRef}
        className="flex items-stretch gap-2 p-3 rounded-theme"
        style={{ background: 'var(--theme-card)' }}
      >
        {/* White chip area */}
        <div ref={chipAreaRef} className="flex-1 min-w-0">
          <TalkerBar
            symbols={symbols}
            placeholder={placeholder}
            onChipTap={onChipTap}
          />
        </div>

        {/* ── 2-column action button grid ───────────────────────────────────
             Row 1: play (green pill, col-span-2)
             Row 2: clear (red) | save (brand blue)                         */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0 w-[80px] content-start">

          {/* Play — green pill, spans both columns */}
          <button
            type="button"
            onClick={onPlaySentence}
            disabled={!hasSymbols}
            className="col-span-2 flex items-center justify-center h-8 rounded-full transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--theme-success)', color: '#fff' }}
            aria-label={t('playLabel')}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Clear all — red */}
          <button
            type="button"
            onClick={onClear}
            disabled={!hasSymbols}
            className="flex items-center justify-center h-8 rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--theme-warning)', color: '#fff' }}
            aria-label={t('clearLabel')}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Save — brand blue (disabled until Phase 2 wires onSave) */}
          <button
            type="button"
            onClick={onSave}
            disabled={!hasSymbols || !onSave}
            className="flex items-center justify-center h-8 rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-text-on-brand)' }}
            aria-label={t('saveLabel')}
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Dropdown ─────────────────────────────────────────────────────────
           Renders via portal, centred on the chip area at 80% its width.
           Manages its own open/close and tab state.                         */}
      <TalkerDropdown
        anchorBottom={anchorPos.bottom}
        anchorLeft={anchorPos.left}
        anchorWidth={anchorPos.width}
        language={language}
        onSymbolTap={onQuickSymbolTap}
      />
    </div>
  );
}
