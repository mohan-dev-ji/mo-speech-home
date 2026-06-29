import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { SentencesGroupsView } from '@/app/components/app/sentences/sections/SentencesGroupsView';

type Props = {
  params: Promise<{ locale: string }>;
};

// ADR-014 — the Sentences tree root now shows Sentence Groups (folders). A
// group's sentences live at /sentences/folder/[folderId].
export default async function SentencesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <SentencesGroupsView />
    </Suspense>
  );
}
