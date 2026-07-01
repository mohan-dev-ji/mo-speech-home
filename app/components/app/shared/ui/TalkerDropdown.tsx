"use client";

// Quick-access dropdown — the bottom section of the Talker rectangle (ADR-015).
//
// Tab 1 "Core words": tiles for the core-word categories (+ Numbers, Letters).
//   Tapping a tile drills into its symbols. Core words are the structural layer
//   (zinc), pinned for motor planning.
// Tabs 2+ : phrase banks — reusable chunks; tapping inserts a phrase-unit.
//
// Closed: a chevron bar clipped into the rectangle's bottom edge. Open: a portal
// overlay that slides down from the chevron and overlays the page.

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, Hash, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { SymbolCard } from './SymbolCard';
import { NavTabButton } from './NavTabButton';
import { CategoryBoardGrid } from './CategoryBoardGrid';
import type { QuickSymbolItem } from './TalkerBar';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';
import { useProfile } from '@/app/contexts/ProfileContext';
import { getCategoryColour } from '@/app/lib/categoryColours';

const ZINC = getCategoryColour('zinc');

// ─── Static data ──────────────────────────────────────────────────────────────

// These match the exact words.en values in the symbols table.
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '20'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

// ─── Types ────────────────────────────────────────────────────────────────────

// 'core' = the Core-words tab; `bank-<folderId>` = a phrase bank.
type TabId = 'core' | string;

// Drill-in state inside the Core-words tab. null = the tile grid.
type CoreSel =
  | null
  | { kind: 'category'; id: Id<'profileCategories'>; name: string }
  | { kind: 'numbers' }
  | { kind: 'letters' };

type TalkerDropdownProps = {
  language: string;
  onSymbolTap: (item: QuickSymbolItem) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TalkerDropdown({ language, onSymbolTap }: TalkerDropdownProps) {
  const t = useTranslations('talker');
  const { voiceId } = useProfile();
  const [isOpen, setIsOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('core');
  const [coreSel, setCoreSel]     = useState<CoreSel>(null);
  const [panelPos, setPanelPos]   = useState({ top: 0, left: 0, width: 0 });
  // Entry animation: the panel slides down from the chevron so it reads as a
  // surface layer settling on top of the navigated category. `entered` flips on
  // the frame after open so the CSS transition runs; `motion-reduce:` snaps it
  // open under OS reduced-motion.
  const [entered, setEntered]     = useState(false);
  // `mounted` keeps the panel in the DOM through the slide-out so close animates
  // too; `entered` drives the transform (in = translateY(0), out = -100%).
  const [mounted, setMounted]     = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const barRef                    = useRef<HTMLButtonElement>(null);
  const panelRef                  = useRef<HTMLDivElement>(null);

  // One-tap backfill of the Phase-14 defaults (core-word categories + phrase
  // banks) into the caller's account — for accounts created before these
  // defaults shipped (seedDefaultAccount only fires at creation). Idempotent;
  // the core/bank queries refresh reactively once it resolves.
  const installDefaults = useMutation(api.profilePhrases.installDefaultBanksAndCore);
  async function handleLoadDefaults() {
    setLoadingDefaults(true);
    try {
      await installDefaults({});
    } finally {
      setLoadingDefaults(false);
    }
  }

  function openPanel() {
    const r = barRef.current?.getBoundingClientRect();
    // Anchor at the bar's BOTTOM: the chevron bar stays put (part of the talker)
    // and the contents slide down from behind it to cover the grid area below.
    if (r) setPanelPos({ top: r.bottom, left: r.left, width: r.width });
    setIsOpen(true);
  }

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    // Closing: slide out, then unmount after the transition.
    setEntered(false);
    const id = setTimeout(() => setMounted(false), 380);
    return () => clearTimeout(id);
  }, [isOpen]);

  // ── Queries — all 'skip' unless the dropdown is open on the matching view.
  //    Convex caches per args so re-visiting a view costs nothing.
  const coreCategories = useQuery(
    api.profileCategories.getCoreWordCategories,
    isOpen ? {} : 'skip'
  );
  const coreSymbols = useQuery(
    api.profileCategories.getProfileSymbolsWithImages,
    isOpen && coreSel?.kind === 'category'
      ? { profileCategoryId: coreSel.id, voiceId }
      : 'skip'
  );
  const numberSymbols = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && coreSel?.kind === 'numbers' ? { words: NUMBERS } : 'skip'
  );
  const letterSymbols = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && coreSel?.kind === 'letters' ? { words: LETTERS } : 'skip'
  );
  // Phrase banks (ADR-015) — the reusable-chunk tabs. One query returns each
  // phrases-tree folder with its phrases nested.
  const phraseBanks = useQuery(
    api.profilePhrases.getPhraseBanks,
    isOpen ? {} : 'skip'
  );
  const banks = phraseBanks ?? [];
  const coreCats = coreCategories ?? [];

  // O(1) word → symbol lookup — built from a getSymbolsByWords result.
  function buildMap(symbols: typeof numberSymbols) {
    return new Map((symbols ?? []).map((s) => [s.words.en ?? '', s]));
  }

  function getTabLabel(id: TabId): string {
    if (id === 'core') return t('tabCoreWords');
    const bank = banks.find((b) => `bank-${b.folderId}` === id);
    return bank ? displayString(bank.name, language, DEFAULT_LOCALE) : id;
  }

  const allTabs: TabId[] = ['core', ...banks.map((b) => `bank-${b.folderId}`)];

  function selectTab(id: TabId) {
    setActiveTab(id);
    if (id !== 'core') setCoreSel(null);
  }

  function handleTap(item: QuickSymbolItem) {
    onSymbolTap(item);
  }

  // ── Renderers ───────────────────────────────────────────────────────────────

  function spinner() {
    return (
      <div className="col-span-full flex items-center justify-center py-8">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--theme-nav-text)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // Numbers / Letters drill-in — symbols resolved by word (getSymbolsByWords).
  function renderWordList(words: string[], symbols: typeof numberSymbols) {
    if (symbols === undefined) return spinner();
    const map = buildMap(symbols);
    return words.map((word) => {
      const sym       = map.get(word);
      const label     = sym ? displayString(sym.words, language, DEFAULT_LOCALE) : word;
      const imagePath = sym ? `/api/assets?key=${sym.imagePath}` : undefined;
      const audioMap  = (sym?.audio as Record<string, boolean> | undefined) ?? {};
      const seeded    = audioMap[voiceId] === true;
      const audioPath = sym
        ? resolveSymbolAudioPath(voiceId, sym.words.en ?? word, seeded, sym.audioBasename) ?? undefined
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

  // Core-category drill-in — the installed profileSymbols of a core category.
  function renderCoreSymbols(symbols: typeof coreSymbols) {
    if (symbols === undefined) return spinner();
    return symbols.map((row) => {
      const label     = displayString(row.label, language, DEFAULT_LOCALE);
      const imagePath = row.imagePath ? `/api/assets?key=${row.imagePath}` : undefined;
      const audioPath = row.audio[language] ?? row.audio[DEFAULT_LOCALE] ?? row.audio.en;
      return (
        <SymbolCard
          key={row._id}
          symbolId={row._id}
          imagePath={imagePath}
          label={label}
          language={language}
          onTap={() => handleTap({ symbolId: row._id, label, imagePath, audioPath })}
        />
      );
    });
  }

  // Core tile grid — category tiles + the fixed Numbers / Letters tiles.
  function renderCoreTiles() {
    return (
      <div className="flex flex-wrap gap-3 py-2">
        {coreCats.map((c) => (
          <CoreTile
            key={c._id}
            label={displayString(c.name, language, DEFAULT_LOCALE)}
            onClick={() =>
              setCoreSel({ kind: 'category', id: c._id, name: displayString(c.name, language, DEFAULT_LOCALE) })
            }
          />
        ))}
        <CoreTile label={t('tabNumbers')} icon={<Hash className="w-6 h-6" />} onClick={() => setCoreSel({ kind: 'numbers' })} />
        <CoreTile label={t('tabLetters')} icon={<Type className="w-6 h-6" />} onClick={() => setCoreSel({ kind: 'letters' })} />
        {coreCats.length === 0 && coreCategories !== undefined && (
          <div className="flex flex-col items-start gap-2 self-center">
            <span className="text-caption opacity-60" style={{ color: 'var(--theme-nav-text)' }}>
              {t('emptyCore')}
            </span>
            <button
              type="button"
              onClick={handleLoadDefaults}
              disabled={loadingDefaults}
              className="rounded-theme-sm px-4 py-2 text-body font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--theme-brand-primary)', color: '#fff' }}
            >
              {loadingDefaults ? t('loadingDefaults') : t('loadDefaults')}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderCoreContent() {
    if (coreSel === null) return renderCoreTiles();

    const backLabel =
      coreSel.kind === 'category' ? coreSel.name
        : coreSel.kind === 'numbers' ? t('tabNumbers')
        : t('tabLetters');

    let grid: ReactNode;
    if (coreSel.kind === 'category') grid = renderCoreSymbols(coreSymbols);
    else if (coreSel.kind === 'numbers') grid = renderWordList(NUMBERS, numberSymbols);
    else grid = renderWordList(LETTERS, letterSymbols);

    return (
      <>
        <button
          type="button"
          onClick={() => setCoreSel(null)}
          className="flex items-center gap-1 mb-2 text-caption font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--theme-nav-text)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          {t('tabCoreWords')} · {backLabel}
        </button>
        <CategoryBoardGrid>{grid}</CategoryBoardGrid>
      </>
    );
  }

  // Phrase-bank tab: zinc phrase cards. Tapping inserts a phrase-unit (its
  // decomposition + clip) into the talker bar (ADR-015).
  function renderPhraseBank() {
    const bank = banks.find((b) => `bank-${b.folderId}` === activeTab);
    if (!bank) return null;
    if (bank.phrases.length === 0) {
      return (
        <span className="text-caption opacity-60 self-center" style={{ color: 'var(--theme-nav-text)' }}>
          {t('emptyBank')}
        </span>
      );
    }
    return bank.phrases.map((p) => {
      const name = displayString(p.name, language, DEFAULT_LOCALE);
      const audioPath = p.recordedAudioPath ?? p.audioPath ?? undefined;
      // RAW imagePath keys (the bar/card build the /api/assets URL themselves).
      const words = p.words.map((w) => ({
        imagePath: w.imagePath,
        audioPath: w.audioPath,
        label: displayString(w.label ?? {}, language, DEFAULT_LOCALE),
      }));
      return (
        <PhraseDropdownCard
          key={p._id}
          name={name}
          words={words}
          onTap={() =>
            handleTap({ symbolId: `phrase-${p._id}`, label: name, kind: 'phrase', phraseName: name, audioPath, words })
          }
        />
      );
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <button
        ref={barRef}
        type="button"
        onClick={isOpen ? () => setIsOpen(false) : openPanel}
        className="flex items-center justify-center w-full h-[50px] border-t border-theme-line hover:opacity-70 transition-opacity"
        style={{ background: 'var(--theme-primary-25)', color: 'var(--theme-nav-text)' }}
        aria-label={isOpen ? t('closeDropdown') : t('openDropdown')}
      >
        {/* Bar stays put; only the chevron rotates on open/close. */}
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {mounted &&
        createPortal(
          <>
            {/* Dim the grid area below the talker; click closes. Starts at the
                bar's bottom so the talker + chevron stay interactive above it. */}
            <div
              onClick={() => setIsOpen(false)}
              style={{ position: 'fixed', top: panelPos.top, left: 0, right: 0, bottom: 0, zIndex: 49, background: 'rgba(0,0,0,0.35)' }}
            />

            {/* Clip window over the grid area. The inner panel starts fully
                translated up (hidden behind the talker) and slides DOWN to cover
                the grid — slower than the chevron, reading as content pulled out
                from behind the talker. */}
            <div
              style={{
                position: 'fixed',
                top: panelPos.top,
                left: panelPos.left,
                width: panelPos.width,
                bottom: 0,
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              <div
                ref={panelRef}
                className="flex flex-col h-full glass-surface transition-transform duration-[380ms] ease-out motion-reduce:transition-none"
                style={{
                  background: 'var(--theme-background)',
                  borderRadius: '0 0 var(--theme-card-roundness) var(--theme-card-roundness)',
                  transform: entered ? 'translateY(0)' : 'translateY(-100%)',
                }}
              >
                {/* Tab bar — Core words + phrase banks. */}
                <div className="flex gap-2 px-4 py-3 shrink-0 overflow-x-auto bg-theme-background" style={{ scrollbarWidth: 'none' }}>
                  {allTabs.map((id) => (
                    <NavTabButton key={id} active={activeTab === id} onClick={() => selectTab(id)}>
                      {getTabLabel(id)}
                    </NavTabButton>
                  ))}
                </div>

                {/* Content. */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {activeTab === 'core' ? (
                    renderCoreContent()
                  ) : (
                    <div className="flex flex-wrap gap-3 py-2">{renderPhraseBank()}</div>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

// ─── Core tile (zinc) ───────────────────────────────────────────────────────────

function CoreTile({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center justify-center gap-2 w-32 h-28 rounded-theme p-3 transition-opacity hover:opacity-90 shrink-0"
      style={{ background: ZINC.c500, color: '#fff' }}
    >
      {icon}
      <span className="text-body font-medium text-center">{label}</span>
    </button>
  );
}

// ─── Phrase card (zinc box) for a phrase-bank tab ───────────────────────────────

function PhraseDropdownCard({
  name,
  words,
  onTap,
}: {
  name: string;
  words: { imagePath?: string; label: string }[];
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={name}
      className="flex flex-col items-center gap-2 rounded-theme p-3 transition-opacity hover:opacity-90 shrink-0"
      style={{ background: ZINC.c500 }}
    >
      <div className="flex items-end gap-2">
        {words.length === 0 ? (
          <div className="w-20 h-20 rounded-theme-sm" style={{ background: ZINC.c100 }} />
        ) : (
          words.map((w, i) => (
            <div
              key={i}
              className="w-20 h-20 rounded-theme-sm overflow-hidden flex items-center justify-center"
              style={{ background: ZINC.c100 }}
            >
              {w.imagePath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/assets?key=${w.imagePath}`}
                  alt={w.label}
                  className="w-full h-full object-contain p-1.5"
                  draggable={false}
                />
              ) : (
                <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>
                  {w.label}
                </span>
              )}
            </div>
          ))
        )}
      </div>
      <span
        className="text-caption font-medium rounded-full px-3 py-0.5"
        style={{ background: ZINC.c700, color: '#fff' }}
      >
        {name}
      </span>
    </button>
  );
}
