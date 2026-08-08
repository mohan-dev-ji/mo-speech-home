"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/app/shared/ui/Dialog';
import { SymbolListFields, type SymbolRow } from '@/app/components/app/shared/ui/SymbolListFields';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Insert the pasted rows into the target container (auto-match resolved by the host). */
  onSubmit: (rows: SymbolRow[]) => Promise<void>;
};

/**
 * "Add a list" modal for the core-words dropdown — the paste + auto-match block
 * from the New-category modal, minus the name field. Submits the rows for the
 * host to auto-match and append into the core-words grid (ticked rows resolve to
 * their top symbol hit; unticked rows land as editable placeholders).
 */
export function AddListModal({ isOpen, onClose, onSubmit }: Props) {
  const t = useTranslations('talker');
  const [rows, setRows] = useState<SymbolRow[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  const hasWords = rows.some((r) => r.label.trim().length > 0);
  const someChecked = rows.some((r) => r.autoMatch);

  function reset() {
    setResetSignal((n) => n + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasWords) return;
    setIsAdding(true);
    try {
      await onSubmit(rows);
      reset();
      onClose();
    } finally {
      setIsAdding(false);
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
          <DialogTitle>{t('addListTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* `key` bump remounts the fields for a clean reset. */}
          <SymbolListFields key={resetSignal} onRowsChange={setRows} />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="py-3 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
            >
              {t('addListCancel')}
            </button>
            <button
              type="submit"
              disabled={!hasWords || isAdding}
              className="py-3 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {isAdding
                ? (someChecked ? t('addListAutoMatching') : t('addListAdding'))
                : t('addListSubmit')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
