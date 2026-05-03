import { setRequestLocale } from 'next-intl/server';
import { SearchContent } from '@/app/components/app/search/sections/SearchContent';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SearchContent />;
}
