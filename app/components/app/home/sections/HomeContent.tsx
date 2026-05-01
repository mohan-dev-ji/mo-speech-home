"use client";

import { useTranslations } from 'next-intl';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';

export function HomeContent() {
  const t = useTranslations('home');
  const { stateFlags } = useProfile();
  const { talkerMode } = useTalker();

  return (
    <div className="p-theme-mobile-general md:p-theme-general flex flex-col gap-theme-mobile-gap md:gap-theme-gap">

      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')} />
        </div>
      )}

      <p className="text-small" style={{ color: 'var(--theme-secondary-alt-text)' }}>
        Home — Phase 5
      </p>
    </div>
  );
}
