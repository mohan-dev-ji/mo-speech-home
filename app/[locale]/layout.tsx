import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Gurmukhi } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { getLanguage } from '@/lib/languages/registry';

// next/font loaders MUST be called at module level. Each language module's
// `font` field (in convex/data/languages/<code>.json) names one of these
// loader ids — keeping the JSON declarative while satisfying next/font's
// build-time requirement.
//
// notoSans's Latin subset is always loaded (English/transliteration chars
// appear in every locale). Script-specific fonts are layered on top via
// the FONT_VARIABLES map below — only the active locale's font is included
// in the className, so other scripts don't ship to the client.

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

const notoSansGurmukhi = Noto_Sans_Gurmukhi({
  subsets: ['gurmukhi'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-gurmukhi',
  display: 'swap',
});

/**
 * Map from `LangModule.font` loader id → CSS variable class.
 *
 * Adding a new script (e.g. Korean Hangul, Arabic) means:
 *   1. Import the loader from next/font/google and declare it above
 *   2. Add an entry here
 *   3. Reference the loader id from the language JSON's `font` field
 */
const FONT_VARIABLES: Record<string, string> = {
  notoSans: notoSans.variable,
  notoSansDevanagari: notoSansDevanagari.variable,
  notoSansGurmukhi: notoSansGurmukhi.variable,
};

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

  // Always include notoSans (Latin). Layer on the locale's script-specific
  // font from the registry — only that script gets loaded for the user.
  const lang = getLanguage(locale);
  const scriptVariable = lang ? FONT_VARIABLES[lang.font] : undefined;
  const fontClasses = scriptVariable && scriptVariable !== notoSans.variable
    ? `${notoSans.variable} ${scriptVariable}`
    : notoSans.variable;

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className={fontClasses}>{children}</div>
    </NextIntlClientProvider>
  );
}
