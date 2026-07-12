"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Languages } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/app/shared/ui/Dialog';
import { getLanguage } from '@/lib/languages/registry';

/**
 * Badge → authoring modal (ADR-016 Addendum B). Opened from the "Made in <lang>"
 * badge to author a native variant in the board language. Two paths:
 *   • Translate to <lang> — MT-fills the target text: a fluent sentence's one
 *     string, or a block sentence's per-unit labels (gaps only). The instructor
 *     then re-orders the symbols. The accessibility path — author by ordering,
 *     not by typing the target script.
 *   • Edit manually — arrange + type it yourself.
 * The parent performs the async work (translation + create) per sentence type;
 * this modal is a mode picker that reflects busy/error while it runs.
 */
export function VariantAuthorModal({
  isOpen,
  onClose,
  targetLang,
  authoredLang,
  onAuthor,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetLang: string;
  authoredLang: string;
  /** Run the chosen path (parent handles translate + create, then edit mode).
   *  Rejects on failure so the modal can surface an error. */
  onAuthor: (mode: 'manual' | 'translate') => Promise<void>;
}) {
  const t = useTranslations('sentences');
  const [busy, setBusy] = useState<null | 'manual' | 'translate'>(null);
  const [error, setError] = useState(false);

  const langLabel = getLanguage(targetLang)?.nativeLabel ?? targetLang.toUpperCase();
  const authoredLabel = getLanguage(authoredLang)?.nativeLabel ?? authoredLang.toUpperCase();

  async function run(mode: 'manual' | 'translate') {
    setBusy(mode);
    setError(false);
    try {
      await onAuthor(mode);
      // Parent closes the modal + enters edit mode on success.
    } catch {
      setError(true);
      setBusy(null);
    }
  }

  const optionClass =
    'flex items-start gap-3 w-full text-left p-theme-item rounded-theme-sm transition-opacity hover:opacity-90 disabled:opacity-50';

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('variantTitle', { lang: langLabel })}</DialogTitle>
          <DialogDescription>
            {t('variantDescription', { lang: langLabel, authoredLang: authoredLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Translate (MT-assist) — listed first: the accessibility path. */}
          <button
            type="button"
            onClick={() => run('translate')}
            disabled={!!busy}
            className={optionClass}
            style={{ background: 'var(--theme-primary)', color: 'var(--theme-alt-text)' }}
          >
            <Languages className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-theme-s font-semibold">
                {busy === 'translate' ? t('variantTranslating') : t('variantTranslate', { lang: langLabel })}
              </span>
              <span className="text-theme-xs opacity-90">{t('variantTranslateHint', { lang: langLabel })}</span>
            </span>
          </button>

          {/* Manual authoring. */}
          <button
            type="button"
            onClick={() => run('manual')}
            disabled={!!busy}
            className={optionClass}
            style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
          >
            <Pencil className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-theme-s font-semibold">{t('variantEditManually')}</span>
              <span className="text-theme-xs opacity-80">{t('variantEditManuallyHint', { lang: langLabel })}</span>
            </span>
          </button>

          {error && (
            <p className="text-theme-xs font-medium" style={{ color: 'var(--theme-warning)' }}>
              {t('variantError')}
            </p>
          )}
          <p className="text-theme-xs text-theme-secondary-alt-text">
            {t('variantTranslateWarning', { lang: langLabel })}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
