import { setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="p-6">
      <p className="text-muted-foreground text-small">Settings — Phase 7</p>
    </div>
  );
}
