"use client";

// Board header — switches between two modes:
//
//  TALKER  │ [TalkerBar — chip area]  │  [pill toggle]  │
//           │                         │  [▷ play       ]│
//           │                         │  [✕ clear      ]│
//           │                         │  [💾 save      ]│
//           └─────────────────────────┴─────────────────┘
//           TalkerDropdown anchored below chip area
//
//  BANNER  ┌─ relative card ─────────────────────────────┐
//           │ Category Name                [pill toggle] │
//           │ [Model] [Edit]                              │
//           └─────────────────────────────────────────────┘
//           No TalkerDropdown in banner mode.
//
//  showToggle=false → no pill toggle rendered (Search page — talker only).

import { useState, useEffect, useRef } from 'react';
import { Volume2, X, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TalkerBar } from './TalkerBar';
import type { TalkerSymbolItem, QuickSymbolItem } from './TalkerBar';
import { TalkerDropdown } from './TalkerDropdown';
import { Banner } from './Banner';
import { getCategoryColour } from '@/app/lib/categoryColours';

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
  // Omit showToggle (or false) for Search — talker only, no banner
  showToggle?: boolean;
  mode?: 'talker' | 'banner';
  onToggleMode?: () => void;
  categoryName?: string;
  categoryImagePath?: string;
  categoryColour?: string;
  onEditCategory?: () => void;
};

// ─── Pill toggle ─────────────────────────────────────────────────────────────

function PillToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center transition-opacity hover:opacity-80"
      aria-label={label}
    >
      <div
        className="relative w-10 h-6 rounded-full transition-colors duration-200"
        style={{ background: active ? 'var(--theme-success)' : 'rgba(255,255,255,0.2)' }}
      >
        <span
          className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
          style={{ transform: active ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
    </button>
  );
}

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
  showToggle = false,
  mode = 'talker',
  onToggleMode,
  categoryName = '',
  categoryImagePath,
  categoryColour,
  onEditCategory,
}: HeaderProps) {
  const t = useTranslations('talker');
  const tH = useTranslations('header');

  const mainRef     = useRef<HTMLDivElement>(null);
  const chipAreaRef = useRef<HTMLDivElement>(null);
  const [anchorPos, setAnchorPos] = useState({ bottom: 0, left: 0, width: 0 });

  const hasSymbols = symbols.length > 0;
  const isBanner   = mode === 'banner';
  const headerBg   = categoryColour
    ? getCategoryColour(categoryColour).c700
    : 'var(--theme-card)';

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

  // ─── Banner mode ─────────────────────────────────────────────────────────────

  if (isBanner) {
    return (
      <div
        className="relative rounded-theme p-3"
        style={{ background: headerBg }}
      >
        {showToggle && (
          <div className="absolute top-3 right-3">
            <PillToggle
              active={false}
              label={tH('switchToTalker')}
              onClick={onToggleMode}
            />
          </div>
        )}
        {/* Right padding keeps content clear of the toggle pill */}
        <div className={showToggle ? 'pr-14' : ''}>
          <Banner
            categoryName={categoryName}
            imagePath={categoryImagePath}
            colour={categoryColour}
            onEdit={onEditCategory}
          />
        </div>
      </div>
    );
  }

  // ─── Talker mode ─────────────────────────────────────────────────────────────

  return (
    <div>
      <div
        ref={mainRef}
        className="flex items-stretch gap-2 p-3 rounded-theme"
        style={{ background: headerBg }}
      >
        {/* Chip area */}
        <div ref={chipAreaRef} className="flex-1 min-w-0">
          <TalkerBar
            symbols={symbols}
            placeholder={placeholder}
            onChipTap={onChipTap}
          />
        </div>

        {/* Button column — toggle pill at top, then action buttons */}
        <div className="flex flex-col gap-1.5 shrink-0 w-10">

          {showToggle && (
            <PillToggle
              active={true}
              label={tH('switchToBanner')}
              onClick={onToggleMode}
            />
          )}

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

      {/* Dropdown — talker only */}
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
