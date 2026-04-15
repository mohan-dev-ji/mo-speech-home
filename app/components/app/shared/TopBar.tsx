"use client";

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useState } from 'react';
import { Menu, X, Home, Search, Tag, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { segment: 'home',       icon: Home     },
  { segment: 'search',     icon: Search   },
  { segment: 'categories', icon: Tag      },
  { segment: 'settings',   icon: Settings },
] as const;

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tTopBar = useTranslations('topBar');
  const { stateFlags, setTalkerVisible } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);

  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);
  const currentSegment = segments[0] ?? 'home';
  const pageLabel = tNav.has(currentSegment) ? tNav(currentSegment) : currentSegment;
  const isSearchPage = currentSegment === 'search';

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`);
  }

  const btnBase = 'w-full flex items-center gap-2.5 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-small font-medium transition-colors';
  const btnInactive = 'bg-theme-primary text-theme-alt-text hover:opacity-90';
  const btnActive   = 'bg-theme-button-highlight text-theme-text';

  const headerToggle = isSearchPage && (
    <button
      type="button"
      onClick={() => setTalkerVisible(!stateFlags.talker_visible)}
      className="flex items-center gap-2"
      aria-label={tTopBar('headerToggleLabel')}
    >
      <div
        className="relative w-10 h-6 rounded-full transition-colors duration-200"
        style={{
          background: stateFlags.talker_visible
            ? 'var(--theme-success)'
            : 'rgba(255,255,255,0.2)',
        }}
      >
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
  );

  return (
    <>
      <header
        className="flex items-center px-5 gap-2 shrink-0"
        style={{ background: 'var(--theme-banner)', minHeight: '48px', zIndex: 70 }}
      >
        {/* Hamburger — mobile only */}
        <button
          type="button"
          className="md:hidden flex items-center justify-center w-8 h-8 -ml-1.5 rounded-md"
          style={{ color: 'var(--theme-secondary-alt-text)' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Page label — mobile only, shown inline in the bar for context */}
        <span
          className="md:hidden text-small font-medium"
          style={{ color: 'var(--theme-secondary-alt-text)' }}
        >
          {pageLabel}
        </span>

        {/* Breadcrumb — desktop only */}
        <span
          className="hidden md:inline text-small font-medium px-2.5 py-1 rounded-md"
          style={{
            color: 'var(--theme-secondary-alt-text)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {tCommon('instructor')}
        </span>
        <span className="hidden md:inline text-small" style={{ color: 'var(--theme-secondary-alt-text)' }}>›</span>
        <span className="hidden md:inline text-small font-medium" style={{ color: 'var(--theme-secondary-alt-text)' }}>
          {pageLabel}
        </span>

        <div className="flex-1" />

        {/* Header toggle — desktop only; lives in the dropdown on mobile */}
        <div className="hidden md:flex">
          {headerToggle}
        </div>
      </header>

      {/* Mobile dropdown — fullscreen panel below the bar */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 flex flex-col overflow-auto"
          style={{ top: '48px', background: 'var(--theme-card)', zIndex: 60 }}
        >
          {/* Topbar section: breadcrumb + mode buttons */}
          <div
            className="px-5 py-4 flex flex-col gap-3"
            style={{ borderBottom: '1px solid var(--theme-line)' }}
          >
            <div className="flex items-center gap-2">
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
            </div>
            {headerToggle}
          </div>

          {/* Nav links — full width */}
          <nav className="flex flex-col gap-3 p-5">
            {mobileNavItems.map(({ segment, icon: Icon }) => (
              <Link
                key={segment}
                href={`/${locale}/${segment}`}
                onClick={() => setMenuOpen(false)}
                className={cn(btnBase, isActive(segment) ? btnActive : btnInactive)}
              >
                <Icon className="w-4 h-8 shrink-0" />
                <span className="truncate">{tNav(segment)}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
