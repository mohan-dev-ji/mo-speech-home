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
      className="h-auto py-theme-general flex items-center px-5 gap-2 shrink-0 bg-theme-banner"
    >
      <span
        className="text-small font-medium px-2.5 py-1 rounded-md text-theme-secondary-alt-text"
        
      >
        {tCommon('instructor')}
      </span>
      <span className="text-theme-secondary-alt-text">›</span>
      <span className="text-theme-secondary-alt-text font-medium">
        {pageLabel}
      </span>
    </header>
  );
}
