"use client";

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { QuickSettings } from '@/app/components/app/shared/ui/QuickSettings';
import { BreadcrumbViewModeDropdown } from '@/app/components/app/shared/ui/BreadcrumbViewModeDropdown';
import { useEffect, useState } from 'react';
import { Menu, X, Home, Search, Tag, List, MessageSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useModellingSession } from '@/app/contexts/ModellingSessionContext';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';

const mobileNavItems = [
  { segment: 'home',       icon: Home,          flag: 'home_visible'       },
  { segment: 'search',     icon: Search,        flag: 'search_visible'     },
  { segment: 'categories', icon: Tag,           flag: 'categories_visible' },
  { segment: 'lists',      icon: List,          flag: 'lists_visible'      },
  { segment: 'sentences',  icon: MessageSquare, flag: 'sentences_visible'  },
  { segment: 'settings',   icon: Settings,      flag: 'settings_visible'   },
] as const;

const linkStyle = { color: 'var(--theme-secondary-alt-text)' } as const;
const boldStyle = { color: 'var(--theme-alt-text)' } as const;

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const tNav = useTranslations('nav');
  const { breadcrumbExtra } = useBreadcrumb();
  const [menuOpen, setMenuOpen] = useState(false);
  const { viewMode, stateFlags } = useProfile();
  const isStudent = viewMode === 'student-view';

  // Sync the mobile drawer with modelling steps:
  //  - Open it when the step targets a nav item that only lives inside the
  //    (mobile-hidden) Sidebar — without this the highlight target isn't in
  //    the DOM at small breakpoints and the annotation gives up.
  //  - Close it when the step moves on, so the instructor's window doesn't
  //    leave the drawer covering the page behind it. (Student-view also
  //    closes via the Link's onClick when tapped — this covers the parallel
  //    instructor mirror which doesn't tap anything.)
  // The drawer is `md:hidden`, so on desktop these state changes are no-ops.
  const { activeSession, isActive: modellingActive, currentStep } =
    useModellingSession();
  const activeHighlight =
    modellingActive && activeSession
      ? activeSession.steps[currentStep]?.highlight
      : undefined;
  useEffect(() => {
    if (activeHighlight === 'categories-nav-button') {
      setMenuOpen(true);
    } else if (activeHighlight !== undefined) {
      // Modelling is on a non-drawer step — close any drawer we opened.
      setMenuOpen(false);
    }
    // activeHighlight === undefined means no session at all; don't touch
    // the drawer (user may have opened it manually).
  }, [activeHighlight]);

  // Mobile nav respects student-view permission flags; instructor sees all.
  const visibleMobileNavItems = isStudent
    ? mobileNavItems.filter((item) => stateFlags[item.flag])
    : mobileNavItems;

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

        {/* View-mode dropdown — desktop only */}
        <div className="hidden md:block">
          <BreadcrumbViewModeDropdown />
        </div>

        {/* Full breadcrumb trail — desktop only */}
        <span className="hidden md:inline text-small" style={linkStyle}>›</span>
        <div className="hidden md:flex">
          {breadcrumbs}
        </div>

        <div className="flex-1" />

        {(!isStudent || stateFlags.quick_settings_visible) && <QuickSettings />}
      </header>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 flex flex-col overflow-auto"
          style={{
            top: '48px',
            background: 'var(--theme-card)',
            // Default z-60 keeps the drawer above page content. When a
            // modelling session is active, bump above the backdrop (z-80)
            // so the wrapped target inside the drawer can show its
            // highlight ring — the drawer creates a stacking context and
            // would otherwise trap its z-90 child below z-80.
            zIndex: modellingActive ? 85 : 60,
          }}
        >
          {/* Internal dim for non-target rows during modelling. The drawer
              now sits above the viewport backdrop, so without this layer
              the whole drawer would render at full brightness. The wrapped
              target inside the drawer has zIndex 90 within this stacking
              context, which escapes this z-1 dim. Pointer-events 'none' so
              page scroll still works through the drawer. */}
          {modellingActive && (
            <div
              aria-hidden
              className="absolute inset-0 bg-black"
              style={{ opacity: 0.65, zIndex: 1, pointerEvents: 'none' }}
            />
          )}
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid var(--theme-line)' }}
          >
            <div className="flex items-center gap-2">
              <BreadcrumbViewModeDropdown />
              <span className="text-small" style={linkStyle}>›</span>
              {breadcrumbs}
            </div>
          </div>

          <nav className="flex flex-col gap-3 p-5">
            {visibleMobileNavItems.map(({ segment, icon: Icon }) => {
              const link = (
                <Link
                  href={`/${locale}/${segment}`}
                  onClick={() => setMenuOpen(false)}
                  className={cn(btnBase, isActive(segment) ? btnActive : btnInactive)}
                >
                  <Icon className="w-4 h-8 shrink-0" />
                  <span className="truncate">{tNav(segment)}</span>
                </Link>
              );

              // Mirror the Sidebar's modelling wrapper so highlights resolve
              // on small screens too. Same componentKey as Sidebar.tsx:74.
              if (segment === 'categories') {
                return (
                  <ModellingOverlayWrapper
                    key={segment}
                    componentKey="categories-nav-button"
                  >
                    {link}
                  </ModellingOverlayWrapper>
                );
              }

              return <div key={segment}>{link}</div>;
            })}
          </nav>
        </div>
      )}
    </>
  );
}
