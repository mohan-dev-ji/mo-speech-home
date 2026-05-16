"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';

export type PackFilterOption = {
  /** URL-safe identifier — `'all'` | `'default'` | `'unpublished'` | `'mine'` | `<resourcePack._id>` */
  value: string;
  label: string;
};

type Props = {
  /** Current selection; defaults to `'all'` when no `?pack=` query param is present. */
  value: string;
  options: PackFilterOption[];
  onChange: (value: string) => void;
  /** Accessible button label, e.g. "Filter by pack". Consumer provides localised copy. */
  ariaLabel: string;
};

/**
 * Lightweight dropdown for the pack filter on listing pages. Visual
 * language follows `FormatDropdown` on the list detail page — same
 * button + chevron + popdown menu shape — so the toolbar reads as one
 * coherent control set alongside `EditButton` / `CreateButton`.
 *
 * View-mode-aware option list is computed by the parent (admin vs.
 * instructor vs. student-view each see different options). When there
 * are no meaningful options (e.g. an instructor with no loaded-from
 * packs), the parent shouldn't render this component at all.
 *
 * Closes on outside-click and on Escape so it never traps focus.
 */
export function PackFilterDropdown({ value, options, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
        style={{
          background: 'var(--theme-card)',
          color: 'var(--theme-text-primary)',
          border: '1px solid rgba(255,255,255,0.15)',
          minWidth: '140px',
        }}
      >
        <Filter className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{current}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-full left-0 mt-1 rounded-xl shadow-xl z-50 overflow-hidden max-h-[60vh] overflow-y-auto"
          style={{ background: 'var(--theme-card)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '180px' }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-theme-s transition-colors hover:bg-white/5"
              style={{
                color: opt.value === value
                  ? 'var(--theme-brand-primary, var(--theme-primary))'
                  : 'var(--theme-text-primary)',
                fontWeight: opt.value === value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
