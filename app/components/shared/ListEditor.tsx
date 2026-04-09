"use client";

// Inline editor for a symbol list within a category (Lists mode).
// Items are ordered; the instructor can add, reorder, and remove symbols.
// All props/callbacks only — no context dependency.
// Phase 3: connect to profileSymbols + categoryListItems Convex mutations.

import { GripVertical, Plus, Trash2 } from 'lucide-react';

export type ListItem = {
  id: string;
  symbolId: string;
  imagePath?: string;
  label: string;
  position: number;
};

type ListEditorProps = {
  items: ListItem[];
  isLoading?: boolean;
  onAddSymbol: () => void;          // opens symbol picker
  onRemoveItem: (id: string) => void;
  onReorder: (ids: string[]) => void;
};

export function ListEditor({
  items,
  isLoading = false,
  onAddSymbol,
  onRemoveItem,
}: ListEditorProps) {
  return (
    <div className="flex flex-col gap-1 p-3">
      {isLoading && (
        <div className="flex justify-center py-8">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--theme-brand-primary)' }}
          />
        </div>
      )}

      {!isLoading && items.map((item) => (
        <div
          key={item.id}
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

          {/* Thumbnail */}
          <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ background: 'var(--theme-symbol-card-bg)' }}
          >
            {item.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imagePath}
                alt={item.label}
                className="w-full h-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="w-6 h-6 rounded bg-black/10" />
            )}
          </div>

          {/* Label */}
          <span
            className="flex-1 text-small font-medium truncate"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {item.label}
          </span>

          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemoveItem(item.id)}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: 'var(--theme-error)' }}
            aria-label={`Remove ${item.label}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {!isLoading && (
        <button
          type="button"
          onClick={onAddSymbol}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors mt-1"
          style={{
            background: 'rgba(0,0,0,0.05)',
            color: 'var(--theme-brand-primary)',
            border: `1.5px dashed var(--theme-brand-primary)`,
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-small font-medium">Add symbol</span>
        </button>
      )}
    </div>
  );
}
