"use client";

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { SymbolCard, type SymbolDisplay } from '@/app/components/app/shared/ui/SymbolCard';

type Props = {
  imagePath?: string;
  label: string;
  display?: SymbolDisplay;
  categoryColour?: string;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleListeners?: SyntheticListenerMap;
  dragHandleAttributes?: DraggableAttributes;
};

// Editable symbol card — mirrors the talker dropdown's core-word SlotCell
// (TalkerDropdown.tsx). The symbol keeps its full square footprint: a dashed
// edit-mode border, the WHOLE card is the drag handle (grab cursor), TAP opens
// the symbol editor (8px drag-activation on the parent sensor lets a clean tap
// through), and a corner ✕ badge deletes. No below-symbol edit panel.
export function SymbolCardEditable({
  imagePath,
  label,
  display,
  categoryColour,
  onEdit,
  onDelete,
  dragHandleListeners,
  dragHandleAttributes,
}: Props) {
  const t = useTranslations('categoryDetail');

  return (
    <div
      className="relative w-full aspect-square @container rounded-theme-card"
      style={{ border: '2px dashed var(--theme-enter-mode)' }}
    >
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        {...dragHandleListeners}
        {...dragHandleAttributes}
      >
        <SymbolCard
          symbolId="edit-mode"
          imagePath={imagePath}
          label={label}
          language="en"
          display={display}
          categoryColour={categoryColour}
          onTap={onEdit}
        />
      </div>

      {/* Corner ✕ delete — stops propagation so it never starts a drag. */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={t('symbolDelete')}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow z-10"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
