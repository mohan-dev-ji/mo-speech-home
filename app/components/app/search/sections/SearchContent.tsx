"use client";

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';

// Phase 8.0 placeholder voice — see TalkerDropdown / SymbolEditor for rationale.
const DEFAULT_VOICE_ID = 'en-GB-News-M';
import { CategoryBoardGrid } from '@/app/components/app/shared/ui/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/app/shared/ui/SymbolCard';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchContent() {
  const t = useTranslations('search');
  const { language, stateFlags } = useProfile();
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
                  DEFAULT_VOICE_ID,
                  symbol.words.en ?? '',
                  audioMap[DEFAULT_VOICE_ID] === true,
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
