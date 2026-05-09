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
    // Wrapper grows taller than the SymbolCard's square footprint to fit
    // the action row below — matches the CategoryTile edit-mode pattern so
    // the symbol image gets the full square space rather than being
    // squeezed to make room for the buttons. `@container` anchors the
    // cqi-based fluid sizing on the action buttons to the tile's width.
    <div className="relative w-full @container">

      {/* Orange dashed edit-mode border — wraps the whole wrapper */}
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

      {/* Inner layout: square card above, action strip below */}
      <div className="flex flex-col gap-2 p-3">

        {/* Card — full square footprint */}
        <div className="w-full aspect-square">
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

        {/* Action strip — sits BELOW the card, inside the dashed border.
            Gap, padding, and icon size scale with tile width via cqi:
            - Lower bound keeps the row inside the dashed border on small
              grid sizes (icons / padding / gap don't collapse below tap-
              target minimums).
            - Upper bound lets the icons scale up proportionally with the
              card on large tiles, so they look right at every grid size
              instead of staying tiny inside a big folder. */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ gap: 'clamp(0.25rem, 3cqi, 1rem)' }}
        >
          <button
            type="button"
            onClick={onDelete}
            className="rounded-theme-sm transition-colors hover:bg-white/10"
            style={{
              color: 'var(--theme-warning)',
              padding: 'clamp(0.125rem, 2cqi, 0.5rem)',
            }}
            aria-label={t('symbolDelete')}
          >
            <Trash2 style={{ width: 'clamp(0.75rem, 6cqi, 2rem)', height: 'clamp(0.75rem, 6cqi, 2rem)' }} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-theme-sm transition-colors hover:bg-white/10"
            style={{
              color: 'var(--theme-text-primary)',
              padding: 'clamp(0.125rem, 2cqi, 0.5rem)',
            }}
            aria-label={t('symbolEdit')}
          >
            <Pencil style={{ width: 'clamp(0.75rem, 6cqi, 2rem)', height: 'clamp(0.75rem, 6cqi, 2rem)' }} />
          </button>
          <button
            type="button"
            className="rounded-theme-sm transition-colors hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none"
            style={{
              color: 'var(--theme-text-primary)',
              padding: 'clamp(0.125rem, 2cqi, 0.5rem)',
            }}
            aria-label={t('symbolMove')}
            {...dragHandleListeners}
            {...dragHandleAttributes}
          >
            <Move style={{ width: 'clamp(0.75rem, 6cqi, 2rem)', height: 'clamp(0.75rem, 6cqi, 2rem)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
