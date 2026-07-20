"use client";
import type { HTMLAttributes } from 'react';
import { Trash2, Move, RotateCcw } from 'lucide-react';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';

// Delete + drag-reorder cluster for a composition unit, sat inside UnitCardShell's
// dark card (so no bg of its own — white IconButtons on the card). Drag listeners
// live only on the Move handle, so the block's own inputs/taps stay usable. The
// host owns the useSortable and passes its listeners/attributes through.
//
// ADR-016 Stage 3 — an optional Revert (↩) control sits before Delete, mirroring
// the sentence row's EditPanel. Only PhraseEditCard (whole-phrase edit) passes
// it; per-unit word/phrase blocks inside a sentence composition never do, so it
// stays absent there.
export function BlockEditControls({
  onDelete, deleteLabel, onRevert, revertLabel, moveLabel, dragProps,
}: {
  onDelete: () => void;
  deleteLabel: string;
  onRevert?: () => void;
  revertLabel?: string;
  moveLabel: string;
  dragProps: HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <EditPanel>
      {onRevert && (
        <IconButton
          size="sm"
          variant="neutral"
          icon={<RotateCcw />}
          label={revertLabel ?? ''}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRevert(); }}
        />
      )}
      <IconButton
        size="sm"
        variant="neutral"
        className="text-theme-warning"
        icon={<Trash2 />}
        label={deleteLabel}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      />
      <IconButton
        size="sm"
        variant="neutral"
        className="cursor-grab active:cursor-grabbing touch-none"
        icon={<Move />}
        label={moveLabel}
        {...dragProps}
      />
    </EditPanel>
  );
}
