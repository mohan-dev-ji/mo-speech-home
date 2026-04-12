"use client";

// Quick-access dropdown attached below the TalkerBar chip area.
//
// Positioning rules (both states):
//   width  = anchorWidth × 0.8   (narrower than the chip area)
//   left   = anchorLeft  + anchorWidth × 0.1   (centred on x axis)
//   top    = anchorBottom  (flush with bottom of the main bar)
//
// Rounding: bottom corners only (rounded-b-theme) — the square top edge
//   makes it look physically connected to the TalkerBar from below.
//
// Both states render via portal so the panel can overlay page content.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SymbolCard } from './SymbolCard';

// ─── Hardcoded quick-access data (Phase 1) ───────────────────────────────────

const CORE_WORDS = [
  'yes', 'no', 'want', 'go', 'more', 'help',
  'stop', 'eat', 'drink', 'like', 'I', 'you',
  'we', 'here', 'there', 'good', 'bad', 'big',
  'small', 'hot', 'cold', 'please', 'again', 'all done',
];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '20'];
const LETTERS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type DropdownTab = 'core' | 'numbers' | 'letters';

// ─── Types ────────────────────────────────────────────────────────────────────

type TalkerDropdownProps = {
  /** Bottom edge of the main TalkerBar (px from viewport top) */
  anchorBottom: number;
  /** Left edge of the white chip area */
  anchorLeft: number;
  /** Width of the white chip area */
  anchorWidth: number;
  language: string;
  onSymbolTap: (label: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TalkerDropdown({
  anchorBottom,
  anchorLeft,
  anchorWidth,
  language,
  onSymbolTap,
}: TalkerDropdownProps) {
  const t = useTranslations('talker');
  const [isOpen, setIsOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<DropdownTab>('core');
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Don't render until client is mounted and the anchor has been measured
  if (!mounted || anchorWidth === 0) return null;

  // ── Derived position ──────────────────────────────────────────────────────
  const dropWidth = anchorWidth * 0.8;
  const dropLeft  = anchorLeft  + anchorWidth * 0.1; // centred on chip area

  // Shared style for both closed tab and open panel
  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    top:   anchorBottom,
    left:  dropLeft,
    width: dropWidth,
    zIndex: 50,
    // Square top, rounded bottom only
    borderRadius: `0 0 var(--theme-roundness) var(--theme-roundness)`,
    overflow: 'hidden',
  };

  function getItems(): string[] {
    if (activeTab === 'numbers') return NUMBERS;
    if (activeTab === 'letters') return LETTERS;
    return CORE_WORDS;
  }

  const tabs: { key: DropdownTab; label: string }[] = [
    { key: 'core',    label: t('tabCoreWords') },
    { key: 'numbers', label: t('tabNumbers')   },
    { key: 'letters', label: t('tabLetters')   },
  ];

  // ── Closed: chevron tab ───────────────────────────────────────────────────
  if (!isOpen) {
    return createPortal(
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-full py-1.5 hover:opacity-70 transition-opacity"
        style={{ ...baseStyle, background: 'var(--theme-card)', color: 'var(--theme-nav-text)' }}
        aria-label={t('openDropdown')}
      >
        <ChevronDown className="w-5 h-5" />
      </button>,
      document.body
    );
  }

  // ── Open: full panel ──────────────────────────────────────────────────────
  return createPortal(
    <div
      className="flex flex-col"
      style={{ ...baseStyle, bottom: 0, background: 'var(--theme-banner)' }}
    >
      {/* Mode tabs */}
      <div className="flex justify-center gap-2 px-4 py-3 shrink-0">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className="px-4 py-1.5 rounded-lg text-small font-medium transition-colors"
            style={{
              background: activeTab === key
                ? 'rgba(255,255,255,0.25)'
                : 'rgba(255,255,255,0.1)',
              color: 'var(--theme-nav-text)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable symbol grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-6 gap-2">
          {getItems().map((label) => (
            <SymbolCard
              key={`${activeTab}-${label}`}
              symbolId={`quick-${label}`}
              label={label}
              language={language}
              onTap={() => onSymbolTap(label)}
            />
          ))}
        </div>
      </div>

      {/* Sticky close strip — card bg, always visible */}
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="shrink-0 flex items-center justify-center w-full py-2 hover:opacity-70 transition-opacity"
        style={{ background: 'var(--theme-card)', color: 'var(--theme-nav-text)' }}
        aria-label={t('closeDropdown')}
      >
        <ChevronDown className="w-5 h-5 rotate-180" />
      </button>
    </div>,
    document.body
  );
}
