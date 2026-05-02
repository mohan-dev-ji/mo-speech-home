"use client";

// Floating step counter visible during an active modelling session.
// Shows on every device subscribed to the session (instructor view, student
// view, any collaborator window) — Convex pushes the same currentStep to all
// of them, so the dots stay in sync as the student taps through.
//
// Mounted in AppProviders alongside ModellingBackdrop / ModellingAnnotation.
// Z-index 96 — same tier as the exit button, above the backdrop and target.

import { useTranslations } from 'next-intl';
import { useModellingSession } from '@/app/contexts/ModellingSessionContext';

const PROGRESS_Z_INDEX = 96;

export function ModellingProgressIndicator() {
  const { activeSession, isActive, currentStep } = useModellingSession();
  const t = useTranslations('modelling.progress');

  if (!isActive || !activeSession) return null;

  const total = activeSession.steps.length;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 px-4 py-2 rounded-theme bg-theme-symbol-bg shadow-lg"
      style={{
        zIndex: PROGRESS_Z_INDEX,
        border: '2px solid var(--theme-brand-primary)',
      }}
    >
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => {
          const isCurrent = i === currentStep;
          const isComplete = i < currentStep;
          const size = isCurrent ? 14 : 10;
          return (
            <span
              key={i}
              aria-hidden
              className="rounded-full transition-all"
              style={{
                width: size,
                height: size,
                background:
                  isCurrent || isComplete
                    ? 'var(--theme-brand-primary)'
                    : 'transparent',
                border: '2px solid var(--theme-brand-primary)',
              }}
            />
          );
        })}
      </div>
      <span className="text-theme-xs font-semibold text-theme-text">
        {t('stepCounter', { current: currentStep + 1, total })}
      </span>
    </div>
  );
}
