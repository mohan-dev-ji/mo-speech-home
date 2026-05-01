"use client";

// Pure talker display — chip area, action buttons, and TalkerDropdown.
// Category props and mode toggle removed (see ADR-004).

import { useState, useEffect, useRef } from 'react';
import { Volume2, X, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TalkerBar } from './TalkerBar';
import type { TalkerSymbolItem, QuickSymbolItem } from './TalkerBar';
import { TalkerDropdown } from './TalkerDropdown';

export type { TalkerSymbolItem, QuickSymbolItem } from './TalkerBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type HeaderProps = {
  symbols: TalkerSymbolItem[];
  language: string;
  placeholder?: string;
  onChipTap: (item: TalkerSymbolItem) => void;
  onPlaySentence: () => void;
  onClear: () => void;
  onSave?: () => void;
  onQuickSymbolTap: (item: QuickSymbolItem) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Header({
  symbols,
  language,
  placeholder,
  onChipTap,
  onPlaySentence,
  onClear,
  onSave,
  onQuickSymbolTap,
}: HeaderProps) {
  const t = useTranslations('talker');

  const mainRef     = useRef<HTMLDivElement>(null);
  const chipAreaRef = useRef<HTMLDivElement>(null);
  const [anchorPos, setAnchorPos] = useState({ bottom: 0, left: 0, width: 0 });

  const hasSymbols = symbols.length > 0;

  useEffect(() => {
    function measure() {
      const main = mainRef.current?.getBoundingClientRect();
      const chip = chipAreaRef.current?.getBoundingClientRect();
      if (!main || !chip) return;
      setAnchorPos({ bottom: main.bottom, left: chip.left, width: chip.width });
    }
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (mainRef.current) ro.observe(mainRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  return (
    <div>
      <div
        ref={mainRef}
        className="flex items-stretch gap-2 p-3 rounded-theme min-h-[200px]"
        style={{ background: 'var(--theme-banner)' }}
      >
        {/* Chip area */}
        <div ref={chipAreaRef} className="flex-1 min-w-0">
          <TalkerBar
            symbols={symbols}
            placeholder={placeholder}
            onChipTap={onChipTap}
          />
        </div>

        {/* Action button column */}
        <div className="flex flex-col gap-1.5 shrink-0 w-10">
          <button
            type="button"
            onClick={onPlaySentence}
            disabled={!hasSymbols}
            className="flex-1 flex items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--theme-success)', color: '#fff' }}
            aria-label={t('playLabel')}
          >
            <Volume2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={!hasSymbols}
            className="flex-1 flex items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--theme-warning)', color: '#fff' }}
            aria-label={t('clearLabel')}
          >
            <X className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={!hasSymbols || !onSave}
            className="flex-1 flex items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-text-on-brand)' }}
            aria-label={t('saveLabel')}
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      </div>

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
