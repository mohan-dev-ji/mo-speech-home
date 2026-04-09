import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="p-6">
      <p className="text-muted-foreground text-small">Search — Phase 2</p>
    </div>
  );
}
