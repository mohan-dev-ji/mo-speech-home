"use client";

import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/app/contexts/ProfileContext';

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tTopBar = useTranslations('topBar');

  const { stateFlags, setTalkerVisible } = useProfile();

  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);
  const currentSegment = segments[0] ?? 'home';
  const pageLabel = tNav.has(currentSegment) ? tNav(currentSegment) : currentSegment;

  const isSearchPage = currentSegment === 'search';

  return (
    <header className="flex items-center px-5 gap-2 shrink-0" style={{ background: 'var(--theme-banner)', minHeight: '48px' }}>
      {/* Breadcrumb */}
      <span
        className="text-small font-medium px-2.5 py-1 rounded-md"
        style={{
          color: 'var(--theme-secondary-alt-text)',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        {tCommon('instructor')}
      </span>
      <span className="text-small" style={{ color: 'var(--theme-secondary-alt-text)' }}>›</span>
      <span className="text-small font-medium" style={{ color: 'var(--theme-secondary-alt-text)' }}>
        {pageLabel}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Header toggle — search page only */}
      {isSearchPage && (
        <button
          type="button"
          onClick={() => setTalkerVisible(!stateFlags.talker_visible)}
          className="flex items-center gap-2"
          aria-label={tTopBar('headerToggleLabel')}
        >
          {/* Toggle track */}
          <div
            className="relative w-10 h-6 rounded-full transition-colors duration-200"
            style={{
              background: stateFlags.talker_visible
                ? 'var(--theme-success)'
                : 'rgba(255,255,255,0.2)',
            }}
          >
            {/* Toggle thumb */}
            <span
              className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
              style={{
                transform: stateFlags.talker_visible
                  ? 'translateX(18px)'
                  : 'translateX(2px)',
              }}
            />
          </div>
          <span className="text-small font-medium" style={{ color: 'var(--theme-secondary-alt-text)' }}>
            {tTopBar('header')}
          </span>
        </button>
      )}
    </header>
  );
}
