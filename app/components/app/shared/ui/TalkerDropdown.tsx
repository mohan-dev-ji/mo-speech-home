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

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SymbolCard } from './SymbolCard';
import { NavTabButton } from './NavTabButton';
import { LITTLE_WORDS_GROUPS } from '@/convex/data/defaultCategorySymbols';
import type { QuickSymbolItem } from './TalkerBar';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';
import { useProfile } from '@/app/contexts/ProfileContext';

// ─── Static data ──────────────────────────────────────────────────────────────

// These match the exact words.en values in the symbols table.
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '20'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'numbers' | 'letters' | string;

const GROUP_TABS = LITTLE_WORDS_GROUPS.map((g) => ({ id: g.id, name: g.name }));

// ─── Types ────────────────────────────────────────────────────────────────────

type TalkerDropdownProps = {
  anchorBottom: number;
  anchorLeft: number;
  anchorWidth: number;
  language: string;
  onSymbolTap: (item: QuickSymbolItem) => void;
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
  const { voiceId } = useProfile();
  const [isOpen, setIsOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(LITTLE_WORDS_GROUPS[0].id);
  const [mounted, setMounted]     = useState(false);
  const panelRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeGroup = LITTLE_WORDS_GROUPS.find((g) => g.id === activeTab);

  // All three queries use 'skip' unless the dropdown is open on the matching tab.
  // Convex caches per args so switching back to a viewed tab costs nothing.
  const groupSymbols  = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && activeGroup                  ? { words: activeGroup.words } : 'skip'
  );
  const numberSymbols = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && activeTab === 'numbers'      ? { words: NUMBERS }           : 'skip'
  );
  const letterSymbols = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && activeTab === 'letters'      ? { words: LETTERS }           : 'skip'
  );

  // O(1) word → symbol lookup — built from whichever query is active
  function buildMap(symbols: typeof groupSymbols) {
    return new Map((symbols ?? []).map((s) => [s.words.en ?? '', s]));
  }

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

  function getTabLabel(id: TabId): string {
    if (id === 'numbers') return t('tabNumbers');
    if (id === 'letters') return t('tabLetters');
    const group = LITTLE_WORDS_GROUPS.find((g) => g.id === id);
    if (!group) return id;
    return displayString(group.name, language, DEFAULT_LOCALE);
  }

  const allTabs: TabId[] = [
    ...GROUP_TABS.map((g) => g.id),
    'numbers',
    'letters',
  ];

  function handleTap(item: QuickSymbolItem) {
    onSymbolTap(item);
  }

  // ── Closed: chevron tab ───────────────────────────────────────────────────
  if (!isOpen) {
    return createPortal(
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-full py-1.5 hover:opacity-70 transition-opacity glass-surface"
        style={{ ...baseStyle, color: 'var(--theme-nav-text)' }}
        aria-label={t('openDropdown')}
      >
        <ChevronDown className="w-5 h-5" />
      </button>,
      document.body
    );
  }

  // ── Symbol grid content ───────────────────────────────────────────────────

  function renderWordList(words: string[], symbols: typeof groupSymbols) {
    if (symbols === undefined) {
      return (
        <div className="col-span-6 flex items-center justify-center py-8">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--theme-nav-text)', borderTopColor: 'transparent' }}
          />
        </div>
      );
    }
    const map = buildMap(symbols);
    return words.map((word) => {
      const sym       = map.get(word);
      const label     = sym
        ? displayString(sym.words, language, DEFAULT_LOCALE)
        : word;
      const imagePath = sym ? `/api/assets?key=${sym.imagePath}` : undefined;
      // Per ADR-009 §4 the audio path is convention-resolved. The boolean map
      // records "is this voice seeded"; resolveSymbolAudioPath turns that into
      // an R2 key (with the legacy `audio/eng/default/<basename>.mp3`
      // fallback for the en-GB-News-M voice until Phase 8.4 re-seeds it).
      const audioMap = (sym?.audio as Record<string, boolean> | undefined) ?? {};
      const seeded   = audioMap[voiceId] === true;
      const audioPath = sym
        ? resolveSymbolAudioPath(
            voiceId,
            sym.words.en ?? word,
            seeded,
            sym.audioBasename,
          ) ?? undefined
        : undefined;
      return (
        <SymbolCard
          key={word}
          symbolId={sym?._id ?? `quick-${word}`}
          imagePath={imagePath}
          label={label}
          language={language}
          onTap={() => handleTap({ symbolId: sym?._id ?? `quick-${word}`, label, imagePath, audioPath })}
        />
      );
    });
  }

  function renderItems() {
    if (activeTab === 'numbers') return renderWordList(NUMBERS, numberSymbols);
    if (activeTab === 'letters') return renderWordList(LETTERS, letterSymbols);
    return renderWordList(activeGroup!.words, groupSymbols);
  }

  // ── Open: full panel ──────────────────────────────────────────────────────
  return createPortal(
    <>
      {/* Overlay — blocks board taps; clicking it triggers click-outside close */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          background: 'rgba(0,0,0,0.45)',
        }}
      />

      <div
        ref={panelRef}
        className="flex flex-col glass-surface"
        style={{ ...baseStyle, bottom: 0 }}
      >
      {/* Chevron close — stays at same position as the closed-state tab */}
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="shrink-0 flex items-center justify-center w-full py-1.5 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--theme-nav-text)' }}
        aria-label={t('closeDropdown')}
      >
        <ChevronDown className="w-5 h-5 rotate-180" />
      </button>

      {/* Scrollable tab bar. Sits on `background` (the Talker "stage") so the
          active NavTabButton's surface pill reads against it inside the surface popover. */}
      <div className="flex gap-2 px-4 py-3 shrink-0 overflow-x-auto bg-theme-background" style={{ scrollbarWidth: 'none' }}>
        {allTabs.map((id) => (
          <NavTabButton key={id} active={activeTab === id} onClick={() => setActiveTab(id)}>
            {getTabLabel(id)}
          </NavTabButton>
        ))}
      </div>

      {/* Scrollable symbol grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-6 gap-2">
          {renderItems()}
        </div>
      </div>
    </div>
    </>,
    document.body
  );
}
