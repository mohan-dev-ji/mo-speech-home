"use client";

import { useState } from 'react';
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

  return (
    <div className="relative inline-flex shrink-0 align-middle" onClick={(e) => e.stopPropagation()}>
      <button
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
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 p-1.5 rounded-theme-card border border-theme-line bg-theme-surface elevation-modal z-50"
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
