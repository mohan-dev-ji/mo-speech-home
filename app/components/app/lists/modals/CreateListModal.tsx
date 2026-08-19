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
import { GroupPicker, DRAFTS_SELECTION, isGroupSelectionReady, type GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // Options are named rather than positional: this callback already carried the
  // rows, and the group would have made a third argument whose order a caller
  // has to remember. CreateSentenceModal takes the same shape.
  onCreate: (name: string, opts: { rows: SymbolRow[]; group?: GroupSelection }) => Promise<void>;
  // Ask where the list should go. Off by default: the Lists page opens this
  // modal from inside a group, where the folder is already implied.
  showGroupPicker?: boolean;
};

export function CreateListModal({ isOpen, onClose, onCreate, showGroupPicker = false }: Props) {
  const t = useTranslations('lists');
  const [name, setName] = useState('');
  const [rows, setRows] = useState<SymbolRow[]>([]);
  const [resetSignal, setResetSignal] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [group, setGroup] = useState<GroupSelection>(DRAFTS_SELECTION);
  const someChecked = rows.some((r) => r.autoMatch);

  function reset() {
    setName('');
    setResetSignal((n) => n + 1);
    setGroup(DRAFTS_SELECTION);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, { rows, ...(showGroupPicker ? { group } : {}) });
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createModalTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* List name */}
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

          {/* Steps — shared paste + auto-match block; `key` bump resets on close.
              Auto-match fills each step's symbol IMAGE (text stays the typed step). */}
          <SymbolListFields
            key={resetSignal}
            onRowsChange={setRows}
            sectionLabel={t('createModalListLabel')}
            placeholder={t('createModalStepPlaceholder')}
            addLabel={t('createModalAddSteps')}
          />

          {showGroupPicker && (
            <GroupPicker tree="lists" value={group} onChange={setGroup} />
          )}

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
              disabled={!name.trim() || isCreating || (showGroupPicker && !isGroupSelectionReady(group))}
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
