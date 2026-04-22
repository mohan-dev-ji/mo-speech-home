import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ListDetailContent } from '@/app/components/app/lists/sections/ListDetailContent';
import type { Id } from '@/convex/_generated/dataModel';

type Props = {
  params: Promise<{ locale: string; listId: string }>;
};

export default async function ListDetailPage({ params }: Props) {
  const { locale, listId } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <ListDetailContent listId={listId as Id<'profileLists'>} />
    </Suspense>
  );
}
