"use client";

import { Trash2, Pencil, Move } from 'lucide-react';
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
    <div className="relative w-full aspect-square">

      {/* Orange dashed edit-mode border */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <rect
          x="2" y="2" rx="16" ry="16"
          style={{
            width: 'calc(100% - 4px)',
            height: 'calc(100% - 4px)',
            fill: 'none',
            stroke: 'var(--theme-enter-mode)',
            strokeWidth: 4,
            strokeDasharray: '12 6',
          }}
        />
      </svg>

      {/* Inner layout: card above, action strip below */}
      <div className="absolute inset-2 flex flex-col gap-1">

        {/* Card — square, sized to the height available above the action strip */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="h-full aspect-square max-w-full">
            <SymbolCard
              symbolId="edit-mode"
              imagePath={imagePath}
              label={label}
              language="eng"
              display={display}
              categoryColour={categoryColour}
              onTap={() => {}}
            />
          </div>
        </div>

        {/* Action strip */}
        <div
          className="shrink-0 flex items-center justify-center gap-3 py-1 rounded-lg"
          
        >
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded transition-colors hover:bg-red-100"
            style={{ color: 'var(--theme-warning)' }}
            aria-label={t('symbolDelete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1 rounded transition-colors hover:bg-black/10"
            style={{ color: 'var(--theme-alt-text)' }}
            aria-label={t('symbolEdit')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded transition-colors hover:bg-black/10 cursor-grab active:cursor-grabbing touch-none"
            style={{ color: 'var(--theme-alt-text)' }}
            aria-label={t('symbolMove')}
            {...dragHandleListeners}
            {...dragHandleAttributes}
          >
            <Move className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
