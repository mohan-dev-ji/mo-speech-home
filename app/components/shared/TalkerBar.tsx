"use client";

// The sentence-building strip.
// Symbols queue here as the user taps cards; tapping the strip plays the full sentence.
// All props/callbacks only — no context dependency.

import { X, Volume2, Trash2 } from 'lucide-react';

export type TalkerSymbolItem = {
  instanceId: string;   // unique per tap (uuid), not the symbol ID
  symbolId: string;
  imagePath?: string;
  label: string;
};

type TalkerBarProps = {
  symbols: TalkerSymbolItem[];
  placeholder?: string;
  onPlaySentence: () => void;
  onRemove: (instanceId: string) => void;
  onClear: () => void;
};

export function TalkerBar({ symbols, placeholder = 'Tap symbols to build a sentence…', onPlaySentence, onRemove, onClear }: TalkerBarProps) {
  return (
    <div
      className="talker-bar flex items-center gap-2 min-h-[64px] px-3 py-2 overflow-x-auto"
    >
      {/* Symbol chips */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {symbols.length === 0 ? (
          <span
            className="text-caption opacity-50 select-none"
            style={{ color: 'var(--theme-talker-text)' }}
          >
            {placeholder}
          </span>
        ) : (
          symbols.map((item) => (
            <button
              key={item.instanceId}
              type="button"
              onClick={() => onRemove(item.instanceId)}
              className="flex flex-col items-center shrink-0 w-12 rounded-lg p-1 transition-transform active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'var(--theme-talker-text)',
              }}
            >
              {item.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imagePath}
                  alt={item.label}
                  className="w-8 h-8 object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-8 h-8 rounded bg-black/20" />
              )}
              <span className="text-[10px] leading-tight truncate w-full text-center mt-0.5">
                {item.label}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {symbols.length > 0 && (
          <>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-transform active:scale-95"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--theme-talker-text)' }}
              aria-label="Clear sentence"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onPlaySentence}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-transform active:scale-95"
              style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-text-on-brand)' }}
              aria-label="Play sentence"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
