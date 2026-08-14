"use client";

import { useTranslations } from 'next-intl';

/**
 * Non-actionable "Made in <LANG>" origin label. Edit-mode only, shown on a
 * NON-ORIGIN board — on BOTH the untranslated-fallback and the translated
 * states — to name where the master lives. `lang` is the content's
 * origin/authored language: callers pass `authoredLanguage ?? DEFAULT_LOCALE`
 * (ADR-019 for lists, ADR-020 for categories/folders).
 */
export function MadeInLabel({ lang, className }: { lang: string; className?: string }) {
  const t = useTranslations('translate');
  return (
    <span
      className={`shrink-0 self-center rounded-full text-theme-xs font-semibold px-3 py-1 whitespace-nowrap ${className ?? ''}`}
      style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
    >
      {t('madeInBadge', { lang: lang.toUpperCase() })}
    </span>
  );
}
