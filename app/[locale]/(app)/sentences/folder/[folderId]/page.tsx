import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { SentencesModeContent } from '@/app/components/app/sentences/sections/SentencesModeContent';

type Props = {
  // `folderId` is a profileFolders id, or the reserved sentinel "ungrouped"
  // for sentences not yet sorted into a group (ADR-014 §2).
  params: Promise<{ locale: string; folderId: string }>;
};

export default async function SentenceFolderPage({ params }: Props) {
  const { locale, folderId } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <SentencesModeContent folderId={folderId} />
    </Suspense>
  );
}
