import { cookies } from 'next/headers';
import { AppProviders } from '@/app/components/app/shared/sections/AppProviders';
import { Sidebar } from '@/app/components/app/shared/sections/Sidebar';
import { TopBar } from '@/app/components/app/shared/sections/TopBar';
import { PersistentTalker } from '@/app/components/app/shared/sections/PersistentTalker';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AppShellLayout({ children, params }: Props) {
  const { locale } = await params;

  // First-paint seed for talker-vs-banner mode (written by ProfileContext once
  // the Convex stateFlags resolve). Reading it server-side lets SSR render the
  // user's last-seen mode, so a refresh doesn't flash the default talker bar
  // before the query lands. Convex stays authoritative once it resolves.
  const cookieStore = await cookies();
  const initialHeaderInBannerMode =
    cookieStore.get('mo-header-mode')?.value === 'banner';

  return (
    <AppProviders initialHeaderInBannerMode={initialHeaderInBannerMode}>
      {/* data-locale drives font switching in globals.css — theme tokens are scoped here.
          dark class ensures template UI components (Card, Button, Dialog) use dark variants. */}
      <div
        className="dark flex h-screen overflow-hidden"
        data-locale={locale}
      >
        {/* Fixed full-bleed background + texture layers (ADR-011 §2.1). Behind
            all content; flat themes paint --theme-background here so the shell
            looks unchanged. Premium themes paint a gradient + procedural grain.
            aria-hidden — purely decorative. */}
        <div className="theme-bg-layer" aria-hidden />
        <div className="theme-texture-layer" aria-hidden />
        <Sidebar locale={locale} />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <PersistentTalker />
          {/* Transparent so the fixed background layer shows through as content
              scrolls (the layer paints --theme-background for flat themes). */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AppProviders>
  );
}
