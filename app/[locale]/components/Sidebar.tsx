"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Tag, Settings, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

type SidebarProps = {
  locale: string;
};

const mainNavItems = [
  { segment: 'home', icon: Home },
  { segment: 'search', icon: Search },
  { segment: 'categories', icon: Tag },
] as const;

// Labels are hardcoded in English for the shell; Phase 2+ uses useTranslations
const LABELS: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  categories: 'Category',
  settings: 'Settings',
};

export function Sidebar({ locale }: SidebarProps) {
  const pathname = usePathname();

  function isActive(segment: string) {
    return pathname.startsWith(`/${locale}/${segment}`);
  }

  return (
    <aside className="w-40 flex flex-col bg-app-sidebar shrink-0 h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Mic className="w-4 h-4 text-app-logo shrink-0" />
        <span className="text-app-logo font-semibold text-sm leading-none">Mo Speech</span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-2 flex-1 px-3">
        {mainNavItems.map(({ segment, icon: Icon }) => (
          <Link
            key={segment}
            href={`/${locale}/${segment}`}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-small font-medium transition-colors",
              isActive(segment)
                ? "bg-app-nav-item text-app-nav-text shadow-sm"
                : "bg-app-nav-item text-app-nav-text opacity-80 hover:opacity-100"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {LABELS[segment]}
          </Link>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-5">
        <Link
          href={`/${locale}/settings`}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-small font-medium transition-colors",
            isActive('settings')
              ? "bg-app-nav-item text-app-nav-text shadow-sm"
              : "bg-app-nav-item text-app-nav-text opacity-80 hover:opacity-100"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {LABELS.settings}
        </Link>
      </div>
    </aside>
  );
}
