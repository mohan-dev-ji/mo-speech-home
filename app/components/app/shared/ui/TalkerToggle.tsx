"use client";

import { useTranslations } from 'next-intl';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';

/**
 * Talker mode toggle — lifted out of QuickSettings into the TopBar (sits just
 * left of the quick-settings icon). Switches the board between 'talker'
 * (sentence builder / direct play) and 'banner' (banner/edit) mode. It's only
 * meaningful when the talker header is visible, so it dims + disables when
 * `talker_visible` is off — the same semantics it had inside the menu.
 */
export function TalkerToggle() {
  const t = useTranslations('quickSettings');
  const { stateFlags } = useProfile();
  const { talkerMode, setTalkerMode } = useTalker();

  // Talker ON = sentence builder active; OFF = banner/edit mode
  const talkerActive = talkerMode === 'talker';
  const disabled = !stateFlags.talker_visible;

  return (
    <div
      className="flex items-center gap-2 transition-opacity"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <span
        className="text-small font-medium"
        style={{ color: 'var(--theme-secondary-alt-text)' }}
      >
        {t('modeToggle')}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={talkerActive}
        aria-label={t('modeToggleLabel')}
        disabled={disabled}
        onClick={() => setTalkerMode(talkerActive ? 'banner' : 'talker')}
        className="relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200 disabled:cursor-not-allowed"
        style={{
          background: talkerActive ? 'var(--theme-success)' : 'rgba(0,0,0,0.25)',
        }}
      >
        <span
          className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
          style={{ transform: talkerActive ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}
