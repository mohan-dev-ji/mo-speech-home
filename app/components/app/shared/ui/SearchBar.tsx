"use client";

import { Search, Mic, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Figma "search" (`3017:2212`): a pill (chip roundness) with a `surface` fill and
// a `line` hairline border. Left = search glyph + input; right = a mic chip
// (`button-secondary` circle, light `button-primary` glyph) and a clear X (shown
// only when there's a query). Tokens: surface / line / alt-text /
// secondary-alt-text / button-primary / button-secondary.

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Voice-search handler (toggles listening). */
  onMic?: () => void;
  /** When true the mic chip turns red + pulses (recording in progress). */
  isListening?: boolean;
  autoFocus?: boolean;
};

export function SearchBar({ value, onChange, placeholder, onMic, isListening, autoFocus }: SearchBarProps) {
  const t = useTranslations('search');

  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-theme-chip bg-theme-surface border border-theme-line">
      <Search className="w-6 h-6 shrink-0 text-theme-secondary-alt-text" />

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 min-w-0 bg-transparent outline-none text-theme-p text-theme-alt-text placeholder:text-theme-secondary-alt-text [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('clearSearch')}
          className="shrink-0 text-theme-secondary-alt-text hover:text-theme-alt-text transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      <button
        type="button"
        onClick={onMic}
        aria-label={isListening ? t('voiceStop') : t('voiceSearch')}
        aria-pressed={isListening}
        className={`shrink-0 flex items-center justify-center p-2 rounded-theme-chip cursor-pointer ${
          isListening
            ? 'bg-theme-warning text-white animate-pulse'
            : 'bg-theme-button-secondary text-theme-button-primary'
        }`}
      >
        <Mic className="w-6 h-6" />
      </button>
    </div>
  );
}
