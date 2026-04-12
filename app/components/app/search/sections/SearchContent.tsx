"use client";

import { useState, useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { useProfile } from '@/app/contexts/ProfileContext';
import { TalkerSection, type TalkerSymbolItem } from '@/app/components/shared/TalkerSection';
import { CategoryBoardGrid } from '@/app/components/shared/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/shared/SymbolCard';
import { PlayModal } from '@/app/components/shared/PlayModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayModalState = {
  symbolId: string;
  imagePath?: string;
  audioPath?: string;
  label: string;
} | null;

// ─── Audio ────────────────────────────────────────────────────────────────────

// Must be called synchronously within a user-gesture handler.
// The /api/assets route redirects to a signed R2 URL — the browser follows
// the redirect transparently, preserving the gesture chain for autoplay.
function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchContent() {
  const t = useTranslations('search');
  const { language, stateFlags } = useProfile();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [talkerSymbols, setTalkerSymbols] = useState<TalkerSymbolItem[]>([]);
  const [playModal, setPlayModal] = useState<PlayModalState>(null);
  const cancelSequenceRef = useRef(false);

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

  /** Tap a search result → play audio + add to talker */
  function addToTalker(symbolId: string, imagePath: string, label: string, audioPath: string) {
    // Play synchronously — must stay within the user gesture chain
    playAudio(audioPath);

    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId,
        imagePath: `/api/assets?key=${imagePath}`,
        audioPath,
        label,
      },
    ]);
  }

  /** Tap a quick-access symbol in the dropdown → add to talker (no audio in Phase 1) */
  function addQuickSymbol(label: string) {
    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId: `quick-${label}`,
        imagePath: undefined,
        label,
      },
    ]);
  }

  /** Tap a chip in the talker → replay audio + show play modal */
  function handleChipTap(item: TalkerSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    setPlayModal({
      symbolId: item.symbolId,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
      label: item.label,
    });
  }

  /** Play button → play all talker symbols sequentially */
  async function handlePlaySentence() {
    if (talkerSymbols.length === 0) return;
    cancelSequenceRef.current = false;

    for (const symbol of talkerSymbols) {
      if (cancelSequenceRef.current) break;

      // Show modal for the current symbol
      setPlayModal({
        symbolId: symbol.symbolId,
        imagePath: symbol.imagePath,
        audioPath: symbol.audioPath,
        label: symbol.label,
      });

      if (symbol.audioPath) {
        const path = symbol.audioPath;
        await new Promise<void>((resolve) => {
          const audio = new Audio(`/api/assets?key=${path}`);
          audio.addEventListener('ended', () => resolve());
          audio.addEventListener('error', () => resolve());
          audio.play().catch(() => resolve());
        });
      } else {
        // No audio — hold the modal briefly so the symbol is still visible
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
      }
    }

    if (!cancelSequenceRef.current) setPlayModal(null);
  }

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isLoading = !!debouncedQuery && results === undefined;
  const hasResults = Array.isArray(results) && results.length > 0;
  const noResults = Array.isArray(results) && results.length === 0 && !!debouncedQuery;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-general py-theme-general gap-theme-gap">

      {/* Talker header — search always uses talker mode */}
      {stateFlags.talker_visible && (
        <div className="shrink-0 mb-8">
          <TalkerSection
            symbols={talkerSymbols}
            placeholder={t('talkerHint')}
            language={language}
            onChipTap={handleChipTap}
            onPlaySentence={handlePlaySentence}
            onClear={() => setTalkerSymbols([])}
            onQuickSymbolTap={addQuickSymbol}
          />
        </div>
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
            className="w-full pl-9 pr-4 py-1.5 rounded-xl text-body outline-none"
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
          <div className="flex items-center justify-center">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('noResults', { query: debouncedQuery })}
            </p>
          </div>
        )}

        {/* Results grid */}
        {hasResults && (
          <CategoryBoardGrid>
            {results.map((symbol) => {
              const label =
                language === 'hin' && symbol.words.hin
                  ? symbol.words.hin
                  : symbol.words.eng;

              // Resolve audio path: prefer language-matched audio, fall back to eng
              const audioPath =
                language === 'hin' && symbol.audio.hin?.default
                  ? symbol.audio.hin.default
                  : symbol.audio.eng.default;

              return (
                <SymbolCard
                  key={symbol._id}
                  symbolId={symbol._id}
                  imagePath={`/api/assets?key=${symbol.imagePath}`}
                  label={label}
                  language={language}
                  onTap={() => addToTalker(symbol._id, symbol.imagePath, label, audioPath)}
                />
              );
            })}
          </CategoryBoardGrid>
        )}
      </div>

      {/* Play modal */}
      {playModal && (
        <PlayModal
          isOpen={true}
          symbolId={playModal.symbolId}
          imagePath={playModal.imagePath}
          label={playModal.label}
          language={language}
          onClose={() => { cancelSequenceRef.current = true; setPlayModal(null); }}
        />
      )}
    </div>
  );
}
