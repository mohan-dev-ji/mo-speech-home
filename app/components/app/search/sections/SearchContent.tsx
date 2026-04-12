"use client";

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { useProfile } from '@/app/contexts/ProfileContext';
import { CategoryHeader } from '@/app/components/shared/CategoryHeader';
import { TalkerBar, type TalkerSymbolItem } from '@/app/components/shared/TalkerBar';
import { CategoryBoardGrid } from '@/app/components/shared/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/shared/SymbolCard';
import { PlayModal } from '@/app/components/shared/PlayModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayModalState = {
  symbolId: string;
  imagePath?: string;
  label: string;
} | null;

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchContent() {
  const t = useTranslations('search');
  const { language, stateFlags } = useProfile();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [talkerSymbols, setTalkerSymbols] = useState<TalkerSymbolItem[]>([]);
  const [playModal, setPlayModal] = useState<PlayModalState>(null);

  // Debounce: fire immediately on clear, wait 300ms after each keystroke
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Skip the query entirely when there is nothing to search — never fetches on load
  const results = useQuery(
    api.symbols.searchSymbols,
    debouncedQuery ? { searchTerm: debouncedQuery, language } : 'skip'
  );

  // ─── Talker handlers ───────────────────────────────────────────────────────

  function addToTalker(symbolId: string, imagePath: string, label: string) {
    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId,
        // Serve via proxy — R2 assets are private (SymbolStix licence)
        imagePath: `/api/assets?key=${imagePath}`,
        label,
      },
    ]);
  }

  function removeFromTalker(instanceId: string) {
    setTalkerSymbols((prev) => prev.filter((s) => s.instanceId !== instanceId));
  }

  function handlePlaySentence() {
    if (talkerSymbols.length === 0) return;
    // Open PlayModal on the first symbol; full sequence audio is Phase 4
    const first = talkerSymbols[0];
    setPlayModal({
      symbolId: first.symbolId,
      imagePath: first.imagePath,
      label: first.label,
    });
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isLoading = !!debouncedQuery && results === undefined;
  const hasResults = Array.isArray(results) && results.length > 0;
  const noResults = Array.isArray(results) && results.length === 0 && !!debouncedQuery;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-general py-theme-general gap-theme-gap">

      {/* Talker header — search is always talker mode, never banner */}
      {stateFlags.talker_visible && (
        <CategoryHeader
          mode="talker"
          talkerBar={
            <TalkerBar
              symbols={talkerSymbols}
              placeholder={t('talkerHint')}
              onPlaySentence={handlePlaySentence}
              onRemove={removeFromTalker}
              onClear={() => setTalkerSymbols([])}
            />
          }
          showToggle={false}
          wrapperStyle={{ background: 'transparent' }}
        />
      )}

      {/* Search input */}
      <div className="shrink-0">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--theme-text)' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-body outline-none"
            style={{
              background: 'var(--theme-alt-card)',
              color: 'var(--theme-text)',
            }}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-auto">

        {/* Empty state — shown until the user starts typing */}
        {!query && (
          <div className="flex items-center justify-center h-full">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('emptyHint')}
            </p>
          </div>
        )}

        {/* Loading / debounce spinner */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: 'var(--theme-brand-primary)',
                borderTopColor: 'transparent',
              }}
            />
          </div>
        )}

        {/* No results */}
        {noResults && (
          <div className="flex items-center justify-center py-16">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('noResults', { query: debouncedQuery })}
            </p>
          </div>
        )}

        {/* Results grid */}
        {hasResults && (
          <CategoryBoardGrid columns={4}>
            {results.map((symbol) => {
              const label =
                language === 'hin' && symbol.words.hin
                  ? symbol.words.hin
                  : symbol.words.eng;

              return (
                <SymbolCard
                  key={symbol._id}
                  symbolId={symbol._id}
                  imagePath={`/api/assets?key=${symbol.imagePath}`}
                  label={label}
                  language={language}
                  onTap={() => addToTalker(symbol._id, symbol.imagePath, label)}
                />
              );
            })}
          </CategoryBoardGrid>
        )}
      </div>

      {/* Play modal — opened by talker play button */}
      {playModal && (
        <PlayModal
          isOpen={true}
          symbolId={playModal.symbolId}
          imagePath={playModal.imagePath}
          label={playModal.label}
          language={language}
          onClose={() => setPlayModal(null)}
        />
      )}
    </div>
  );
}
