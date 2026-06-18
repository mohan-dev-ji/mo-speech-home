"use client";

import { Trash2, Pencil, Move } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { SymbolCard, type SymbolDisplay } from '@/app/components/app/shared/ui/SymbolCard';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';

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

  // Figma Symbol-edit variant (`3026:3911`): a translucent `card` panel with a
  // subtle stroke-2 dashed border, the symbol card above and the Edit-panel
  // (Delete / Edit / Move icon-buttons) below. The panel grows taller than the
  // symbol's square footprint; width stays fixed (grid honoured), and the
  // edit-panel `flex-wrap`s so its buttons stack in dense grids rather than
  // widening the card. `@container` anchors any cqi sizing inside SymbolCard.
  return (
    <div className="relative w-full @container">
      <div className="w-full flex flex-col items-center gap-theme-gap p-theme-general rounded-theme-card border-2 border-dashed border-theme-enter-mode bg-theme-card">
        {/* Symbol — full square footprint */}
        <div className="w-full aspect-square">
          <SymbolCard
            symbolId="edit-mode"
            imagePath={imagePath}
            label={label}
            language="en"
            display={display}
            categoryColour={categoryColour}
            onTap={() => {}}
          />
        </div>

        {/* Edit-panel — Delete (red) / Edit (pencil) / Move (drag handle). */}
        <EditPanel orientation="horizontal" className="flex-wrap">
          <IconButton
            size="sm"
            variant="neutral"
            className="text-theme-warning"
            icon={<Trash2 />}
            label={t('symbolDelete')}
            onClick={onDelete}
          />
          <IconButton
            size="sm"
            variant="neutral"
            icon={<Pencil />}
            label={t('symbolEdit')}
            onClick={onEdit}
          />
          <IconButton
            size="sm"
            variant="neutral"
            className="cursor-grab active:cursor-grabbing touch-none"
            icon={<Move />}
            label={t('symbolMove')}
            {...dragHandleListeners}
            {...dragHandleAttributes}
          />
        </EditPanel>
      </div>
    </div>
  );
}
