"use client";

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Search, Tag, List, MessageSquare, Settings } from 'lucide-react';
import { NavTabButton } from '@/app/components/app/shared/ui/NavTabButton';
import { LogoSvg } from '@/app/components/app/shared/ui/LogoSvg';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useNavbarVariant } from '@/app/contexts/NavbarVariantContext';

type SidebarProps = {
  locale: string;
};

// segmentFlag: which stateFlags entry gates this nav item in student-view.
// In instructor view all nav items are visible regardless of flag.
const mainNavItems = [
  { segment: 'home',       icon: Home,          flag: 'home_visible'       },
  { segment: 'search',     icon: Search,        flag: 'search_visible'     },
  { segment: 'categories', icon: Tag,           flag: 'categories_visible' },
  { segment: 'lists',      icon: List,          flag: 'lists_visible'      },
  { segment: 'sentences',  icon: MessageSquare, flag: 'sentences_visible'  },
] as const;

export function Sidebar({ locale }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { viewMode, stateFlags } = useProfile();
  const { minimal, side } = useNavbarVariant();
  const onRight = side === 'right';
  const isStudent = viewMode === 'student-view';

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`);
  }

  // In instructor view all items show. In student-view, only items whose flag is true.
  const visibleNavItems = isStudent
    ? mainNavItems.filter((item) => stateFlags[item.flag])
    : mainNavItems;

  const settingsVisible = isStudent ? !!stateFlags.settings_visible : true;

  // The aside carries the outer padding; the logo wrapper then mirrors a nav
  // button's x-padding (`px-theme-btn-x`) so the glyph aligns with the button
  // icons, and the buttons (w-full) grow to fill the logo-driven rail width.
  // Minimal (Figma `variant=Minimal`) collapses to a fixed icon-only rail.
  // `side='right'` flips the rail to the right (tablet handedness) via flex
  // `order` — the bg/texture layers are position:fixed so they're unaffected —
  // and moves the edge line to the left.
  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 h-full border-theme-line px-theme-general ${
        onRight ? 'order-last border-l' : 'border-r'
      } ${minimal ? 'w-[84px]' : ''}`}
    >

      {/* Logo links to the marketing landing in the current locale.
          Signed-in users can reach the Hero/Features/Pricing surface from here.
          Note: not the bare `/` splash dispatcher — that redirects authenticated
          users back to /<locale>/home, which would create a loop. */}
      <Link
        href={`/${locale}`}
        className="px-theme-btn-x py-theme-general block"
        aria-label="Mo Speech Home — marketing"
      >
        <LogoSvg
          variant={minimal ? 'no-text' : 'default'}
          className={`${minimal ? 'w-[17px]' : 'w-[147px]'} text-theme-primary`}
        />
      </Link>

      <nav className="flex flex-col flex-1">
        {visibleNavItems.map(({ segment, icon: Icon }) => {
          const button = (
            <NavTabButton
              href={`/${locale}/${segment}`}
              active={isActive(segment)}
              size="lg"
              iconOnly={minimal}
              ariaLabel={minimal ? t(segment) : undefined}
            >
              <Icon className="size-5 shrink-0" />
              {!minimal && <span className="truncate">{t(segment)}</span>}
            </NavTabButton>
          );

          if (segment === 'categories') {
            return (
              <ModellingOverlayWrapper key={segment} componentKey="categories-nav-button">
                {button}
              </ModellingOverlayWrapper>
            );
          }

          return <Fragment key={segment}>{button}</Fragment>;
        })}
      </nav>

      {settingsVisible && (
        <div className="pb-theme-general">
          <NavTabButton
            href={`/${locale}/settings`}
            active={isActive('settings')}
            size="lg"
            iconOnly={minimal}
            ariaLabel={minimal ? t('settings') : undefined}
          >
            <Settings className="size-5 shrink-0" />
            {!minimal && <span className="truncate">{t('settings')}</span>}
          </NavTabButton>
        </div>
      )}

    </aside>
  );
}
