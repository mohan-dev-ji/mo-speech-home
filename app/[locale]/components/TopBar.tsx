"use client";

import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);
  const currentSegment = segments[0] ?? 'home';
  const pageLabel = tNav.has(currentSegment) ? tNav(currentSegment) : currentSegment;

  return (
    <header
      className="h-12 flex items-center px-5 gap-2 shrink-0"
      style={{ background: 'var(--theme-bg-surface-alt)' }}
    >
      <span
        className="text-small font-medium px-2.5 py-1 rounded-md"
        style={{
          background: 'rgba(0,0,0,0.25)',
          color: 'var(--theme-nav-text)',
        }}
      >
        {tCommon('instructor')}
      </span>
      <span className="text-small" style={{ color: 'var(--theme-nav-text)', opacity: 0.5 }}>›</span>
      <span className="text-small font-medium" style={{ color: 'var(--theme-nav-text)' }}>
        {pageLabel}
      </span>
    </header>
  );
}
