"use client";

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, LogOut, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useClerk, useUser } from '@clerk/nextjs';
import { useProfile } from '@/app/contexts/ProfileContext';

export function QuickSettings() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations('quickSettings');
  const { stateFlags, setTalkerVisible, setGridSize, viewMode } = useProfile();
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

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
            background: 'var(--theme-surface)',
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

          {/* Grid size — viewMode-aware. Instructor / admin writes to the
              instructor's grid size; student-view writes to the active
              student profile (see ProfileContext.setGridSize). */}
          <div className="px-3 py-2.5 flex items-center justify-between gap-3">
            <span
              className="text-small font-medium"
              style={{ color: 'var(--theme-alt-text)' }}
            >
              {viewMode === 'student-view'
                ? t('gridSizeStudent')
                : t('gridSizeInstructor')}
            </span>
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-theme-sm"
              style={{ background: 'rgba(0,0,0,0.25)' }}
              role="radiogroup"
              aria-label={t('gridSizeLabel')}
            >
              {(['large', 'medium', 'small'] as const).map((size) => {
                const active = stateFlags.grid_size === size;
                const letter = size === 'large' ? 'L' : size === 'medium' ? 'M' : 'S';
                return (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setGridSize(size)}
                    className="px-2 py-0.5 rounded-theme-sm text-caption font-semibold transition-colors"
                    style={
                      active
                        ? {
                            background: 'var(--theme-button-highlight)',
                            color: 'var(--theme-text)',
                          }
                        : {
                            background: 'transparent',
                            color: 'var(--theme-secondary-alt-text)',
                          }
                    }
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account email + Sign out, grouped under one divider so the email
              reads as "the account you're signed into" right above Sign out. */}
          <div style={{ borderTop: '1px solid var(--theme-line)' }}>
            {email && (
              <div
                className="w-full px-3 pt-2.5 pb-1 flex items-center gap-3"
                style={{ color: 'var(--theme-alt-text)' }}
                title={email}
              >
                <Mail className="w-4 h-4 shrink-0 opacity-60" />
                <span className="text-small font-medium truncate opacity-70">{email}</span>
              </div>
            )}
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
              style={{ color: 'var(--theme-alt-text)' }}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="text-small font-medium">{t('signOut')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
