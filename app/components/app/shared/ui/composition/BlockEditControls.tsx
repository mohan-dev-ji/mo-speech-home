"use client";
import type { HTMLAttributes, ReactNode } from 'react';
import { Trash2, Move } from 'lucide-react';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';

// Delete + drag-reorder cluster for a composition unit, sat inside UnitCardShell's
// dark card (so no bg of its own — white IconButtons on the card). Drag listeners
// live only on the Move handle, so the block's own inputs/taps stay usable. The
// host owns the useSortable and passes its listeners/attributes through.
//
// Stage D (Figma 3025-2324) — an optional `translateRevert` slot sits before
// Delete, mirroring the sentence row's EditPanel. Only PhraseEditCard
// (whole-phrase edit) passes a <TranslateRevertControl>; per-unit word/phrase
// blocks inside a sentence composition and InlinePhraseEditor never do, so it
// stays absent there.
export function BlockEditControls({
  onDelete, deleteLabel, translateRevert, moveLabel, dragProps,
}: {
  onDelete: () => void;
  deleteLabel: string;
  translateRevert?: ReactNode;
  moveLabel: string;
  dragProps: HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <EditPanel>
      {translateRevert}
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
