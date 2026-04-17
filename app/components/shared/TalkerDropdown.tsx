"use client";

// Quick-access dropdown attached below the TalkerBar chip area.
//
// Positioning rules (both states):
//   width  = anchorWidth × 0.8   (narrower than the chip area)
//   left   = anchorLeft  + anchorWidth × 0.1   (centred on x axis)
//   top    = anchorBottom  (flush with bottom of the main bar)
//
// Rounding: bottom corners only — square top edge makes it look
//   physically connected to the TalkerBar from below.
//
// Both states render via portal so the panel can overlay page content.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SymbolCard } from './SymbolCard';
import { LITTLE_WORDS_GROUPS } from '@/convex/data/defaultCategorySymbols';

// ─── Static data ──────────────────────────────────────────────────────────────

const NUMBERS = [
  '0', '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10', '20',
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// Group IDs from LITTLE_WORDS_GROUPS + two fixed tabs
type TabId = 'numbers' | 'letters' | string;

const GROUP_TABS = LITTLE_WORDS_GROUPS.map((g) => ({ id: g.id, name: g.name }));

// ─── Types ────────────────────────────────────────────────────────────────────

type TalkerDropdownProps = {
  anchorBottom: number;
  anchorLeft: number;
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
  const [activeTab, setActiveTab] = useState<TabId>(LITTLE_WORDS_GROUPS[0].id);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || anchorWidth === 0) return null;

  // ── Derived position ──────────────────────────────────────────────────────
  const dropWidth = anchorWidth * 0.8;
  const dropLeft  = anchorLeft  + anchorWidth * 0.1;

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    top:   anchorBottom,
    left:  dropLeft,
    width: dropWidth,
    zIndex: 50,
    borderRadius: `0 0 var(--theme-roundness) var(--theme-roundness)`,
    overflow: 'hidden',
  };

  function getItems(): string[] {
    if (activeTab === 'numbers') return NUMBERS;
    if (activeTab === 'letters') return LETTERS;
    const group = LITTLE_WORDS_GROUPS.find((g) => g.id === activeTab);
    return group ? group.words : [];
  }

  function getTabLabel(id: TabId): string {
    if (id === 'numbers') return t('tabNumbers');
    if (id === 'letters') return t('tabLetters');
    const group = LITTLE_WORDS_GROUPS.find((g) => g.id === id);
    if (!group) return id;
    return language === 'hin' ? group.name.hin : group.name.eng;
  }

  const allTabs: TabId[] = [
    ...GROUP_TABS.map((g) => g.id),
    'numbers',
    'letters',
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
      {/* Scrollable tab bar */}
      <div className="flex gap-2 px-4 py-3 shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {allTabs.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="shrink-0 px-3 py-1.5 rounded-lg text-small font-medium transition-colors"
            style={{
              background: activeTab === id
                ? 'rgba(255,255,255,0.25)'
                : 'rgba(255,255,255,0.1)',
              color: 'var(--theme-nav-text)',
            }}
          >
            {getTabLabel(id)}
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
              onTap={() => { onSymbolTap(label); setIsOpen(false); }}
            />
          ))}
        </div>
      </div>

      {/* Sticky close strip */}
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
