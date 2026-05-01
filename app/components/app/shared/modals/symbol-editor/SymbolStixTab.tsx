"use client";

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Draft } from './types';

type Props = {
  language: string;
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
};

export function SymbolStixTab({ language, draft, patch }: Props) {
  const t = useTranslations('symbolEditor');

  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(rawSearch), 300);
    return () => clearTimeout(id);
  }, [rawSearch]);

  const results = useQuery(
    api.symbols.searchSymbols,
    debouncedSearch.trim() ? { searchTerm: debouncedSearch, language, limit: 30 } : 'skip'
  );

  function handleSelect(sym: NonNullable<typeof results>[number]) {
    patch({
      symbolstixId: sym._id,
      symbolstixImagePath: sym.imagePath,
      symbolstixAudioEng: sym.audio.eng.default,
      symbolstixAudioHin: sym.audio.hin?.default,
      defaultAudioPath: sym.audio.eng.default,
      // Adopt 'default' as the active source only if nothing is active yet —
      // swapping the symbol mid-edit must not clobber a generated/recorded clip.
      ...(draft.activeAudioSource ? {} : { activeAudioSource: 'default' as const }),
      // Pre-populate label only if blank
      labelEng: draft.labelEng || sym.words.eng,
      labelHin: draft.labelHin || (sym.words.hin ?? ''),
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 shrink-0">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: 'var(--theme-symbol-bg)', border: '1px solid var(--theme-button-highlight)' }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-secondary-text)' }} />
          <input
            type="text"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 bg-transparent text-theme-s outline-none"
            style={{ color: 'var(--theme-text)' }}
          />
          {rawSearch && (
            <button
              type="button"
              onClick={() => { setRawSearch(''); setDebouncedSearch(''); }}
              style={{ color: 'var(--theme-secondary-text)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {!debouncedSearch.trim() && (
          <div className="flex items-center justify-center h-32">
            <p className="text-theme-s text-center" style={{ color: 'var(--theme-secondary-text)' }}>
              {t('searchEmpty')}
            </p>
          </div>
        )}

        {debouncedSearch.trim() && results?.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-theme-s text-center" style={{ color: 'var(--theme-secondary-text)' }}>
              {t('searchNoResults', { query: debouncedSearch })}
            </p>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {results.map((sym) => {
              const symLabel = language === 'hin' && sym.words.hin ? sym.words.hin : sym.words.eng;
              const isSelected = draft.symbolstixId === sym._id;
              return (
                <button
                  key={sym._id}
                  type="button"
                  onClick={() => handleSelect(sym)}
                  className="flex flex-col items-center gap-1 rounded-theme-sm p-2"
                  style={{
                    background: isSelected
                      ? 'color-mix(in srgb, var(--theme-brand-primary) 12%, transparent)'
                      : 'var(--theme-symbol-bg)',
                    border: `2px solid ${isSelected ? 'var(--theme-brand-primary)' : 'transparent'}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/assets?key=${sym.imagePath}`}
                    alt={symLabel}
                    className="w-full aspect-square object-contain rounded"
                  />
                  <span
                    className="text-theme-xs text-center leading-tight line-clamp-1 w-full"
                    style={{ color: isSelected ? 'var(--theme-brand-primary)' : 'var(--theme-text)' }}
                  >
                    {symLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
