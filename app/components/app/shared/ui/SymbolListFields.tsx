"use client";

import { useEffect, useRef, useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type SymbolRow = { label: string; autoMatch: boolean };

const INITIAL_SYMBOLS = ['', '', '', ''];

type Props = {
  /** Fires with the current rows whenever a field or checkbox changes. */
  onRowsChange: (rows: SymbolRow[]) => void;
  /** Section heading above the rows (defaults to the category "Symbols" copy). */
  sectionLabel?: string;
  /** Per-row input placeholder (defaults to the category "Type a word…" copy). */
  placeholder?: string;
  /** "Add more" button label (defaults to the category "Add more symbols" copy). */
  addLabel?: string;
};

/**
 * The symbols + auto-match block shared by the "New category" modal and the
 * core-words "Add a list" modal: a scrollable list of label inputs each with an
 * auto-match checkbox, a select-all header (indeterminate-aware), a bulk-paste
 * splitter (newline / comma / tab), an (i) paste tip, and "Add more". Owns its
 * own state and reports the rows up via `onRowsChange`; to reset it, the host
 * changes its `key` so it remounts fresh. Copy lives under the `categories`
 * namespace (generic enough for both hosts).
 */
export function SymbolListFields({ onRowsChange, sectionLabel, placeholder, addLabel }: Props) {
  const t = useTranslations('categories');
  const [symbols, setSymbols] = useState<string[]>(INITIAL_SYMBOLS);
  const [autoMatch, setAutoMatch] = useState<boolean[]>(() => INITIAL_SYMBOLS.map(() => false));

  const allChecked = autoMatch.length > 0 && autoMatch.every(Boolean);
  const someChecked = autoMatch.some(Boolean);

  const headerRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  // Report rows up on every change so the host can enable/label its submit.
  useEffect(() => {
    onRowsChange(symbols.map((label, i) => ({ label, autoMatch: autoMatch[i] ?? false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, autoMatch]);

  // Paste/auto-match tip — click-to-toggle (works on touch, unlike hover).
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

  // Bulk paste: a multi-item list (newline-, comma-, or tab-separated) pasted
  // into a field distributes across fields from that index, overwriting onward
  // and appending as the list runs on. A single-item paste falls through to the
  // browser default so normal one-word pasting is unaffected.
  function handleSymbolPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const items = text.split(/[\r\n,\t]+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (items.length <= 1) return;
    e.preventDefault();
    setSymbols((prev) => {
      const next = prev.slice(0, index);
      next.push(...items);
      return next;
    });
    setAutoMatch((prev) => {
      const next = prev.slice(0, index);
      while (next.length < index) next.push(false);
      for (let k = 0; k < items.length; k++) next.push(allChecked);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header: "Symbols" + info tooltip on the left; the select-all sits at the
          right, column-aligned with the per-row checkboxes below. */}
      <div className="flex items-center gap-2 pr-1">
        <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
          {sectionLabel ?? t('createModalSymbolsLabel')}
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
              className="absolute left-full top-0 ml-2 z-20 w-64 rounded-theme p-3 shadow-lg text-theme-xs"
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

      {/* Cap the visible list at ~5 rows; the rest scrolls so the footer stays put. */}
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
              placeholder={placeholder ?? t('createModalSymbolPlaceholder')}
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
        style={{ background: 'var(--theme-primary)', color: 'var(--theme-alt-text)', border: 'none' }}
      >
        <Plus className="w-4 h-4" />
        {addLabel ?? t('createModalAddSymbols')}
      </button>
    </div>
  );
}
