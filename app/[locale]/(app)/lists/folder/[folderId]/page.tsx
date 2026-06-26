import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ListsModeContent } from '@/app/components/app/lists/sections/ListsModeContent';

type Props = {
  // `folderId` is a profileFolders id, or the reserved sentinel "ungrouped"
  // for lists not yet sorted into a group (ADR-014 §2).
  params: Promise<{ locale: string; folderId: string }>;
};

export default async function ListFolderPage({ params }: Props) {
  const { locale, folderId } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <ListsModeContent folderId={folderId} />
    </Suspense>
  );
}
