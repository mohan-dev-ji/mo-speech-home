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

  return (
    <AppProviders>
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
