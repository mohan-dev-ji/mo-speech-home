"use client";

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';
import { CategoryBoardGrid } from '@/app/components/app/shared/ui/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/app/shared/ui/SymbolCard';
import { SearchBar } from '@/app/components/app/shared/ui/SearchBar';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchContent() {
  const t = useTranslations('search');
  const { language, stateFlags, voiceId } = useProfile();
  const { talkerMode, addToTalker } = useTalker();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery(
    api.symbols.searchSymbols,
    debouncedQuery ? { searchTerm: debouncedQuery, language } : 'skip'
  );

  // ─── Derived state ─────────────────────────────────────────────────────────

  const isLoading = !!debouncedQuery && results === undefined;
  const hasResults = Array.isArray(results) && results.length > 0;
  const noResults = Array.isArray(results) && results.length === 0 && !!debouncedQuery;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      {/* Page banner — banner/edit mode only */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')} />
        </div>
      )}

      {/* Search input */}
      <div className="shrink-0">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('placeholder')}
          autoFocus
        />
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-auto">

        {!query && (
          <div className="flex items-center justify-center h-full">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('emptyHint')}
            </p>
          </div>
        )}

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

        {noResults && (
          <div className="flex items-center justify-center">
            <p className="text-body" style={{ color: 'var(--theme-text-secondary)' }}>
              {t('noResults', { query: debouncedQuery })}
            </p>
          </div>
        )}

        {hasResults && (
          <CategoryBoardGrid>
            {results.map((symbol) => {
              const label = displayString(symbol.words, language, DEFAULT_LOCALE);

              // Per ADR-009 §4 audio paths are convention-resolved from the
              // voice-keyed boolean map; resolver uses the per-symbol
              // `audioBasename` (MVP filename) when present, else the
              // English-word convention.
              const audioMap = (symbol.audio as Record<string, boolean> | undefined) ?? {};
              const audioPath =
                resolveSymbolAudioPath(
                  voiceId,
                  symbol.words.en ?? '',
                  audioMap[voiceId] === true,
                  symbol.audioBasename,
                ) ?? '';

              return (
                <SymbolCard
                  key={symbol._id}
                  symbolId={symbol._id}
                  imagePath={`/api/assets?key=${symbol.imagePath}`}
                  label={label}
                  language={language}
                  onTap={() => {
                    if (talkerMode === 'banner') {
                      playAudio(audioPath);
                    } else {
                      playAudio(audioPath);
                      addToTalker({
                        symbolId: symbol._id,
                        imagePath: `/api/assets?key=${symbol.imagePath}`,
                        audioPath,
                        label,
                      });
                    }
                  }}
                />
              );
            })}
          </CategoryBoardGrid>
        )}
      </div>
    </div>
  );
}
