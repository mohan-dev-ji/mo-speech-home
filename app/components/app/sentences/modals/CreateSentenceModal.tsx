"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/app/shared/ui/Dialog';
import { GroupPicker, DRAFTS_SELECTION, isGroupSelectionReady, type GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // Options are named rather than positional: autoMatch arrived in phase-24 and
  // the group would have made a third argument whose order a caller has to
  // remember. CreateListModal takes the same shape.
  onCreate: (name: string, opts: { autoMatch: boolean; group?: GroupSelection }) => Promise<void>;
  // Ask where the sentence should go. Off by default: the Sentences page opens
  // this from inside a group, and the talker's Create Phrase files into
  // board.phrasesFolderId.
  showGroupPicker?: boolean;
  // Show the auto-match checkbox. Off by default: the talker dropbar reuses this
  // modal for "Create Phrase", and a phrase stores words[] with per-word labels
  // and clips — a different shape this fill doesn't produce.
  showAutoMatch?: boolean;
  // Optional copy overrides — default to the sentence strings. The talker
  // dropbar reuses this modal for "Create Phrase" and passes phrase copy.
  title?: string;
  nameLabel?: string;
  placeholder?: string;
};

export function CreateSentenceModal({ isOpen, onClose, onCreate, showGroupPicker = false, showAutoMatch = false, title, nameLabel, placeholder }: Props) {
  const t = useTranslations('sentences');
  const [name, setName] = useState('');
  const [autoMatch, setAutoMatch] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [group, setGroup] = useState<GroupSelection>(DRAFTS_SELECTION);

  function reset() {
    setName('');
    setAutoMatch(false);
    setGroup(DRAFTS_SELECTION);
    // Convex's query() has no rejection path for a disconnected socket, so a
    // create that never settles would otherwise leave isCreating stuck true —
    // the Create button permanently disabled on reopen, until a full reload.
    setIsCreating(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, { autoMatch, ...(showGroupPicker ? { group } : {}) });
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
          <DialogTitle>{title ?? t('createModalTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
              {nameLabel ?? t('createModalNameLabel')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder ?? t('createModalNamePlaceholder')}
                autoFocus
                className="flex-1 min-w-0 px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                style={{
                  background: 'var(--theme-symbol-bg)',
                  color: 'var(--theme-text)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
              {/* Auto-match: fills one image-only slot per word from each word's
                  top search hit. Styling matches SymbolListFields' select-all. */}
              {showAutoMatch && (
                <label
                  className="flex items-center gap-2 text-theme-xs cursor-pointer shrink-0"
                  style={{ color: 'var(--theme-secondary-text)' }}
                >
                  {t('createModalAutoMatch')}
                  <input
                    type="checkbox"
                    checked={autoMatch}
                    onChange={(e) => setAutoMatch(e.target.checked)}
                    aria-label={t('createModalAutoMatchAria')}
                    className="w-6 h-6 shrink-0 accent-[var(--theme-brand-primary)] cursor-pointer"
                  />
                </label>
              )}
            </div>
          </div>

          {showGroupPicker && (
            <GroupPicker tree="sentences" value={group} onChange={setGroup} />
          )}

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
              style={{ background: '#16a34a', color: '#fff' }}
            >
              {isCreating
                ? (autoMatch ? t('createModalAutoMatching') : t('creating'))
                : t('createModalCreate')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
