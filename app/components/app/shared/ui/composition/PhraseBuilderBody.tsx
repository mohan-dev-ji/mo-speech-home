"use client";
import { useState, useEffect, type ReactNode } from 'react';
import { Plus, Volume2, VolumeX, X } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { UnitCardShell } from './UnitCardShell';

const ZINC = getCategoryColour('zinc');
// Darker than the zinc-700 card so the name/audio pill reads as inset. Fixed
// value (Figma color/zinc/900) — the phrase builder uses the fixed zinc family
// regardless of theme, matching getCategoryColour('zinc').
const ZINC900 = '#18181b';
const PILL_TEXT = '#a1a1aa';

export type PhraseBuilderWord = { imagePath?: string; label: string };

// A single word tile inside the phrase builder — drag to reorder, tap to edit,
// X to remove. Drag listeners sit on the whole tile (8px activation, so a clean
// tap still edits); the X stops pointer-down so it never starts a drag.
function SortableWordChip({
  id, imagePath, label, removeLabel, onEdit, onDelete,
}: { id: string; imagePath?: string; label: string; removeLabel: string; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} className="relative shrink-0 touch-none" {...listeners} {...attributes}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={label}
        className="w-16 h-16 sm:w-24 sm:h-24 rounded-theme-sm overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ background: ZINC.c100 }}
      >
        {imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/api/assets?key=${imagePath}`} alt={label} className="w-full h-full object-contain p-1.5" draggable={false} />
        ) : (
          <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{label}</span>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={removeLabel}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// The phrase builder card: draggable word chips + add-word, a combined name +
// audio pill, and (via `controls`) its edit cluster — all inside the shared dark
// UnitCardShell so a phrase reads as the same component as a single word. Pure
// props/callbacks; shared by the talker dropbar's PhraseEditCard and the sentence
// InlinePhraseEditor. The host owns the word/audio sub-editors + persistence and
// passes the drag/delete controls in via `controls`.
export function PhraseBuilderBody({
  name, words, hasAudio, incomplete,
  audioReadyLabel, audioGenerateLabel, renameLabel, addLabel, removeLabel,
  onRename, onWordAdd, onWordEdit, onWordDelete, onWordReorder, onAudio,
  controls,
}: {
  name: string;
  words: PhraseBuilderWord[];
  hasAudio: boolean;
  incomplete: boolean;
  audioReadyLabel: string;
  audioGenerateLabel: string;
  renameLabel: string;
  addLabel: string;
  removeLabel: string;
  onRename: (value: string) => void;
  onWordAdd: () => void;
  onWordEdit: (index: number) => void;
  onWordDelete: (index: number) => void;
  onWordReorder: (from: number, to: number) => void;
  onAudio: () => void;
  controls?: ReactNode;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    else setDraft(name);
  }

  // Independent sensor + context for word reordering (nested inside whatever
  // outer sortable context the host lives in). 8px activation keeps tap-to-edit
  // reliable.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const wordIds = words.map((_, i) => `pw-${i}`);
  function handleWordDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = wordIds.indexOf(active.id as string);
    const to = wordIds.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    onWordReorder(from, to);
  }

  return (
    <UnitCardShell incomplete={incomplete} controls={controls}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWordDragEnd}>
        <SortableContext items={wordIds} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {words.map((w, i) => (
              <SortableWordChip
                key={wordIds[i]}
                id={wordIds[i]}
                imagePath={w.imagePath}
                label={w.label}
                removeLabel={removeLabel}
                onEdit={() => onWordEdit(i)}
                onDelete={() => onWordDelete(i)}
              />
            ))}
            <button
              type="button"
              onClick={onWordAdd}
              aria-label={addLabel}
              className="w-16 h-16 sm:w-24 sm:h-24 rounded-theme-sm border-2 border-dashed border-theme-enter-mode flex items-center justify-center transition-opacity hover:opacity-80 shrink-0"
            >
              <Plus className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: 'var(--theme-enter-mode)' }} />
            </button>
          </div>
        </SortableContext>
      </DndContext>

      {/* Combined name + audio pill (Figma: one zinc-900 dashed pill). */}
      <div
        className="w-full flex items-center rounded-full border-2 border-dashed overflow-hidden"
        style={{ background: ZINC900, borderColor: 'var(--theme-enter-mode)' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
          }}
          aria-label={renameLabel}
          placeholder={renameLabel}
          className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-caption font-medium text-left outline-none"
          style={{ color: '#fff' }}
        />
        <button
          type="button"
          onClick={onAudio}
          className="flex items-center gap-1 px-3 py-1.5 shrink-0"
          style={{ color: hasAudio ? PILL_TEXT : 'var(--theme-warning)' }}
        >
          {hasAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="text-caption">{hasAudio ? audioReadyLabel : audioGenerateLabel}</span>
        </button>
      </div>
    </UnitCardShell>
  );
}
