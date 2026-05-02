"use client";

// Floating cancel button visible only during an active modelling session.
// Sits in the top-right corner above the backdrop and annotation, below
// toasts/modals. Either party (instructor or student) can use it to bail.
//
// Mounted in AppProviders alongside ModellingBackdrop / ModellingAnnotation.

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useModellingSession } from '@/app/contexts/ModellingSessionContext';

const EXIT_BUTTON_Z_INDEX = 96;

export function ModellingExitButton() {
  const { isActive, cancelSession } = useModellingSession();
  const t = useTranslations('modelling.exit');

  if (!isActive) return null;

  return (
    <button
      type="button"
      onClick={() => cancelSession()}
      aria-label={t('ariaLabel')}
      className="fixed top-4 right-4 flex items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
      style={{
        zIndex: EXIT_BUTTON_Z_INDEX,
        width: 48,
        height: 48,
        background: 'var(--theme-warning)',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <X size={24} strokeWidth={3} />
    </button>
  );
}
