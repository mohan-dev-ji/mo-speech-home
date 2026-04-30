"use client";

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTheme, THEME_TOKENS, type ThemeSlug } from '@/app/contexts/ThemeContext';
import { cn } from '@/lib/utils';

// ─── DEV ONLY — remove before production ──────────────────────────────────────
// Quick theme + locale switchers for visual testing during build.
// Theme switching calls ThemeContext directly (no Convex round-trip).
// Locale switching navigates to the same route in the target locale.
// ──────────────────────────────────────────────────────────────────────────────

const THEMES: { slug: ThemeSlug; label: string; swatch: string }[] = [
  { slug: 'default',  label: 'Default',  swatch: '#62748E' },
  { slug: 'sky',      label: 'Sky',      swatch: '#00A6F4' },
  { slug: 'amber',    label: 'Amber',    swatch: '#E17100' },
  { slug: 'fuchsia',  label: 'Fuchsia',  swatch: '#E12AFB' },
  { slug: 'lime',     label: 'Lime',     swatch: '#5EA500' },
  { slug: 'rose',     label: 'Rose',     swatch: '#FF2056' },
];

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

export function DevTestPanel({ currentLocale }: { currentLocale: string }) {
  const { activeThemeId, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const migrate = useMutation(api.migrations.migrateContentToAccount);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);

  async function handleMigrate() {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const result = await migrate({});
      setMigrateResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setMigrateResult(e instanceof Error ? e.message : String(e));
    } finally {
      setMigrating(false);
    }
  }

  return (
    <section className="rounded-theme-sm border-2 border-dashed border-theme-enter-mode p-theme-modal">

      {/* Header */}
      <div className="flex items-center gap-2 mb-theme-modal-gap">
        <span className="text-theme-enter-mode text-theme-s font-semibold tracking-widest uppercase">
          Dev
        </span>
        <span className="text-theme-secondary-text text-theme-s">
          — remove before production
        </span>
      </div>

      {/* Theme switcher */}
      <div className="mb-theme-modal-gap">
        <p className="text-theme-text text-theme-s font-semibold mb-2">Themes</p>
        <div className="flex flex-wrap gap-theme-elements">
          {THEMES.map(({ slug, label, swatch }) => {
            const active = activeThemeId === slug || (!activeThemeId && slug === 'default');
            return (
              <button
                key={slug}
                onClick={() => setTheme(slug, THEME_TOKENS[slug])}
                className={cn(
                  'flex items-center gap-2 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium transition-colors',
                  active
                    ? 'bg-theme-button-highlight text-theme-text'
                    : 'bg-theme-primary text-theme-alt-text hover:opacity-90'
                )}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: swatch }}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content migration — one-shot */}
      <div className="mb-theme-modal-gap">
        <p className="text-theme-text text-theme-s font-semibold mb-2">Content migration</p>
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium bg-theme-primary text-theme-alt-text hover:opacity-90 disabled:opacity-50"
        >
          {migrating ? 'Migrating…' : 'Backfill accountId on content (recover orphans)'}
        </button>
        {migrateResult && (
          <pre className="mt-2 p-2 rounded-theme-sm bg-theme-alt-card text-theme-s overflow-auto whitespace-pre-wrap" style={{ maxHeight: 200 }}>
            {migrateResult}
          </pre>
        )}
      </div>

      {/* Locale switcher */}
      <div>
        <p className="text-theme-text text-theme-s font-semibold mb-2">Language</p>
        <div className="flex gap-theme-elements">
          {LOCALES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => router.replace(pathname, { locale: code })}
              className={cn(
                'px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium transition-colors',
                currentLocale === code
                  ? 'bg-theme-button-highlight text-theme-text'
                  : 'bg-theme-primary text-theme-alt-text hover:opacity-90'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

    </section>
  );
}
