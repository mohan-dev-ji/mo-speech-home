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
        <Sidebar locale={locale} />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <PersistentTalker />
          {/* Inline style: bg-theme-* utilities rely on @config var() parsing which can be
              unreliable in Tailwind v4. Direct CSS var reference is always safe. */}
          <main className="flex-1 overflow-auto" style={{ background: 'var(--theme-background)' }}>
            {children}
          </main>
        </div>
      </div>
    </AppProviders>
  );
}
