import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Noto_Sans } from 'next/font/google';
import { Noto_Sans_Devanagari } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { AppProviders } from './components/AppProviders';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';

// Load per locale — not all at once.
// notoSans is always loaded (Latin chars appear in Hindi UI too).
// notoSansDevanagari is applied only when locale = 'hi'.
const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-devanagari',
  display: 'swap',
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  // Apply Devanagari variable only for Hindi — avoids loading the font for English users
  const fontClasses = locale === 'hi'
    ? `${notoSans.variable} ${notoSansDevanagari.variable}`
    : notoSans.variable;

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <AppProviders>
        {/* data-locale drives font switching in globals.css — no flash, server-rendered */}
        <div
          className={`flex h-screen overflow-hidden ${fontClasses}`}
          data-locale={locale}
        >
          <Sidebar locale={locale} />
          <div className="flex flex-1 flex-col min-w-0">
            <TopBar />
            <main className="flex-1 overflow-auto bg-background">
              {children}
            </main>
          </div>
        </div>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
