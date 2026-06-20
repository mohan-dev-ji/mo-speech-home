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
  /** Voice-search handler. Omitted for now — STT isn't wired, the chip is the
      Figma affordance. */
  onMic?: () => void;
  autoFocus?: boolean;
};

export function SearchBar({ value, onChange, placeholder, onMic, autoFocus }: SearchBarProps) {
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
        aria-label={t('voiceSearch')}
        className="shrink-0 flex items-center justify-center p-2 rounded-theme-chip bg-theme-button-secondary text-theme-button-primary cursor-pointer"
      >
        <Mic className="w-6 h-6" />
      </button>
    </div>
  );
}
