"use client";

import { useTranslations } from 'next-intl';

/**
 * Non-actionable "Made in <LANG>" origin label. Edit-mode only, and rendered
 * only alongside a TranslateRevertControl in its `untranslated` state — that is
 * exactly when a fallback origin exists to name. `lang` is the RESOLVED origin
 * locale (callers compute it with `resolvedLocale`).
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
