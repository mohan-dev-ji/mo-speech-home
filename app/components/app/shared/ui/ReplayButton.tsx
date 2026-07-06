"use client";
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';

// The replay control shared by both fullscreen play modals — re-runs playback.
// Brand-primary pill with the rotate icon and the localised "replay" label.
// Stops propagation so a tap doesn't fall through to the backdrop (which closes).
export function ReplayButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('talker');
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center gap-2 rounded-theme-sm px-5 py-3 text-body font-semibold"
      style={{ background: 'var(--theme-brand-primary)', color: '#fff' }}
    >
      <RotateCcw className="w-5 h-5" /> {t('replay')}
    </button>
  );
}
