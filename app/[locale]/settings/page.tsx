import { setRequestLocale } from 'next-intl/server';
import { DevTestPanel } from './DevTestPanel';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="p-theme-general flex flex-col gap-theme-modal-gap">
      <p className="text-theme-secondary-text text-theme-s">Settings — Phase 7</p>
      <DevTestPanel currentLocale={locale} />
    </div>
  );
}
