"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Languages, List } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/app/shared/ui/Dialog';

/**
 * Generic translate mode-picker (Phase 15.5) for order-free labels — folder
 * names, list titles, list item descriptions. Shell mirrors `VariantAuthorModal`
 * (deliberately kept separate; that one still serves sentences/phrases). Options
 * are data-driven; the parent runs the chosen work and rejects on failure so the
 * modal can surface an error.
 */
export type TranslateOption = {
  mode: string;
  label: string;
  hint?: string;
  icon?: 'translate' | 'manual' | 'list';
  primary?: boolean;
};

export function TranslateChoiceModal({ isOpen, onClose, title, description, options, onChoose }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: TranslateOption[];
  onChoose: (mode: string) => Promise<void>;   // parent does the work; reject → error
}) {
  const t = useTranslations('translate');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function run(mode: string) {
    setBusy(mode); setError(false);
    try { await onChoose(mode); } catch { setError(true); setBusy(null); }
  }
  const Icon = { translate: Languages, manual: Pencil, list: List } as const;
  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {options.map((o) => {
            const I = Icon[o.icon ?? 'translate'];
            return (
              <button key={o.mode} type="button" onClick={() => run(o.mode)} disabled={!!busy}
                className="flex items-start gap-3 w-full text-left p-theme-item rounded-theme-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={o.primary ? { background: 'var(--theme-primary)', color: 'var(--theme-alt-text)' } : { background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}>
                <I className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-theme-s font-semibold">{busy === o.mode ? t('translating') : o.label}</span>
                  {o.hint && <span className="text-theme-xs opacity-90">{o.hint}</span>}
                </span>
              </button>
            );
          })}
          {error && <p className="text-theme-xs font-medium" style={{ color: 'var(--theme-warning)' }}>{t('error')}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
