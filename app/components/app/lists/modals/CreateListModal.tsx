"use client";

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/app/shared/ui/Dialog';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, steps: string[]) => Promise<void>;
};

const INITIAL_STEPS = ['', '', '', ''];

export function CreateListModal({ isOpen, onClose, onCreate }: Props) {
  const t = useTranslations('lists');
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<string[]>(INITIAL_STEPS);
  const [isCreating, setIsCreating] = useState(false);

  // Per-step input refs so we can focus the newly-added field after addStep.
  const stepInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const prevStepsLengthRef = useRef(steps.length);

  // When the steps array grows (i.e. the user clicked "Add steps"), focus
  // the new last input. Shrinks (reset on close, submit) are ignored.
  useEffect(() => {
    if (steps.length > prevStepsLengthRef.current) {
      stepInputRefs.current[steps.length - 1]?.focus();
    }
    prevStepsLengthRef.current = steps.length;
  }, [steps.length]);

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, '']);
  }

  function reset() {
    setName('');
    setSteps(INITIAL_STEPS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      await onCreate(trimmed, steps);
      reset();
      onClose();
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset();
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createModalTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* List name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
              {t('createModalNameLabel')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createModalNamePlaceholder')}
              autoFocus
              className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
              style={{
                background: 'var(--theme-symbol-bg)',
                color: 'var(--theme-text)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-2">
            <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
              {t('createModalListLabel')}
            </label>

            <div className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-theme-sm shrink-0 flex items-center justify-center text-theme-s font-bold"
                    style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
                  >
                    {i + 1}
                  </div>
                  <input
                    ref={(el) => { stepInputRefs.current[i] = el; }}
                    type="text"
                    value={step}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder={t('createModalStepPlaceholder')}
                    className="flex-1 px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStep}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80 mt-1"
              style={{
                background: 'var(--theme-primary)',
                color: 'var(--theme-alt-text)',
                border: 'none',
              }}
            >
              <Plus className="w-4 h-4" />
              {t('createModalAddSteps')}
            </button>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="py-3 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
            >
              {t('createModalCancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="py-3 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {isCreating ? t('creating') : t('createModalCreate')}
            </button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
