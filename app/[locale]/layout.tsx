import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Noto_Sans } from 'next/font/google';
import { Noto_Sans_Devanagari } from 'next/font/google';
import { routing } from '@/i18n/routing';

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

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  // Apply Devanagari variable only for Hindi — avoids loading the font for English users.
  // Variables are inherited by both (app) and (public) sub-shells.
  const fontClasses = locale === 'hi'
    ? `${notoSans.variable} ${notoSansDevanagari.variable}`
    : notoSans.variable;

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className={fontClasses}>{children}</div>
    </NextIntlClientProvider>
  );
}
