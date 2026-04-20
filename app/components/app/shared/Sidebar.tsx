"use client";

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Search, Tag, List, Settings } from 'lucide-react';
import { NavTabButton } from '@/app/components/shared/ui/NavTabButton';
import { LogoSvg } from '@/app/components/app/shared/LogoSvg';

type SidebarProps = {
  locale: string;
};

const mainNavItems = [
  { segment: 'home',       icon: Home   },
  { segment: 'search',     icon: Search },
  { segment: 'categories', icon: Tag    },
  { segment: 'lists',      icon: List   },
] as const;

export function Sidebar({ locale }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`);
  }

  return (
    <aside className="hidden md:flex flex-col shrink-0 h-full bg-theme-card">

      <div className="p-theme-general">
        <LogoSvg className="w-[155px] text-theme-alt-text" />
      </div>

      <nav className="flex flex-col flex-1 gap-theme-general px-theme-general">
        {mainNavItems.map(({ segment, icon: Icon }) => (
          <NavTabButton
            key={segment}
            href={`/${locale}/${segment}`}
            active={isActive(segment)}
            size="lg"
          >
            <Icon className="w-4 h-8 shrink-0" />
            <span className="truncate">{t(segment)}</span>
          </NavTabButton>
        ))}
      </nav>

      <div className="px-theme-general pb-theme-general pt-2">
        <NavTabButton
          href={`/${locale}/settings`}
          active={isActive('settings')}
          size="lg"
        >
          <Settings className="w-4 h-8 shrink-0" />
          <span className="truncate">{t('settings')}</span>
        </NavTabButton>
      </div>

    </aside>
  );
}
