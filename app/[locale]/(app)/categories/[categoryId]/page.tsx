import { setRequestLocale } from 'next-intl/server';
import { CategoryDetailContent } from '@/app/components/app/categories/sections/CategoryDetailContent';

type Props = {
  params: Promise<{ locale: string; categoryId: string }>;
};

export default async function CategoryDetailPage({ params }: Props) {
  const { locale, categoryId } = await params;
  setRequestLocale(locale);

  return <CategoryDetailContent categoryId={categoryId} />;
}
