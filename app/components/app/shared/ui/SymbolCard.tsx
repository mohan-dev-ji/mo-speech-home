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
  display,
  categoryColour,
  onTap,
}: SymbolCardProps) {
  const [hovered, setHovered] = useState(false);
  const { stateFlags } = useProfile();

  const catPair = categoryColour ? getCategoryColour(categoryColour) : null;
  const defaultBg = catPair ? catPair.c100 : 'var(--theme-symbol-bg)';
  const defaultBorder = catPair ? catPair.c500 : 'var(--theme-line)';

  // Per-symbol overrides take priority over profile-level flags, but the
  // symbol editor seeds these from its defaults on every save (see
  // SymbolEditorModal.tsx: showLabel:true, showImage:true, textSize:'sm').
  // Treat those default values as "follow profile" so the profile-level
  // toggles in Settings still affect edited symbols.
  const showLabelOverride = display?.showLabel === false ? false : undefined;
  const labelVisible = showLabelOverride !== undefined
    ? showLabelOverride
    : showLabel && (stateFlags.symbol_label_visible ?? true);

  const imageVisible = display?.showImage === false ? false : showImage;

  // Only treat textSize as an override when it differs from the editor default ('sm')
  const textSizeOverride = display?.textSize && display.textSize !== 'sm' ? display.textSize : undefined;

  const textWeightClass = textSizeOverride
    ? DISPLAY_TEXT_WEIGHT[textSizeOverride]
    : PROFILE_TEXT_WEIGHT[stateFlags.symbol_text_size ?? 'small'];

  const textFontSize = textSizeOverride
    ? DISPLAY_TEXT_CQW[textSizeOverride]
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
