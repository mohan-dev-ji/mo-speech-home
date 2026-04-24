import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { SentencesModeContent } from '@/app/components/app/sentences/sections/SentencesModeContent';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SentencesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <SentencesModeContent />
    </Suspense>
  );
}
