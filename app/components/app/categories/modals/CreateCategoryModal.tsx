"use client";

import { useEffect, useRef, useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/app/shared/ui/Dialog';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, rows: Array<{ label: string; autoMatch: boolean }>) => Promise<void>;
};

const INITIAL_SYMBOLS = ['', '', '', ''];

export function CreateCategoryModal({ isOpen, onClose, onCreate }: Props) {
  const t = useTranslations('categories');
  const [name, setName] = useState('');
  const [symbols, setSymbols] = useState<string[]>(INITIAL_SYMBOLS);
  const [autoMatch, setAutoMatch] = useState<boolean[]>(() => INITIAL_SYMBOLS.map(() => false));
  const allChecked = autoMatch.length > 0 && autoMatch.every(Boolean);
  const someChecked = autoMatch.some(Boolean);
  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);
  const [isCreating, setIsCreating] = useState(false);

  // Paste/auto-match tip — click-to-toggle (works on touch, unlike hover).
  // Dismisses on outside-click or Escape.
  const [tipOpen, setTipOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tipOpen) return;
    const onDown = (e: MouseEvent) => {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) setTipOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTipOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [tipOpen]);

  // Per-slot input refs so we can focus the newly-added field after addSymbol.
  const symbolInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const prevSymbolsLengthRef = useRef(symbols.length);

  // When the symbols array grows (i.e. the user clicked "Add more"), focus
  // the new last input. Shrinks (reset on close, submit) are ignored.
  useEffect(() => {
    if (symbols.length > prevSymbolsLengthRef.current) {
      symbolInputRefs.current[symbols.length - 1]?.focus();
    }
    prevSymbolsLengthRef.current = symbols.length;
  }, [symbols.length]);

  function updateSymbol(index: number, value: string) {
    setSymbols((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addSymbol() {
    setSymbols((prev) => [...prev, '']);
    setAutoMatch((prev) => [...prev, allChecked]); // inherit the header state
  }

  // Bulk paste: pasting a multi-item list (newline-, comma-, or tab-separated)
  // into a symbol field distributes the items across fields starting at that
  // field, overwriting from `index` onward and appending new fields as the list
  // runs on. A single-item paste falls through to the browser's default so
  // normal one-word pasting into a field is unaffected.
  function handleSymbolPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const items = text
      .split(/[\r\n,\t]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (items.length <= 1) return; // let the browser handle a plain single paste
    e.preventDefault();
    setSymbols((prev) => {
      const next = prev.slice(0, index); // keep everything before the paste point
      next.push(...items);               // fill from here, growing as long as the list
      return next;
    });
    setAutoMatch((prev) => {
      const next = prev.slice(0, index);
      while (next.length < index) next.push(false);
      for (let k = 0; k < items.length; k++) next.push(allChecked); // pasted rows inherit header state
      return next;
    });
  }

  function reset() {
    setName('');
    setSymbols(INITIAL_SYMBOLS);
    setAutoMatch(INITIAL_SYMBOLS.map(() => false));
    setTipOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, symbols.map((label, i) => ({ label, autoMatch: autoMatch[i] ?? false })));
      reset();
      onClose();
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset();
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createModalTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Category name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
              {t('createModalNameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createModalNamePlaceholder')}
              autoFocus
              className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
              style={{
                background: 'var(--theme-symbol-bg)',
                color: 'var(--theme-text)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          </div>

          {/* Symbol labels — placeholder slots created with the category */}
          <div className="flex flex-col gap-2">
            {/* Header: "Symbols" + info tooltip on the left; the paste/auto-match
                hint now lives in the (i) icon's hover text. The "Auto-match"
                select-all sits at the right, its checkbox column-aligned with the
                per-row checkboxes below (matching pr-1 + w-5). */}
            <div className="flex items-center gap-2 pr-1">
              <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
                {t('createModalSymbolsLabel')}
              </label>
              <div className="relative" ref={tipRef}>
                <button
                  type="button"
                  onClick={() => setTipOpen((o) => !o)}
                  aria-label={t('createModalBulkHint')}
                  aria-expanded={tipOpen}
                  className="inline-flex items-center justify-center cursor-pointer"
                  style={{ color: 'var(--theme-secondary-text)' }}
                >
                  <Info className="w-4 h-4" />
                </button>
                {tipOpen && (
                  <div
                    role="tooltip"
                    className="absolute left-0 top-full mt-2 z-20 w-64 rounded-theme p-3 shadow-lg text-theme-xs"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-secondary-text)',
                      border: '1px solid var(--theme-line)',
                    }}
                  >
                    <p className="font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>
                      {t('createModalTipTitle')}
                    </p>
                    <p className="whitespace-pre-line leading-snug">{t('createModalTipBody')}</p>
                  </div>
                )}
              </div>
              <div className="flex-1" />
              <label className="flex items-center gap-2 text-theme-xs cursor-pointer" style={{ color: 'var(--theme-secondary-text)' }}>
                {t('createModalAutoMatch')}
                <input
                  ref={headerRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => setAutoMatch(symbols.map(() => e.target.checked))}
                  aria-label={t('createModalAutoMatchAll')}
                  className="w-6 h-6 shrink-0 accent-[var(--theme-brand-primary)] cursor-pointer"
                />
              </label>
            </div>

            {/* Cap the visible input list at ~5 rows; anything beyond
                scrolls inside this container so the footer Create button
                stays anchored at the bottom of the dialog. `pr-1` gives
                the scrollbar a little breathing room next to the inputs.
                Browsers auto-scroll the focused input into view when
                "Add more" inserts and focuses a new field below the fold. */}
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
              {symbols.map((symbol, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-theme-sm shrink-0 flex items-center justify-center text-theme-s font-bold"
                    style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
                  >
                    {i + 1}
                  </div>
                  <input
                    ref={(el) => { symbolInputRefs.current[i] = el; }}
                    type="text"
                    value={symbol}
                    onChange={(e) => updateSymbol(i, e.target.value)}
                    onPaste={(e) => handleSymbolPaste(i, e)}
                    placeholder={t('createModalSymbolPlaceholder')}
                    className="flex-1 px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  <input
                    type="checkbox"
                    checked={autoMatch[i] ?? false}
                    onChange={(e) =>
                      setAutoMatch((prev) => prev.map((v, k) => (k === i ? e.target.checked : v)))
                    }
                    aria-label={t('createModalAutoMatchRow', { word: symbols[i]?.trim() || String(i + 1) })}
                    className="w-6 h-6 shrink-0 accent-[var(--theme-brand-primary)] cursor-pointer"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSymbol}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80 mt-1"
              style={{
                background: 'var(--theme-primary)',
                color: 'var(--theme-alt-text)',
                border: 'none',
              }}
            >
              <Plus className="w-4 h-4" />
              {t('createModalAddSymbols')}
            </button>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="py-3 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
            >
              {t('createModalCancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="py-3 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {isCreating ? (someChecked ? t('createModalAutoMatching') : t('creating')) : t('createModalCreate')}
            </button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
