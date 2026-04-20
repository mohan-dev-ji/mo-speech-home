"use client";

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { QuickSettings } from '@/app/components/app/shared/QuickSettings';
import { useState } from 'react';
import { Menu, X, Home, Search, Tag, List, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { segment: 'home',       icon: Home     },
  { segment: 'search',     icon: Search   },
  { segment: 'categories', icon: Tag      },
  { segment: 'lists',      icon: List     },
  { segment: 'settings',   icon: Settings },
] as const;

const linkStyle = { color: 'var(--theme-secondary-alt-text)' } as const;
const boldStyle = { color: 'var(--theme-alt-text)' } as const;

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const { breadcrumbExtra } = useBreadcrumb();
  const [menuOpen, setMenuOpen] = useState(false);

  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);
  const currentSegment = segments[0] ?? 'home';
  const isSubPage = segments.length >= 2;

  // Label shown in mobile bar — deepest crumb
  const mobileLabel = isSubPage && breadcrumbExtra
    ? breadcrumbExtra.label
    : (tNav.has(currentSegment) ? tNav(currentSegment) : currentSegment);

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`);
  }

  const btnBase = 'w-full flex items-center gap-2.5 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-small font-medium transition-colors';
  const btnInactive = 'bg-theme-primary text-theme-alt-text hover:opacity-90';
  const btnActive   = 'bg-theme-button-highlight text-theme-text';

  // ─── Breadcrumb nodes ────────────────────────────────────────────────────────

  const homeNode = currentSegment === 'home' ? (
    <span className="flex items-center gap-1 text-small font-semibold" style={boldStyle}>
      <Home className="w-3.5 h-3.5" />
      {tNav('home')}
    </span>
  ) : (
    <Link
      href={`/${locale}/home`}
      className="flex items-center gap-1 text-small font-medium transition-colors hover:underline"
      style={linkStyle}
    >
      <Home className="w-3.5 h-3.5" />
      {tNav('home')}
    </Link>
  );

  const sectionLabel = tNav.has(currentSegment) ? tNav(currentSegment) : currentSegment;
  const sectionNode = currentSegment !== 'home' && (
    isSubPage ? (
      <Link
        href={`/${locale}/${currentSegment}`}
        className="text-small font-medium transition-colors hover:underline"
        style={linkStyle}
      >
        {sectionLabel}
      </Link>
    ) : (
      <span className="text-small font-semibold" style={boldStyle}>
        {sectionLabel}
      </span>
    )
  );

  const detailNode = isSubPage && breadcrumbExtra && (
    <span className="flex items-center gap-1.5 text-small font-semibold" style={boldStyle}>
      {breadcrumbExtra.colour && (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: breadcrumbExtra.colour }}
        />
      )}
      {breadcrumbExtra.label}
    </span>
  );

  const sep = <span className="text-small" style={linkStyle}>›</span>;

  const breadcrumbs = (
    <div className="flex items-center gap-2">
      {homeNode}
      {sectionNode && <>{sep}{sectionNode}</>}
      {detailNode && <>{sep}{detailNode}</>}
    </div>
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
          style={linkStyle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Page label — mobile only */}
        <span className="md:hidden text-small font-medium" style={linkStyle}>
          {mobileLabel}
        </span>

        {/* Instructor badge — desktop only */}
        <span
          className="hidden md:inline text-small font-medium px-2.5 py-1 rounded-md shrink-0"
          style={{
            color: 'var(--theme-secondary-alt-text)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {tCommon('instructor')}
        </span>

        {/* Full breadcrumb trail — desktop only */}
        <span className="hidden md:inline text-small" style={linkStyle}>›</span>
        <div className="hidden md:flex">
          {breadcrumbs}
        </div>

        <div className="flex-1" />

        <QuickSettings />
      </header>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 flex flex-col overflow-auto"
          style={{ top: '48px', background: 'var(--theme-card)', zIndex: 60 }}
        >
          <div
            className="px-5 py-4"
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
              <span className="text-small" style={linkStyle}>›</span>
              {breadcrumbs}
            </div>
          </div>

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
