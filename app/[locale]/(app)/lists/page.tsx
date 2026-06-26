import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ListsGroupsView } from '@/app/components/app/lists/sections/ListsGroupsView';

type Props = {
  params: Promise<{ locale: string }>;
};

// ADR-014 — the Lists tree root now shows List Groups (folders). A group's lists
// live at /lists/folder/[folderId]; a list's detail at /lists/[listId].
export default async function ListsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <ListsGroupsView />
    </Suspense>
  );
}
