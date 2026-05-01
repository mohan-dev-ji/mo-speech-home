"use client";

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import { DeleteAccountDialog } from '@/app/components/app/settings/modals/DeleteAccountDialog';

// ─── DEV ONLY — remove before production ──────────────────────────────────────

export function DevTestPanel({ currentLocale: _currentLocale }: { currentLocale: string }) {
  const migrate = useMutation(api.migrations.migrateContentToAccount);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tDelete = useTranslations('settings.deleteAccount');

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

      {/* Content migration — one-shot */}
      <div>
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

      {/* Danger zone */}
      <div className="mt-theme-modal-gap pt-theme-modal-gap border-t border-theme-line">
        <p className="text-theme-text text-theme-s font-semibold mb-2">
          {tDelete('sectionTitle')}
        </p>
        <button
          onClick={() => setDeleteOpen(true)}
          className="px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-semibold bg-theme-warning text-white hover:opacity-90"
        >
          {tDelete('button')}
        </button>
      </div>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />

    </section>
  );
}
