"use client";

import { useTranslations } from 'next-intl';
import { needsTranslation } from '@/lib/languages/variants';
import { resolvedLocale } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';

/** View-mode "Made in <lang>" pill for order-free labels (Phase 15.5). Renders
 *  only when the record lacks the board-language key; tapping opens the shared
 *  translate modal. Mirrors the sentence/phrase badge, reused for folder names,
 *  list titles and list item descriptions. */
export function TranslateBadge({ record, language, onClick, className }: {
  record: Record<string, string> | undefined;
  language: string;
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations('translate');
  if (!needsTranslation(record, language)) return null;
  const loc = resolvedLocale(record, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={t('chooseTitle', { lang: language.toUpperCase() })}
      className={`shrink-0 self-center rounded-full text-theme-xs font-semibold px-3 py-1 whitespace-nowrap transition-opacity hover:opacity-80 cursor-pointer ${className ?? ''}`}
      style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
    >
      {t('madeInBadge', { lang: loc.toUpperCase() })}
    </button>
  );
}
