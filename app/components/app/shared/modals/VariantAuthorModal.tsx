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
 *   • Translate to <lang> — MT-fills the target text (voice resolves live from
 *     the text), then the instructor re-orders the symbols. The accessibility
 *     path: an author who can't type the target script still authors by ordering.
 *   • Edit manually — type the target text yourself.
 * Both create a sibling variant (seeded from the source); the parent then drops
 * into edit mode so the symbols can be re-ordered to the target-language order.
 */
export function VariantAuthorModal({
  isOpen,
  onClose,
  targetLang,
  authoredLang,
  sourceText,
  canTranslate,
  onAuthor,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetLang: string;
  authoredLang: string;
  /** Source composition text (fed to MT for the Translate path). */
  sourceText: string;
  /** Whether the MT "Translate" path applies. True for fluent sentences (the one
   *  whole-utterance string needs MT); false for sequence sentences, whose unit
   *  labels are localised and resolve to the board language on their own — the
   *  instructor only re-orders. */
  canTranslate: boolean;
  /** Create the variant with optional pre-filled translated text; parent then
   *  enters edit mode. Rejects on failure so the modal can show an error. */
  onAuthor: (text?: string) => Promise<void>;
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
      let text: string | undefined;
      if (mode === 'translate') {
        const res = await fetch('/api/translate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sourceText, targetLang }),
        });
        if (!res.ok) throw new Error('translate failed');
        const data = (await res.json()) as { translated?: unknown };
        text = typeof data.translated === 'string' ? data.translated : undefined;
        if (!text) throw new Error('no translation');
      }
      await onAuthor(text);
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
          {/* Translate (MT-assist) — listed first: the accessibility path. Only
              for fluent sentences; sequence unit labels already localise. */}
          {canTranslate && (
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
          )}

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
