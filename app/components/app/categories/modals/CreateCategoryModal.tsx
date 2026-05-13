"use client";

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
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
  onCreate: (name: string, symbolLabels: string[]) => Promise<void>;
};

const INITIAL_SYMBOLS = ['', '', '', ''];

export function CreateCategoryModal({ isOpen, onClose, onCreate }: Props) {
  const t = useTranslations('categories');
  const [name, setName] = useState('');
  const [symbols, setSymbols] = useState<string[]>(INITIAL_SYMBOLS);
  const [isCreating, setIsCreating] = useState(false);

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
  }

  function reset() {
    setName('');
    setSymbols(INITIAL_SYMBOLS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, symbols);
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
            <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
              {t('createModalSymbolsLabel')}
            </label>

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
                    placeholder={t('createModalSymbolPlaceholder')}
                    className="flex-1 px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
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
              {isCreating ? t('creating') : t('createModalCreate')}
            </button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
