"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Search, Tag, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoSvg } from './LogoSvg';

type SidebarProps = {
  locale: string;
};

const mainNavItems = [
  { segment: 'home',       icon: Home   },
  { segment: 'search',     icon: Search },
  { segment: 'categories', icon: Tag    },
] as const;

export function Sidebar({ locale }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`);
  }

  // Shared button shape — full-width, token-driven padding and radius
  const btnBase = 'w-full flex items-center gap-2.5 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-small font-medium transition-colors';
  const btnInactive = 'bg-theme-primary text-theme-alt-text hover:opacity-90';
  const btnActive   = 'bg-theme-button-highlight text-theme-text';

  return (
    <aside className="flex flex-col shrink-0 h-full bg-theme-card">

      {/* Logo — general padding all round; w-[155px] on the SVG drives the sidebar's natural width */}
      <div className="p-theme-general">
        <LogoSvg className="w-[155px] text-theme-alt-text" />
      </div>

      {/* Nav — same horizontal padding as logo section to keep buttons aligned */}
      <nav className="flex flex-col flex-1 gap-theme-general px-theme-general">
        {mainNavItems.map(({ segment, icon: Icon }) => (
          <Link
            key={segment}
            href={`/${locale}/${segment}`}
            className={cn(btnBase, isActive(segment) ? btnActive : btnInactive)}
          >
            <Icon className="w-4 h-8 shrink-0" />
            <span className="truncate">{t(segment)}</span>
          </Link>
        ))}
      </nav>

      {/* Settings — pinned to bottom, same horizontal padding as nav */}
      <div className="px-theme-general pb-theme-general pt-2">
        <Link
          href={`/${locale}/settings`}
          className={cn(btnBase, isActive('settings') ? btnActive : btnInactive)}
        >
          <Settings className="w-4 h-8 shrink-0" />
          <span className="truncate">{t('settings')}</span>
        </Link>
      </div>

    </aside>
  );
}
