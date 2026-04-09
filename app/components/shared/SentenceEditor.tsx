"use client";

// Editor for a saved sentence (Sentences mode).
// A sentence is an ordered sequence of symbol slots — same model as TalkerBar output.
// The instructor builds/edits the sequence and saves it as a named sentence.
// All props/callbacks only — no context dependency.
// Phase 3: connect to profileSentences Convex table.

import { GripVertical, Plus, Trash2, Volume2 } from 'lucide-react';

export type SentenceSymbolSlot = {
  instanceId: string;
  symbolId: string;
  imagePath?: string;
  label: string;
};

type SentenceEditorProps = {
  name: string;
  slots: SentenceSymbolSlot[];
  onNameChange: (name: string) => void;
  onAddSlot: () => void;             // opens symbol picker
  onRemoveSlot: (instanceId: string) => void;
  onReorder: (instanceIds: string[]) => void;
  onPlayPreview: () => void;
  onSave: () => void;
  isSaving?: boolean;
};

export function SentenceEditor({
  name,
  slots,
  onNameChange,
  onAddSlot,
  onRemoveSlot,
  onPlayPreview,
  onSave,
  isSaving = false,
}: SentenceEditorProps) {
  const canSave = name.trim().length > 0 && slots.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Sentence name */}
      <div className="flex flex-col gap-1.5">
        <label
          className="text-caption font-medium"
          style={{ color: 'var(--theme-text-secondary)' }}
        >
          Sentence name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. I want to go outside"
          className="w-full rounded-xl px-4 py-2.5 text-small outline-none"
          style={{
            background: 'var(--theme-bg-surface)',
            color: 'var(--theme-text-primary)',
            border: `1.5px solid var(--theme-bg-surface-alt)`,
          }}
        />
      </div>

      {/* Symbol sequence */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className="text-caption font-medium"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            Symbols
          </span>
          {slots.length > 0 && (
            <button
              type="button"
              onClick={onPlayPreview}
              className="flex items-center gap-1.5 text-caption"
              style={{ color: 'var(--theme-brand-primary)' }}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Preview
            </button>
          )}
        </div>

        {slots.map((slot) => (
          <div
            key={slot.instanceId}
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{ background: 'var(--theme-bg-surface)' }}
          >
            {/* Drag handle — Phase 3: wire to drag-and-drop library */}
            <span
              className="cursor-grab active:cursor-grabbing touch-none shrink-0"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              <GripVertical className="w-4 h-4" />
            </span>

            <div
              className="w-10 h-10 shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
              style={{ background: 'var(--theme-symbol-card-bg)' }}
            >
              {slot.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slot.imagePath}
                  alt={slot.label}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-6 h-6 rounded bg-black/10" />
              )}
            </div>

            <span
              className="flex-1 text-small font-medium truncate"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {slot.label}
            </span>

            <button
              type="button"
              onClick={() => onRemoveSlot(slot.instanceId)}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ color: 'var(--theme-error)' }}
              aria-label={`Remove ${slot.label}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddSlot}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 mt-1"
          style={{
            background: 'rgba(0,0,0,0.05)',
            color: 'var(--theme-brand-primary)',
            border: `1.5px dashed var(--theme-brand-primary)`,
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-small font-medium">Add symbol</span>
        </button>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || isSaving}
        className="w-full py-3 rounded-xl text-small font-semibold transition-opacity mt-2"
        style={{
          background: 'var(--theme-brand-primary)',
          color: 'var(--theme-text-on-brand)',
          opacity: canSave && !isSaving ? 1 : 0.4,
        }}
      >
        {isSaving ? 'Saving…' : 'Save Sentence'}
      </button>
    </div>
  );
}
