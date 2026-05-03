import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { CategoriesContent } from '@/app/components/app/categories/sections/CategoriesContent';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CategoriesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <CategoriesContent />
    </Suspense>
  );
}
