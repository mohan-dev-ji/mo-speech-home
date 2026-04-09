"use client";

// Editor panel for a First-Then board.
// Two slots: "First" and "Then". Each slot holds one symbol.
// The instructor taps a slot to open the symbol picker.
// All props/callbacks only — no context dependency.
// Phase 3: connect to firstThenBoards Convex table.

import { ArrowRight, Plus } from 'lucide-react';

export type FirstThenSlot = {
  symbolId: string;
  imagePath?: string;
  label: string;
} | null;

type FirstThenEditorProps = {
  firstSlot: FirstThenSlot;
  thenSlot: FirstThenSlot;
  onSelectFirst: () => void;    // opens symbol picker for First slot
  onSelectThen: () => void;     // opens symbol picker for Then slot
  onClearFirst: () => void;
  onClearThen: () => void;
  onSave: () => void;
  isSaving?: boolean;
};

function Slot({
  slot,
  label,
  onSelect,
  onClear,
}: {
  slot: FirstThenSlot;
  label: string;
  onSelect: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <span
        className="text-caption font-semibold uppercase tracking-wide"
        style={{ color: 'var(--theme-text-secondary)' }}
      >
        {label}
      </span>

      {slot ? (
        <button
          type="button"
          onClick={onClear}
          className="w-full aspect-square rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
          style={{ background: 'var(--theme-symbol-card-bg)' }}
          aria-label={`Clear ${label} symbol (${slot.label})`}
        >
          {slot.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slot.imagePath}
              alt={slot.label}
              className="w-3/4 aspect-square object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-1/2 aspect-square rounded-lg bg-black/10" />
          )}
          <span
            className="text-caption font-medium truncate px-2"
            style={{ color: 'var(--theme-symbol-card-text)' }}
          >
            {slot.label}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
          style={{
            background: 'var(--theme-bg-surface)',
            border: `2px dashed var(--theme-brand-primary)`,
            color: 'var(--theme-brand-primary)',
          }}
          aria-label={`Select ${label} symbol`}
        >
          <Plus className="w-6 h-6" />
          <span className="text-caption font-medium">Tap to choose</span>
        </button>
      )}
    </div>
  );
}

export function FirstThenEditor({
  firstSlot,
  thenSlot,
  onSelectFirst,
  onSelectThen,
  onClearFirst,
  onClearThen,
  onSave,
  isSaving = false,
}: FirstThenEditorProps) {
  const canSave = firstSlot !== null && thenSlot !== null;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Slots */}
      <div className="flex items-center gap-4">
        <Slot slot={firstSlot} label="First" onSelect={onSelectFirst} onClear={onClearFirst} />

        <div
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-text-on-brand)' }}
          aria-hidden
        >
          <ArrowRight className="w-4 h-4" />
        </div>

        <Slot slot={thenSlot} label="Then" onSelect={onSelectThen} onClear={onClearThen} />
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || isSaving}
        className="w-full py-3 rounded-xl text-small font-semibold transition-opacity"
        style={{
          background: 'var(--theme-brand-primary)',
          color: 'var(--theme-text-on-brand)',
          opacity: canSave && !isSaving ? 1 : 0.4,
        }}
      >
        {isSaving ? 'Saving…' : 'Save Board'}
      </button>
    </div>
  );
}
