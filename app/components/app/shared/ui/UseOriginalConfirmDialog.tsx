"use client";

import { useTranslations } from 'next-intl';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/app/components/app/shared/ui/Dialog';

/** Shared light confirm for reverting one board's version back to the original. */
export function UseOriginalConfirmDialog({
  open, onOpenChange, name, onConfirm, isPending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  const t = useTranslations('translate');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('useOriginalTitle')}</DialogTitle>
          <DialogDescription>{t('useOriginalBody', { name })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
              style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
            >
              {t('useOriginalCancel')}
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
          >
            {isPending ? t('useOriginalPending') : t('useOriginalTitle')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
