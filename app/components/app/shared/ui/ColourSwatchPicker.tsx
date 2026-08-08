"use client";

import { useState, useRef, useLayoutEffect } from 'react';
import { CATEGORY_COLOURS, getCategoryColour } from '@/app/lib/categoryColours';

type Props = {
  /** Current colour key (e.g. 'orange'). */
  value: string;
  /** Called with the chosen colour key. */
  onChange: (key: string) => void;
  ariaLabel?: string;
};

/**
 * Compact colour-swatch picker (ADR-014) — a single swatch button showing the
 * current Tailwind-500 colour; tapping opens a grid of all selectable colours.
 * The picked key drives the folder/category colour variants (tile tint, image
 * box, etc.). Generalised from the category-detail `ColourPicker` so the shared
 * GroupTile (categories + list/sentence groups) can use one picker.
 */
export function ColourSwatchPicker({ value, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const current = getCategoryColour(value);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Flip the popover away from whichever viewport edge it would overflow, so it
  // never gets clipped near the right/bottom of the screen.
  const [placement, setPlacement] = useState<{
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'right';
  }>({ vertical: 'bottom', horizontal: 'left' });

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const pop = popoverRef.current;
    if (!trigger || !pop) return;
    const t = trigger.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    const margin = 8;
    const overflowsBottom = t.bottom + p.height + margin > window.innerHeight;
    const fitsAbove = t.top - p.height - margin > 0;
    const overflowsRight = t.left + p.width + margin > window.innerWidth;
    const fitsLeftAligned = t.right - p.width >= 0; // right-0 anchors the popover's right edge to the trigger's
    setPlacement({
      vertical: overflowsBottom && fitsAbove ? 'top' : 'bottom',
      horizontal: overflowsRight && fitsLeftAligned ? 'right' : 'left',
    });
  }, [open]);

  return (
    <div className="relative inline-flex shrink-0 align-middle" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? 'Choose colour'}
        onClick={() => setOpen((o) => !o)}
        className="block size-8 shrink-0 rounded-theme-button elevation-subtle transition-transform hover:scale-105"
        style={{ backgroundColor: current.c500, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}
      />

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={popoverRef}
            className={[
              'absolute p-1.5 rounded-theme-card border border-theme-line bg-theme-surface elevation-modal z-50',
              placement.vertical === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
              placement.horizontal === 'left' ? 'left-0' : 'right-0',
            ].join(' ')}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1.25rem)', gap: '0.25rem' }}
          >
            {Object.entries(CATEGORY_COLOURS).map(([name, pair]) => {
              const selected = current.c500 === pair.c500;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onChange(name); setOpen(false); }}
                  className="w-5 h-5 rounded-theme-sm"
                  style={{
                    backgroundColor: pair.c500,
                    boxShadow: selected ? 'inset 0 0 0 2px white' : undefined,
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
