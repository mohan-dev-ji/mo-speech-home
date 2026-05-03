import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ListsModeContent } from '@/app/components/app/lists/sections/ListsModeContent';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ListsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <ListsModeContent />
    </Suspense>
  );
}
