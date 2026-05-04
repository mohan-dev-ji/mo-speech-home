"use client";

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useClerk } from '@clerk/nextjs';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';

export function QuickSettings() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations('quickSettings');
  const { stateFlags, setTalkerVisible } = useProfile();
  const { talkerMode, setTalkerMode } = useTalker();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Talker ON = sentence builder active; OFF = banner/edit mode
  const talkerActive = talkerMode === 'talker';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-theme-sm transition-colors"
        style={{
          color: 'var(--theme-secondary-alt-text)',
          background: open ? 'rgba(255,255,255,0.12)' : 'transparent',
        }}
        aria-label={t('label')}
        aria-expanded={open}
      >
        <SlidersHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-52 rounded-theme-sm shadow-lg"
          style={{
            background: 'var(--theme-card)',
            border: '1px solid var(--theme-line)',
            zIndex: 80,
          }}
        >
          <div
            className="px-3 py-2 text-small font-semibold"
            style={{
              color: 'var(--theme-secondary-alt-text)',
              borderBottom: '1px solid var(--theme-line)',
            }}
          >
            {t('label')}
          </div>

          {/* Header on/off — master toggle */}
          <div className="px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="text-small font-medium" style={{ color: 'var(--theme-alt-text)' }}>
              {t('headerToggle')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={stateFlags.talker_visible}
              aria-label={t('headerToggleLabel')}
              onClick={() => setTalkerVisible(!stateFlags.talker_visible)}
              className="relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200"
              style={{
                background: stateFlags.talker_visible
                  ? 'var(--theme-success)'
                  : 'rgba(0,0,0,0.25)',
              }}
            >
              <span
                className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                style={{
                  transform: stateFlags.talker_visible
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          {/* Direct play mode — only active when header is on */}
          <div
            className="px-3 py-2.5 flex items-center justify-between gap-3 transition-opacity"
            style={{ opacity: stateFlags.talker_visible ? 1 : 0.35 }}
          >
            <span className="text-small font-medium" style={{ color: 'var(--theme-alt-text)' }}>
              {t('modeToggle')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={talkerActive}
              aria-label={t('modeToggleLabel')}
              disabled={!stateFlags.talker_visible}
              onClick={() => setTalkerMode(talkerActive ? 'banner' : 'talker')}
              className="relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200 disabled:cursor-not-allowed"
              style={{
                background: talkerActive
                  ? 'var(--theme-success)'
                  : 'rgba(0,0,0,0.25)',
              }}
            >
              <span
                className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                style={{
                  transform: talkerActive
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          {/* Sign out — hard-navigates to `/` after Clerk clears the session.
              We can't use signOut({ redirectUrl: '/' }) here: that does a
              client-side router.push which keeps the AAC React tree mounted
              while auth flips to false. The tree's Convex queries and auth-
              dependent contexts then break mid-render before the redirect
              fires. window.location.assign discards the tree entirely so the
              next navigation starts cold. The splash dispatcher then reads
              the user's NEXT_LOCALE cookie and sends them to /<locale>/. */}
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
              window.location.assign('/');
            }}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-theme-banner"
            style={{
              borderTop: '1px solid var(--theme-line)',
              color: 'var(--theme-alt-text)',
            }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="text-small font-medium">{t('signOut')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
