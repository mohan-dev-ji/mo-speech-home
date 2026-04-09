"use client";

import { usePathname, useParams } from 'next/navigation';

const PAGE_LABELS: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  categories: 'Categories',
  settings: 'Settings',
};

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;

  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);
  const currentSegment = segments[0] ?? 'home';
  const pageLabel = PAGE_LABELS[currentSegment] ?? currentSegment;

  return (
    <header className="h-12 bg-app-topbar flex items-center px-5 gap-2 shrink-0">
      <span className="text-small font-medium bg-app-profile-badge-bg text-app-profile-badge-text px-2.5 py-1 rounded-md">
        Instructor
      </span>
      <span className="text-app-topbar-text-dim text-small">›</span>
      <span className="text-app-topbar-text text-small font-medium">{pageLabel}</span>
    </header>
  );
}
