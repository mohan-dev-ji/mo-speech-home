"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/app/components/shared/ui/Dialog';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
};

export function CreateListModal({ isOpen, onClose, onCreate }: Props) {
  const t = useTranslations('categoryDetail');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed);
      setName('');
      onClose();
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setName('');
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('listsCreateModalTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-theme-s font-medium"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {t('listsCreateModalNameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('listsCreateModalNamePlaceholder')}
              autoFocus
              className="w-full px-3 py-2 rounded-theme-sm text-theme-s outline-none transition-shadow"
              style={{
                background: 'var(--theme-bg-surface, rgba(255,255,255,0.08))',
                color: 'var(--theme-text-primary)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('listsCreateModalCancel')}
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-brand-primary, var(--theme-primary))', color: '#fff' }}
            >
              {isCreating ? t('listsCreating') : t('listsCreateModalCreate')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
