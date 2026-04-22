"use client";

import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DisplayFormat } from '../types';

// ─── SymbolThumb ──────────────────────────────────────────────────────────────

export function SymbolThumb({ imagePath, size = 'md' }: { imagePath?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-14 h-14' : size === 'lg' ? 'w-24 h-24' : 'w-16 h-16';
  return (
    <div
      className={`${dim} rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0`}
      style={{ background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))' }}
    >
      {imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/assets?key=${imagePath}`} alt="" className="w-full h-full object-contain p-1" draggable={false} />
      ) : (
        <div className="w-10 h-10 rounded bg-black/10" />
      )}
    </div>
  );
}

// ─── CheckboxBtn ──────────────────────────────────────────────────────────────

export function CheckboxBtn({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-6 h-6 rounded shrink-0 flex items-center justify-center transition-colors"
      style={{
        background: checked ? '#fff' : 'transparent',
        border: `2px solid ${checked ? '#fff' : 'rgba(255,255,255,0.4)'}`,
      }}
    >
      {checked && <span style={{ color: 'var(--theme-success, #22c55e)', fontSize: 12, fontWeight: 700 }}>✓</span>}
    </button>
  );
}

// ─── EditSymbolSlot ───────────────────────────────────────────────────────────

export function EditSymbolSlot({
  imagePath,
  onAdd,
  onDelete,
  size = 'md',
}: {
  imagePath?: string;
  onAdd: () => void;
  onDelete: () => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-14 h-14' : 'w-20 h-20';
  return (
    <div
      className={`relative ${dim} rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0 cursor-pointer`}
      style={{
        background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))',
        outline: '2px dashed var(--theme-enter-mode)',
        outlineOffset: '2px',
      }}
      onClick={onAdd}
    >
      {imagePath ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/assets?key=${imagePath}`} alt="" className="w-full h-full object-contain p-1" draggable={false} />
          <div
            className="absolute bottom-0 inset-x-0 flex justify-center gap-2 py-0.5"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={onDelete} className="text-white/80 hover:text-white">
              <Trash2 className="w-3 h-3" />
            </button>
            <button type="button" onClick={onAdd} className="text-white/80 hover:text-white">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        </>
      ) : (
        <Plus className="w-6 h-6" style={{ color: 'var(--theme-text-secondary, rgba(255,255,255,0.4))' }} />
      )}
    </div>
  );
}

// ─── FormatDropdown ───────────────────────────────────────────────────────────

export function FormatDropdown({ value, onChange }: { value: DisplayFormat; onChange: (f: DisplayFormat) => void }) {
  const t = useTranslations('lists');
  const [open, setOpen] = useState(false);
  const options: { id: DisplayFormat; label: string }[] = [
    { id: 'rows',    label: t('formatRows') },
    { id: 'columns', label: t('formatColumns') },
    { id: 'grid',    label: t('formatGrid') },
  ];
  const current = options.find((o) => o.id === value)?.label ?? value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
        style={{
          background: 'var(--theme-card)',
          color: 'var(--theme-text-primary)',
          border: '1px solid rgba(255,255,255,0.15)',
          minWidth: '100px',
        }}
      >
        <span className="flex-1 text-left">{current}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{ background: 'var(--theme-card)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '120px' }}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-theme-s transition-colors hover:bg-white/5"
              style={{
                color: opt.id === value ? 'var(--theme-brand-primary, var(--theme-primary))' : 'var(--theme-text-primary)',
                fontWeight: opt.id === value ? 600 : 400,
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
