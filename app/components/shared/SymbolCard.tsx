"use client";

import { useState } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';
import { getCategoryColour } from '@/app/lib/categoryColours';

// componentKey: "symbol-{symbolId}" — required for modelling mode targeting.

export type SymbolDisplay = {
  bgColour?: string;
  textColour?: string;
  textSize?: 'sm' | 'md' | 'lg' | 'xl';
  borderColour?: string;
  borderWidth?: number;
  showLabel?: boolean;
  showImage?: boolean;
  shape?: 'square' | 'rounded' | 'circle';
};

type SymbolCardProps = {
  symbolId: string;
  imagePath?: string;
  label: string;
  language: string;
  showLabel?: boolean;
  showImage?: boolean;
  isModellingTarget?: boolean;
  display?: SymbolDisplay;
  categoryColour?: string;
  onTap: () => void;
};

// Font-weight classes only — font-size is set via cqw in inline style
const PROFILE_TEXT_WEIGHT: Record<'large' | 'medium' | 'small' | 'xs', string> = {
  large:  'font-semibold',
  medium: 'font-semibold',
  small:  'font-bold',
  xs:     'font-bold',
};

const DISPLAY_TEXT_WEIGHT: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'font-bold',
  md: 'font-bold',
  lg: 'font-semibold',
  xl: 'font-semibold',
};

// Font sizes as container-relative units — scale with the card's rendered width
const PROFILE_TEXT_CQW: Record<'large' | 'medium' | 'small' | 'xs', string> = {
  large:  '18cqw',
  medium: '15cqw',
  small:  '12cqw',
  xs:     '10cqw',
};

const DISPLAY_TEXT_CQW: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: '10cqw',
  md: '12cqw',
  lg: '15cqw',
  xl: '15cqw',
};

const SHAPE_CLASS: Record<'square' | 'rounded' | 'circle', string> = {
  square:  'rounded-none',
  rounded: 'rounded-xl',
  circle:  'rounded-full',
};

export function SymbolCard({
  imagePath,
  label,
  showLabel = true,
  showImage = true,
  isModellingTarget = false,
  display,
  categoryColour,
  onTap,
}: SymbolCardProps) {
  const [hovered, setHovered] = useState(false);
  const { stateFlags } = useProfile();

  const catPair = categoryColour ? getCategoryColour(categoryColour) : null;
  const defaultBg = catPair ? catPair.c100 : 'var(--theme-symbol-bg)';
  const defaultBorder = catPair ? catPair.c500 : 'var(--theme-line)';

  // Per-symbol overrides take priority over profile-level flags
  const labelVisible = display?.showLabel !== undefined
    ? display.showLabel
    : showLabel && (stateFlags.symbol_label_visible ?? true);

  const imageVisible = display?.showImage !== undefined ? display.showImage : showImage;

  const textWeightClass = display?.textSize
    ? DISPLAY_TEXT_WEIGHT[display.textSize]
    : PROFILE_TEXT_WEIGHT[stateFlags.symbol_text_size ?? 'small'];

  const textFontSize = display?.textSize
    ? DISPLAY_TEXT_CQW[display.textSize]
    : PROFILE_TEXT_CQW[stateFlags.symbol_text_size ?? 'small'];

  const shapeClass = SHAPE_CLASS[display?.shape ?? 'rounded'];

  const borderWidth = display?.borderWidth ?? 4;

  const borderColor = hovered
    ? 'var(--theme-brand-primary)'
    : (display?.borderColour ?? defaultBorder);

  return (
    <div className="w-full aspect-square" style={{ containerType: 'inline-size' }}>
    <button
      type="button"
      onClick={onTap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'symbol-card',
        'flex flex-col items-center justify-between',
        shapeClass,
        'p-2 w-full h-full cursor-pointer',
        'transition-transform active:scale-95',
        isModellingTarget ? 'symbol-card--modelling-target' : '',
      ].join(' ')}
      style={{
        backgroundColor: display?.bgColour ?? defaultBg,
        borderWidth: `${borderWidth * 0.75}cqw`,
        borderStyle: 'solid',
        borderColor,
        transition: 'border-color 150ms ease, transform 150ms ease',
      }}
    >
      {imageVisible && (
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
          className={`${textWeightClass} text-center leading-tight mt-1 truncate w-full px-0.5`}
          style={{ color: display?.textColour ?? 'var(--theme-text)', fontSize: textFontSize }}
        >
          {label}
        </span>
      )}
    </button>
    </div>
  );
}
