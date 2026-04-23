"use client";

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';

export function QuickSettings() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations('quickSettings');
  const { stateFlags, setTalkerVisible } = useProfile();
  const { talkerMode, setTalkerMode } = useTalker();

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

  const directPlayOn = talkerMode === 'banner';

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
              aria-checked={directPlayOn}
              aria-label={t('modeToggleLabel')}
              disabled={!stateFlags.talker_visible}
              onClick={() => setTalkerMode(directPlayOn ? 'talker' : 'banner')}
              className="relative w-10 h-6 rounded-full shrink-0 transition-colors duration-200 disabled:cursor-not-allowed"
              style={{
                background: directPlayOn
                  ? 'var(--theme-success)'
                  : 'rgba(0,0,0,0.25)',
              }}
            >
              <span
                className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                style={{
                  transform: directPlayOn
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
