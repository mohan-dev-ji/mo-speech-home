"use client";

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';
import { getCategoryColour } from '@/app/lib/categoryColours';

// Avoid the SSR useLayoutEffect warning while still fitting before paint on the client.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Smallest we let the label shrink to (fraction of its base font size) before we
// accept clipping — keeps very long single words legible rather than microscopic.
const MIN_FIT_SCALE = 0.55;

// Shrink the label font to fit the card width on one line instead of truncating.
// Measures the span's overflow against its box and writes a `--fit` multiplier the
// inline font-size calc() reads. Re-runs on label/size change and on card resize.
function useFitLabel(deps: unknown[]) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty('--fit', '1');
      const avail = el.clientWidth;
      const needed = el.scrollWidth;
      if (needed > avail && avail > 0) {
        el.style.setProperty('--fit', String(Math.max(MIN_FIT_SCALE, avail / needed)));
      }
    };
    fit();
    // Observe the (font-independent) card container so refitting on resize can't loop.
    const target = containerRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(target);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { spanRef, containerRef };
}

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

  // Refit when the label or its base size changes (profile text-size changes the base
  // but not the container, so a resize alone wouldn't catch it).
  const { spanRef, containerRef } = useFitLabel([label, textFontSize]);

  const shapeClass = SHAPE_CLASS[display?.shape ?? 'rounded'];

  const borderWidth = display?.borderWidth ?? 4;

  const borderColor = hovered
    ? 'var(--theme-brand-primary)'
    : (display?.borderColour ?? defaultBorder);

  return (
    <div ref={containerRef} className="w-full aspect-square" style={{ containerType: 'inline-size' }}>
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
          ref={spanRef}
          className={`${textWeightClass} text-center leading-tight mt-1 w-full px-0.5 whitespace-nowrap overflow-hidden`}
          style={{
            color: display?.textColour ?? 'var(--theme-text)',
            fontSize: `calc(${textFontSize} * var(--fit, 1))`,
          }}
        >
          {label}
        </span>
      )}
    </button>
    </div>
  );
}
