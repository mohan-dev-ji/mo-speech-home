"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Search, Tag, Settings, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const navItemBase = cn(
    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-small font-medium transition-opacity'
  );

  return (
    <aside
      className="w-40 flex flex-col shrink-0 h-full"
      style={{ background: 'var(--theme-nav-bg)' }}
    >
      {/* Logo — brand name stays Latin across all locales */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Mic className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-nav-text)' }} />
        <span
          className="font-semibold text-sm leading-none"
          style={{ color: 'var(--theme-nav-text)' }}
          lang="en"
        >
          Mo Speech
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-2 flex-1 px-3">
        {mainNavItems.map(({ segment, icon: Icon }) => (
          <Link
            key={segment}
            href={`/${locale}/${segment}`}
            className={cn(navItemBase, isActive(segment) ? 'opacity-100 shadow-sm' : 'opacity-75 hover:opacity-100')}
            style={{
              background: 'var(--theme-bg-surface)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t(segment)}
          </Link>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-5">
        <Link
          href={`/${locale}/settings`}
          className={cn(navItemBase, isActive('settings') ? 'opacity-100 shadow-sm' : 'opacity-75 hover:opacity-100')}
          style={{
            background: 'var(--theme-bg-surface)',
            color: 'var(--theme-text-primary)',
          }}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {t('settings')}
        </Link>
      </div>
    </aside>
  );
}
