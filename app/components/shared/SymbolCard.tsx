"use client";

import { useState } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';

// componentKey: "symbol-{symbolId}" — required for modelling mode targeting.
// All props/callbacks only — no context dependency.

type SymbolCardProps = {
  symbolId: string;
  imagePath?: string;
  label: string;
  language: string;
  showLabel?: boolean;
  showImage?: boolean;
  isModellingTarget?: boolean;
  onTap: () => void;
};

const TEXT_SIZE_CLASS: Record<'large' | 'medium' | 'small', string> = {
  large:  'text-theme-h2 font-semibold',
  medium: 'text-theme-h4 font-semibold',
  small:  'text-theme-p font-bold',
};

export function SymbolCard({
  imagePath,
  label,
  showLabel = true,
  showImage = true,
  isModellingTarget = false,
  onTap,
}: SymbolCardProps) {
  const [hovered, setHovered] = useState(false);
  const { stateFlags } = useProfile();

  const labelVisible = showLabel && (stateFlags.symbol_label_visible ?? true);
  const textSizeClass = TEXT_SIZE_CLASS[stateFlags.symbol_text_size ?? 'small'];

  return (
    <button
      type="button"
      onClick={onTap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'symbol-card',
        'flex flex-col items-center justify-between',
        'rounded-xl p-2 w-full aspect-square cursor-pointer',
        'transition-transform active:scale-95',
        isModellingTarget ? 'symbol-card--modelling-target' : '',
      ].join(' ')}
      style={{
        borderWidth: '4px',
        borderStyle: 'solid',
        borderColor: hovered
          ? 'var(--theme-brand-primary)'
          : 'var(--theme-line)',
        transition: 'border-color 150ms ease, transform 150ms ease',
      }}
    >
      {showImage && (
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePath}
              alt={label}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-3/4 aspect-square rounded-lg bg-black/10" />
          )}
        </div>
      )}
      {labelVisible && (
        <span
          className={`${textSizeClass} text-center leading-tight mt-1 truncate w-full px-0.5`}
          style={{ color: 'var(--theme-text)' }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
