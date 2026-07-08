"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FolderInput,
  Move,
  Plus,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { displayString, resolvedLocale } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { Button } from '@/app/components/app/shared/ui/Button';
import { PublishModuleModal } from '@/app/components/app/shared/modals/PublishModuleModal';
import { AdminPackEditingBanner } from '@/app/components/app/shared/ui/AdminPackEditingBanner';
import { CreateSentenceModal } from '@/app/components/app/sentences/modals/CreateSentenceModal';
import { SentenceAudioModal } from '@/app/components/app/sentences/modals/SentenceAudioModal';
import { SentencePlayModal } from '@/app/components/app/sentences/modals/SentencePlayModal';
import { CompositionPlayModal } from '@/app/components/app/shared/modals/CompositionPlayModal';
import { InlinePhraseEditor } from '@/app/components/app/sentences/sections/InlinePhraseEditor';
import { CompositionBlock } from '@/app/components/app/shared/ui/composition/CompositionBlock';
import { BlockEditControls } from '@/app/components/app/shared/ui/composition/BlockEditControls';
import { UnitCardShell } from '@/app/components/app/shared/ui/composition/UnitCardShell';
import { blocksFromUnits, type CompositionUnitClient, type PlayBlock } from '@/app/components/app/shared/ui/composition/blocks';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import type { SentenceSlotSaveResult, ListItemSaveResult } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/app/components/app/shared/ui/Dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type Slot = {
  order: number;
  imagePath?: string;
  displayProps?: {
    bgColour?: string;
    textColour?: string;
    textSize?: 'sm' | 'md' | 'lg' | 'xl';
    showLabel?: boolean;
    showImage?: boolean;
    cardShape?: 'square' | 'rounded' | 'circle';
  };
};

type SentenceRow = {
  _id: Id<'profileSentences'>;
  name: Record<string, string>;
  order: number;
  // Schema is `v.union(v.string(), localisedString)` per the Phase 8.0
  // migration window — pre-migration rows still carry a plain string,
  // post-migration rows carry `{en, es, ...}`. All `.text` reads must
  // typeof-guard + displayString through. See `text` consumers below.
  text?: string | Record<string, string>;
  audioPath?: string;
  recordedAudioPath?: string;
  slots: Slot[];
  // ADR-015 — talker-saved sentences carry the block composition. A row is
  // "sequence" when playback === 'sequence' AND it has units; those render + play
  // as blocks. Fluent/legacy rows leave these undefined and use slots + TTS.
  units?: CompositionUnitClient[];
  kind?: 'sentence';
  playback?: 'sequence' | 'fluent';
  // Phase 15 (3b/3c) — language the sentence was authored in; block sentences
  // resolve text + voice against this, and the "Made in <lang>" badge shows when
  // it differs from the board language. Legacy rows are undefined → treated as 'en'.
  authoredLanguage?: string;
  librarySourceId?: string;
  folderId?: Id<'profileFolders'>;
};

// A talker-saved sentence that renders + plays as blocks (vs. fluent/legacy).
function isSequenceRow(s: Pick<SentenceRow, 'playback' | 'units'>): boolean {
  return s.playback === 'sequence' && (s.units?.length ?? 0) > 0;
}

type PendingDelete = { id: Id<'profileSentences'>; name: string } | null;

type SlotEditTarget = {
  sentenceId: Id<'profileSentences'>;
  slotIndex: number; // -1 = append new slot
} | null;

type SentenceEditTarget = {
  sentenceId: Id<'profileSentences'>;
  value: string;    // single sentence text — used as both display name and TTS
  audioPath?: string;
} | null;

// ─── Thumbnail strip (view mode) ─────────────────────────────────────────────

function ThumbnailStrip({ slots }: { slots: Slot[] }) {
  const filled = slots.filter((s) => s.imagePath).slice(0, 4);
  if (filled.length === 0) return null;
  return (
    <div className="flex gap-2 shrink-0">
      {filled.map((s, i) => (
        <div
          key={i}
          className="w-[70px] h-[70px] rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/assets?key=${s.imagePath}`}
            alt=""
            className="w-full h-full object-contain p-1"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Slot strip (edit mode) ───────────────────────────────────────────────────

type SlotStripProps = {
  sentenceId: Id<'profileSentences'>;
  slots: Slot[];
  onEditSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onRemoveSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onAddSlot: (sentenceId: Id<'profileSentences'>) => void;
  // Persist a new slot order. Parent re-numbers `order` to match the
  // new array index and forwards to `updateProfileSentenceSlots`.
  onReorderSlots: (sentenceId: Id<'profileSentences'>, nextSlots: Slot[]) => void;
  rowEditLabel: string;
  rowRemoveLabel: string;
  rowAddLabel: string;
};

// Each rendered slot. The whole tile is a drag handle — press-and-drag
// past 8px starts a sort; a clean tap fires the click-to-edit. The X
// delete button stops propagation so it stays a tap target.
type SortableSlotProps = {
  id: string;
  slot: Slot;
  slotIndex: number;
  sentenceId: Id<'profileSentences'>;
  onEditSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onRemoveSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  rowEditLabel: string;
  rowRemoveLabel: string;
};

function SortableSlot({
  id, slot, slotIndex, sentenceId,
  onEditSlot, onRemoveSlot,
  rowEditLabel, rowRemoveLabel,
}: SortableSlotProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        type="button"
        onClick={() => onEditSlot(sentenceId, slotIndex)}
        aria-label={rowEditLabel}
        className="w-[60px] h-[60px] rounded-theme-sm overflow-hidden flex items-center justify-center transition-opacity hover:opacity-80 touch-none cursor-grab active:cursor-grabbing"
        style={{
          background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))',
          border: '1.5px dashed var(--theme-brand-primary)',
        }}
        {...listeners}
        {...attributes}
      >
        {slot.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets?key=${slot.imagePath}`}
            alt=""
            className="w-full h-full object-contain p-1"
            draggable={false}
          />
        ) : (
          <div className="w-8 h-8 rounded bg-white/10" />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemoveSlot(sentenceId, slotIndex); }}
        // Block pointer-down from reaching the slot's drag listeners so
        // tapping the X never starts a drag, even on touch devices where
        // a tiny pixel jitter could cross the 8px activation threshold.
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={rowRemoveLabel}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function SlotStrip({
  sentenceId, slots,
  onEditSlot, onRemoveSlot, onAddSlot, onReorderSlots,
  rowEditLabel, rowRemoveLabel, rowAddLabel,
}: SlotStripProps) {
  // Independent sensor for the slot DndContext — same 8px activation as
  // the outer sentence-row sensor so click-to-edit on the slot tile and
  // tap-to-delete on the X both stay reliable.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Stable IDs per position. Index-based is fine here because slot data
  // is the visual we reorder, not the IDs themselves — see arrayMove
  // call in handleDragEnd which produces a new slots array.
  const itemIds = slots.map((_, i) => `slot-${i}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = itemIds.indexOf(active.id as string);
    const newIdx = itemIds.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(slots, oldIdx, newIdx).map((s, i) => ({ ...s, order: i }));
    onReorderSlots(sentenceId, next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-2 items-center">
          {slots.map((slot, i) => (
            <SortableSlot
              key={itemIds[i]}
              id={itemIds[i]}
              slot={slot}
              slotIndex={i}
              sentenceId={sentenceId}
              onEditSlot={onEditSlot}
              onRemoveSlot={onRemoveSlot}
              rowEditLabel={rowEditLabel}
              rowRemoveLabel={rowRemoveLabel}
            />
          ))}
          <button
            type="button"
            onClick={() => onAddSlot(sentenceId)}
            aria-label={rowAddLabel}
            className="w-[60px] h-[60px] rounded-theme-sm flex items-center justify-center transition-opacity hover:opacity-80"
            style={{
              background: 'transparent',
              border: '1.5px dashed var(--theme-brand-primary)',
              color: 'var(--theme-brand-primary)',
            }}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Unit strip (edit mode, sequence sentences) ──────────────────────────────
// Block-level editing for talker-saved sentences (ADR-015): word blocks
// tap-to-edit (symbol editor), phrase blocks tap-to-play and stay atomic (no
// inner-word editing — rebuild a phrase in the dropbar to change it). All blocks
// drag to reorder + X to remove; a trailing "Add word" appends a word unit.

type UnitStripProps = {
  sentenceId: Id<'profileSentences'>;
  units: CompositionUnitClient[];
  language: string;
  onEditWord: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
  onRemoveUnit: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
  onAddWord: (sentenceId: Id<'profileSentences'>) => void;
  onAddPhrase: (sentenceId: Id<'profileSentences'>) => void;
  onReorderUnits: (sentenceId: Id<'profileSentences'>, from: number, to: number) => void;
  onPhraseChange: (sentenceId: Id<'profileSentences'>, unitIndex: number, updated: CompositionUnitClient) => void;
  rowRemoveLabel: string;
  rowAddLabel: string;
};

function SortableUnitBlock({
  id, block, unitIndex, sentenceId, onTap, onRemove, rowRemoveLabel, moveLabel,
}: {
  id: string;
  block: PlayBlock;
  unitIndex: number;
  sentenceId: Id<'profileSentences'>;
  onTap: () => void;
  onRemove: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
  rowRemoveLabel: string;
  moveLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };
  // A word block is the same dark card as a phrase (Figma "Symbol" card): white
  // tile inside, edit controls centred beneath — so words and phrases line up.
  // Drag lives on the Move handle only, so tapping the tile edits cleanly.
  return (
    <div ref={setNodeRef} style={style} className="shrink-0">
      <UnitCardShell
        controls={
          <BlockEditControls
            onDelete={() => onRemove(sentenceId, unitIndex)}
            deleteLabel={rowRemoveLabel}
            moveLabel={moveLabel}
            dragProps={{ ...listeners, ...attributes }}
          />
        }
      >
        <CompositionBlock block={block} onTap={onTap} />
      </UnitCardShell>
    </div>
  );
}

function UnitStrip({
  sentenceId, units, language,
  onEditWord, onRemoveUnit, onAddWord, onAddPhrase, onReorderUnits, onPhraseChange,
  rowRemoveLabel, rowAddLabel,
}: UnitStripProps) {
  const t = useTranslations('sentences');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const blocks = blocksFromUnits(units, language);
  const itemIds = units.map((_, i) => `unit-${i}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = itemIds.indexOf(active.id as string);
    const to = itemIds.indexOf(over.id as string);
    if (from < 0 || to < 0) return;
    onReorderUnits(sentenceId, from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-2 items-center">
          {units.map((u, i) => (
            u.kind === 'phrase' ? (
              // Phrase: the dropbar builder rendered inline; edits save instantly.
              <InlinePhraseEditor
                key={itemIds[i]}
                id={itemIds[i]}
                unit={u}
                unitIndex={i}
                sentenceId={sentenceId}
                onChange={onPhraseChange}
                onRemove={onRemoveUnit}
              />
            ) : (
              // Word: a block tile — tap to edit (symbol editor), controls below.
              <SortableUnitBlock
                key={itemIds[i]}
                id={itemIds[i]}
                block={blocks[i]}
                unitIndex={i}
                sentenceId={sentenceId}
                onTap={() => onEditWord(sentenceId, i)}
                onRemove={onRemoveUnit}
                rowRemoveLabel={rowRemoveLabel}
                moveLabel={t('rowReorder')}
              />
            )
          ))}
          {/* Add menu: create a single symbol OR start a new phrase, both inline. */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAddMenuOpen((o) => !o)}
              aria-label={rowAddLabel}
              className="w-[60px] h-[60px] rounded-theme-sm flex items-center justify-center transition-opacity hover:opacity-80"
              style={{
                background: 'transparent',
                border: '1.5px dashed var(--theme-brand-primary)',
                color: 'var(--theme-brand-primary)',
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setAddMenuOpen(false)} />
                <div
                  className="absolute z-[61] top-full mt-1 left-0 min-w-[170px] flex flex-col rounded-theme-sm overflow-hidden shadow-lg border border-theme-line"
                  style={{ background: 'var(--theme-card)' }}
                >
                  <button
                    type="button"
                    onClick={() => { setAddMenuOpen(false); onAddWord(sentenceId); }}
                    className="px-3 py-2 text-left text-theme-s hover:opacity-80"
                    style={{ color: 'var(--theme-text)' }}
                  >
                    {t('addSymbolOption')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddMenuOpen(false); onAddPhrase(sentenceId); }}
                    className="px-3 py-2 text-left text-theme-s hover:opacity-80"
                    style={{ color: 'var(--theme-text)' }}
                  >
                    {t('addPhraseOption')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Sortable sentence row ────────────────────────────────────────────────────

type SortableSentenceRowProps = {
  sentence: SentenceRow;
  language: string;
  isEditing: boolean;
  /** Phase 8.5 — audio available for the CURRENT voice (a recording, or cached/
   *  seeded TTS). Drives the edit-mode "needs generation" nudge. */
  audioReady?: boolean;
  onDeleteRequest: (id: Id<'profileSentences'>, name: string) => void;
  onMoveRequest: (id: Id<'profileSentences'>, name: string) => void;
  onEditSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onRemoveSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onAddSlot: (sentenceId: Id<'profileSentences'>) => void;
  onReorderSlots: (sentenceId: Id<'profileSentences'>, nextSlots: Slot[]) => void;
  // Unit-level editing (sequence sentences only — ADR-015).
  onEditWord: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
  onRemoveUnit: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
  onAddWord: (sentenceId: Id<'profileSentences'>) => void;
  onAddPhrase: (sentenceId: Id<'profileSentences'>) => void;
  onReorderUnits: (sentenceId: Id<'profileSentences'>, from: number, to: number) => void;
  onPhraseChange: (sentenceId: Id<'profileSentences'>, unitIndex: number, updated: CompositionUnitClient) => void;
  onEditSentence: (sentence: SentenceRow) => void;
  onPlay: (sentence: SentenceRow) => void;
};

function SortableSentenceRow({
  sentence, language, isEditing, audioReady = false,
  onDeleteRequest, onMoveRequest,
  onEditSlot, onRemoveSlot, onAddSlot, onReorderSlots,
  onEditWord, onRemoveUnit, onAddWord, onAddPhrase, onReorderUnits, onPhraseChange,
  onEditSentence, onPlay,
}: SortableSentenceRowProps) {
  const t = useTranslations('sentences');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sentence._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const name = displayString(sentence.name, language, DEFAULT_LOCALE);
  // `text` is `string | LocalisedString` during the Phase 8.0 migration
  // window — typeof-guard before rendering. Same pattern as the
  // onEditSentence callback below and the PlayModal hookup.
  const resolvedText =
    typeof sentence.text === 'string'
      ? sentence.text
      : displayString(sentence.text, language, DEFAULT_LOCALE);
  const sentenceText = resolvedText || name;
  // Phase 15 (3c): a block/sequence sentence renders + speaks in the language it
  // was AUTHORED in, never the board language (structure is language-specific).
  const authoredLang = sentence.authoredLanguage ?? DEFAULT_LOCALE;
  // Talker-saved (sequence) sentences keep no maintained whole-sentence title
  // (unit edits only patch `units`/`slots`), so derive the full sentence from the
  // blocks — exactly what plays — for the read-only text shown to the right.
  const seqBlocks = isSequenceRow(sentence)
    ? blocksFromUnits(sentence.units!, authoredLang)
    : [];
  const seqFullText = seqBlocks
    .map((b) => (b.kind === 'word' ? b.label : b.name))
    .join(' ');

  return (
    <div ref={setNodeRef} style={style}>
      {/* Figma sentence strip — `card` row; edit adds a stroke-2 dashed border
          (transparent when idle → no shift) + the Edit-panel. `flex-wrap` keeps
          the strip within the content width: the right cluster drops below
          (grows on Y) rather than overflowing horizontally. */}
      <div
        className={[
          'rounded-theme-card px-theme-general py-theme-item transition-colors border-2 border-dashed',
          isEditing ? 'border-theme-enter-mode' : 'border-transparent cursor-pointer',
        ].join(' ')}
        style={{ background: 'var(--group-card, var(--theme-card))' }}
        onClick={isEditing ? undefined : () => onPlay(sentence)}
        role={isEditing ? undefined : 'button'}
        aria-label={isEditing ? undefined : t('rowPlay')}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-3 flex-1 min-w-0">

          {/* Top row: the symbol area (fills the width + wraps) and the edit panel
              (top-right, aligned with the first symbol row). The full sentence text
              sits below on its own line so wide sentences don't push it off right. */}
          <div className="flex items-start gap-3">
            <div
              className="flex-1 min-w-0"
              // View mode: let clicks anywhere on the row — symbols OR text — bubble
              // to the row's onPlay, for BOTH sequence and fluent sentences. The old
              // stopPropagation on fluent rows meant tapping a library sentence's
              // symbols (the obvious target) did nothing. In edit mode the card has
              // no onPlay, so bubbling is harmless.
            >
              {isEditing ? (
                isSequenceRow(sentence) ? (
                  <UnitStrip
                    sentenceId={sentence._id}
                    units={sentence.units!}
                    language={authoredLang}
                    onEditWord={onEditWord}
                    onRemoveUnit={onRemoveUnit}
                    onAddWord={onAddWord}
                    onAddPhrase={onAddPhrase}
                    onReorderUnits={onReorderUnits}
                    onPhraseChange={onPhraseChange}
                    rowRemoveLabel={t('rowRemoveSlot')}
                    rowAddLabel={t('rowAddWord')}
                  />
                ) : (
                  <SlotStrip
                    sentenceId={sentence._id}
                    slots={sentence.slots}
                    onEditSlot={onEditSlot}
                    onRemoveSlot={onRemoveSlot}
                    onAddSlot={onAddSlot}
                    onReorderSlots={onReorderSlots}
                    rowEditLabel={t('rowEditSlot')}
                    rowRemoveLabel={t('rowRemoveSlot')}
                    rowAddLabel={t('rowAddSlot')}
                  />
                )
              ) : isSequenceRow(sentence) ? (
                // Talker-saved: render the composition as blocks (phrase = zinc box,
                // words = tiles). Read-only in view mode — no onTap.
                <div className="flex flex-wrap gap-2">
                  {seqBlocks.map((b, i) => (
                    <CompositionBlock key={i} block={b} />
                  ))}
                </div>
              ) : (
                <ThumbnailStrip slots={sentence.slots} />
              )}
            </div>

            {/* Edit panel — top-right, aligned with the first symbol row. */}
            <div className="shrink-0">
              {isEditing && (
                <EditPanel className="flex-wrap">
                  <IconButton
                    size="sm"
                    variant="neutral"
                    className="text-theme-warning"
                    icon={<Trash2 />}
                    label={t('rowDelete')}
                    onClick={(e) => { e.stopPropagation(); onDeleteRequest(sentence._id, name); }}
                  />
                  <IconButton
                    size="sm"
                    variant="neutral"
                    icon={<FolderInput />}
                    label={t('moveToGroup')}
                    onClick={(e) => { e.stopPropagation(); onMoveRequest(sentence._id, name); }}
                  />
                  <IconButton
                    size="sm"
                    variant="neutral"
                    className="cursor-grab active:cursor-grabbing touch-none"
                    icon={<Move />}
                    label={t('rowMove')}
                    onClick={(e) => e.stopPropagation()}
                    {...listeners}
                    {...attributes}
                  />
                </EditPanel>
              )}
            </div>
          </div>

          {/* Below: full sentence text — wraps to as many lines as needed.
              Sequence rows show the derived read-only text; fluent rows show the
              editable title + audio nudge (edit) or plain text (view). */}
          {isSequenceRow(sentence) ? (
            <p className="text-theme-p font-semibold break-words" style={{ color: 'var(--theme-text-primary)' }}>
              {seqFullText}
            </p>
          ) : isEditing ? (
            <button
              type="button"
              onClick={() => onEditSentence(sentence)}
              className="w-full px-3 py-2 rounded-theme-sm text-left transition-opacity hover:opacity-80"
              style={{
                border: '1.5px dashed var(--theme-brand-primary)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <p className="text-theme-p font-semibold break-words" style={{ color: 'var(--theme-text-primary)' }}>
                {sentenceText}
              </p>
              {/* Audio-status nudge — visible inside the click area so it
                  doubles as a call to action: "click here to add audio". */}
              {audioReady ? (
                <span
                  className="mt-1 inline-flex items-center gap-1 text-theme-xs"
                  style={{ color: 'var(--theme-secondary-text)' }}
                >
                  <Volume2 className="w-3 h-3" />
                  {t('audioGenerated')}
                </span>
              ) : (
                <span
                  className="mt-1 inline-flex items-center gap-1 text-theme-xs font-semibold"
                  style={{ color: 'var(--theme-warning)' }}
                >
                  <VolumeX className="w-3 h-3" />
                  {t('audioNeedsGeneration')}
                </span>
              )}
            </button>
          ) : (
            <p className="text-theme-p font-semibold break-words" style={{ color: 'var(--theme-text-primary)' }}>
              {sentenceText}
            </p>
          )}
          </div>

          {/* Phase 15 (3d): "Made in <lang>" badge — a block sentence renders in the
              language it was authored in (structure isn't translated). Show it when
              the authored language differs from the board language so the instructor
              knows why it didn't switch. View mode only (edit panel owns the right in
              edit mode). */}
          {!isEditing && isSequenceRow(sentence) && authoredLang !== language && (
            <span
              className="shrink-0 self-center rounded-full text-theme-xs font-semibold px-3 py-1 whitespace-nowrap"
              style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
            >
              {t('madeInBadge', { lang: authoredLang.toUpperCase() })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SentencesModeContent({ folderId }: { folderId?: string } = {}) {
  const t = useTranslations('sentences');
  const params = useParams();
  const locale = params.locale as string;
  const { language, viewMode, accountId, stateFlags, voiceId } = useProfile();
  const { setBreadcrumbExtra } = useBreadcrumb();
  const isAdmin = useIsAdmin();
  const showAdminButtons = viewMode === 'admin' && isAdmin;

  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';
  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  // Last-seen server id-set, so we can re-sync `localOrder` during render (not in
  // an effect) when the server set changes — see the sync block below.
  const [seenOrderKey, setSeenOrderKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // Free-tier intercepts. Gating Edit toggles cascades to slot edit /
  // sentence text edit / reorder / delete — all of which only render
  // inside edit mode.
  const handleEditToggle = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setIsEditing(!isEditing);
  };
  const handleCreateOpen = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setCreateModalOpen(true);
  };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [slotEditTarget, setSlotEditTarget] = useState<SlotEditTarget>(null);
  // Unit-level edit target (sequence sentences). unitIndex -1 = append a word.
  const [unitEditTarget, setUnitEditTarget] =
    useState<{ sentenceId: Id<'profileSentences'>; unitIndex: number } | null>(null);
  const [sentenceEditTarget, setSentenceEditTarget] = useState<SentenceEditTarget>(null);
  const [playTarget, setPlayTarget] = useState<SentenceRow | null>(null);

  const sentences = useQuery(api.profileSentences.getProfileSentences, {});
  const createSentence   = useMutation(api.profileSentences.createProfileSentence);
  const updateSlots      = useMutation(api.profileSentences.updateProfileSentenceSlots);
  const updateUnits      = useMutation(api.profileSentences.updateProfileSentenceUnits);
  const deleteSentence   = useMutation(api.profileSentences.deleteProfileSentence);
  const reorderSentences = useMutation(api.profileSentences.reorderProfileSentences);
  const moveSentenceToGroup  = useMutation(api.profileFolders.moveSentenceToGroup);

  // ── Folder scoping (ADR-014 §2) ──────────────────────────────────────────
  // Rendered under /sentences/folder/[folderId]; show only that group's
  // sentences. "ungrouped" = sentences with no folder.
  const isUngrouped = folderId === 'ungrouped';
  const realFolderId =
    folderId && !isUngrouped ? (folderId as Id<'profileFolders'>) : undefined;
  const folderDoc = useQuery(
    api.profileFolders.getProfileFolder,
    realFolderId ? { folderId: realFolderId } : 'skip',
  );
  const scopedSentences = useMemo(() => {
    if (!sentences || !folderId) return sentences;
    return sentences.filter((s) =>
      isUngrouped ? !s.folderId : s.folderId === realFolderId,
    );
  }, [sentences, folderId, isUngrouped, realFolderId]);

  // Breadcrumb: Sentences › <group>
  const folderName = isUngrouped
    ? t('ungrouped')
    : folderDoc
      ? displayString(folderDoc.name, language, DEFAULT_LOCALE)
      : '';
  useEffect(() => {
    if (!folderId || !folderName) return;
    setBreadcrumbExtra({ label: folderName });
    return () => setBreadcrumbExtra(null);
  }, [folderId, folderName, setBreadcrumbExtra]);

  // Group colour tint (ADR-014) — see ListsModeContent. Drives `--group-card`.
  const groupTint = folderDoc?.colour
    ? `color-mix(in srgb, ${getCategoryColour(folderDoc.colour).c500} 30%, transparent)`
    : undefined;

  // Move-to-group dialog state.
  const [moveTarget, setMoveTarget] = useState<{ id: Id<'profileSentences'>; name: string } | null>(null);
  const [moveSelection, setMoveSelection] = useState<Id<'profileFolders'> | 'ungrouped' | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const groups = useQuery(api.profileFolders.getProfileFolders, { tree: 'sentences' });

  async function handleMoveConfirm() {
    if (!moveTarget || !moveSelection) return;
    setIsMoving(true);
    try {
      await moveSentenceToGroup({
        sentenceId: moveTarget.id,
        folderId: moveSelection === 'ungrouped' ? null : moveSelection,
      });
      setMoveTarget(null);
      setMoveSelection(null);
    } finally {
      setIsMoving(false);
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Re-sync the local drag order with the server set DURING render (React's
  // "adjust state when inputs change" pattern) rather than a setState-in-effect:
  // keep still-present ids in their local order and append newcomers. Guarded by
  // `seenOrderKey` so it runs only when the id-set actually changes.
  if (scopedSentences) {
    const serverIds = scopedSentences.map((s) => s._id as string);
    const orderKey = serverIds.join(',');
    if (orderKey !== seenOrderKey) {
      setSeenOrderKey(orderKey);
      setLocalOrder((prev) => {
        const kept = prev.filter((id) => serverIds.includes(id));
        const added = serverIds.filter((id) => !prev.includes(id));
        return [...kept, ...added];
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const visible = prev;
      const oldVisIdx = visible.indexOf(active.id as string);
      const newVisIdx = visible.indexOf(over.id as string);
      if (oldVisIdx < 0 || newVisIdx < 0) return prev;
      const reorderedVisible = arrayMove(visible, oldVisIdx, newVisIdx);

      const visibleSet = new Set(visible);
      let v = 0;
      const next = prev.map((id) => visibleSet.has(id) ? reorderedVisible[v++] : id);

      reorderSentences({ orderedIds: next as Id<'profileSentences'>[] });
      return next;
    });
  }

  async function handleCreate(name: string) {
    await createSentence({
      name: { en: name },
      ...(realFolderId ? { folderId: realFolderId } : {}),
    });
    // Drop straight into edit mode so the new sentence's empty slots and
    // audio affordances are visible immediately — same pattern as list
    // creation, just no navigation since sentences live inline on this page.
    setIsEditing(true);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSentence({ profileSentenceId: pendingDelete.id });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  function handleEditSlot(sentenceId: Id<'profileSentences'>, slotIndex: number) {
    setSlotEditTarget({ sentenceId, slotIndex });
  }

  function handleAddSlot(sentenceId: Id<'profileSentences'>) {
    setSlotEditTarget({ sentenceId, slotIndex: -1 });
  }

  function handleRemoveSlot(sentenceId: Id<'profileSentences'>, slotIndex: number) {
    const sentence = sentences?.find((s) => s._id === sentenceId);
    if (!sentence) return;
    const updated = sentence.slots
      .filter((_, i) => i !== slotIndex)
      .map((slot, i) => ({ ...slot, order: i }));
    updateSlots({ profileSentenceId: sentenceId, slots: updated });
  }

  function handleReorderSlots(sentenceId: Id<'profileSentences'>, nextSlots: Slot[]) {
    // `nextSlots` already carries reindexed `order` values from SlotStrip.
    // Re-shape to the mutation arg type so optional displayProps default
    // to undefined when absent.
    const slotsArg = nextSlots.map((s, i) => ({
      order: i,
      imagePath: s.imagePath,
      displayProps: s.displayProps,
    }));
    updateSlots({
      profileSentenceId: sentenceId,
      slots: slotsArg,
    });
  }

  function handleSlotSave(result: SentenceSlotSaveResult) {
    if (!slotEditTarget) return;
    const sentence = sentences?.find((s) => s._id === slotEditTarget.sentenceId);
    if (!sentence) return;

    const current = [...sentence.slots];
    if (slotEditTarget.slotIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, displayProps: result.displayProps });
    } else {
      current[slotEditTarget.slotIndex] = {
        ...current[slotEditTarget.slotIndex],
        imagePath:    result.imagePath,
        displayProps: result.displayProps,
      };
    }
    const reindexed = current.map((s, i) => ({ ...s, order: i }));
    updateSlots({ profileSentenceId: slotEditTarget.sentenceId, slots: reindexed });
    setSlotEditTarget(null);
  }

  // ── Unit-level editing (sequence sentences, ADR-015) ──────────────────────
  // Operations rebuild the units array (phrases stay atomic) and persist via
  // updateProfileSentenceUnits, which also regenerates the flat `slots` mirror.

  function unitsOf(sentenceId: Id<'profileSentences'>): CompositionUnitClient[] {
    return (sentences?.find((s) => s._id === sentenceId)?.units ?? []) as CompositionUnitClient[];
  }

  function persistUnits(sentenceId: Id<'profileSentences'>, units: CompositionUnitClient[]) {
    const reindexed = units.map((u, i) => ({ ...u, order: i }));
    updateUnits({ profileSentenceId: sentenceId, units: reindexed });
  }

  function handleRemoveUnit(sentenceId: Id<'profileSentences'>, unitIndex: number) {
    persistUnits(sentenceId, unitsOf(sentenceId).filter((_, i) => i !== unitIndex));
  }

  function handleReorderUnits(sentenceId: Id<'profileSentences'>, from: number, to: number) {
    persistUnits(sentenceId, arrayMove(unitsOf(sentenceId), from, to));
  }

  function handleEditWord(sentenceId: Id<'profileSentences'>, unitIndex: number) {
    setUnitEditTarget({ sentenceId, unitIndex });
  }

  function handleAddWord(sentenceId: Id<'profileSentences'>) {
    setUnitEditTarget({ sentenceId, unitIndex: -1 });
  }

  // "Create a phrase": append an empty phrase unit that renders inline as a fresh
  // builder, ready to fill. Persisted immediately (save-instantly).
  function handleAddPhrase(sentenceId: Id<'profileSentences'>) {
    persistUnits(sentenceId, [
      ...unitsOf(sentenceId),
      { kind: 'phrase', order: 0, name: { [language]: '' }, words: [] },
    ]);
  }

  // The inline phrase editor saves instantly (ADR-015): each edit replaces the
  // phrase unit in place and persists, local to this sentence's snapshot.
  function handlePhraseChange(sentenceId: Id<'profileSentences'>, unitIndex: number, updated: CompositionUnitClient) {
    const units = [...unitsOf(sentenceId)];
    if (units[unitIndex]?.kind !== 'phrase') return;
    units[unitIndex] = updated;
    persistUnits(sentenceId, units);
  }

  // Word units use the full listItem editor (label + audio), so an added/edited
  // word carries a spoken clip + label — it plays in the block modal instead of
  // glowing silently. `order` is reindexed in persistUnits.
  function handleUnitSave(result: ListItemSaveResult) {
    if (!unitEditTarget) return;
    const label = result.description?.trim();
    const wordUnit: CompositionUnitClient = {
      kind: 'word',
      order: 0,
      ...(result.imagePath ? { imagePath: result.imagePath } : {}),
      ...(result.audioPath ? { audioPath: result.audioPath } : {}),
      ...(label ? { label: { [language]: label } } : {}),
    };
    const units = [...unitsOf(unitEditTarget.sentenceId)];
    if (unitEditTarget.unitIndex === -1) {
      units.push(wordUnit);
    } else if (units[unitEditTarget.unitIndex]?.kind === 'word') {
      // Only word units are editable; phrase units stay atomic (untouched).
      units[unitEditTarget.unitIndex] = wordUnit;
    }
    persistUnits(unitEditTarget.sentenceId, units);
    setUnitEditTarget(null);
  }

  // Memoised so its identity is stable while the server set is unchanged — the
  // `filteredOrder` memo below depends on it, and a fresh object every render
  // would defeat that memo (and trips the compiler's "could not be preserved").
  const sentenceMap = useMemo(
    () => Object.fromEntries((scopedSentences ?? []).map((s) => [s._id, s])),
    [scopedSentences],
  );

  // Display order = local order (drag-reorder mirror). The pack-origin filter
  // dropdown was removed with the resource-pack teardown (Phase 14.5 Stage 2).
  const filteredOrder = localOrder;
  const filteredSentences = filteredOrder.map((id) => sentenceMap[id]).filter(Boolean) as SentenceRow[];

  // Phase 8.5 — reactive "is audio available for the current voice" per sentence,
  // driving the edit-mode "needs generation" nudge. Index-only batch lookup,
  // only while editing (the signal is instructor/editing-only).
  const rowText = (s: SentenceRow) => {
    const txt = typeof s.text === 'string' ? s.text : displayString(s.text, language, DEFAULT_LOCALE);
    return (txt || displayString(s.name, language, DEFAULT_LOCALE)).toLowerCase().trim();
  };
  const sentenceAudioTexts = isEditing
    ? filteredSentences.map(rowText).filter(Boolean)
    : [];
  const audioAvailList = useQuery(
    api.ttsCache.checkMany,
    isEditing && sentenceAudioTexts.length > 0
      ? { texts: sentenceAudioTexts, voiceId }
      : 'skip'
  );
  // checkMany returns an array (text as a value — Convex forbids non-ASCII object
  // keys, e.g. Hindi text). Rebuild the by-text lookup client-side.
  const audioAvail = useMemo(
    () => Object.fromEntries((audioAvailList ?? []).map((e) => [e.text, e])),
    [audioAvailList],
  );

  const slotEditorSentence = slotEditTarget
    ? sentences?.find((s) => s._id === slotEditTarget.sentenceId)
    : undefined;

  const existingSlotImagePath =
    slotEditTarget && slotEditTarget.slotIndex >= 0
      ? slotEditorSentence?.slots[slotEditTarget.slotIndex]?.imagePath
      : undefined;

  // Seed the unit editor when editing an existing word unit (label + image +
  // audio). Passing the stored clip as initialAudioPath preserves it on an
  // untouched re-save (listItem back-compat treats it as the default source).
  const editingUnit = (() => {
    if (!unitEditTarget || unitEditTarget.unitIndex < 0) return undefined;
    const u = sentences?.find((s) => s._id === unitEditTarget.sentenceId)?.units?.[unitEditTarget.unitIndex];
    return u && u.kind === 'word' ? u : undefined;
  })();
  const existingUnitImagePath = editingUnit?.imagePath;
  const existingUnitAudioPath = editingUnit?.audioPath;
  const existingUnitLabel = editingUnit?.label
    ? displayString(editingUnit.label, language, DEFAULT_LOCALE)
    : undefined;

  // Only render sentences page if state flag allows it (same pattern as lists)
  if (stateFlags && !stateFlags.sentences_visible) return null;

  // Show the admin disclaimer when at least one sentence on this page is
  // published to a pack — admin in admin view editing those sentences will
  // propagate to the pack.
  const hasPublishedSentence = !!scopedSentences?.some((s) => !!s.librarySourceId);

  return (
    <div
      className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap"
      style={groupTint ? ({ '--group-card': groupTint } as React.CSSProperties) : undefined}
    >

      <AdminPackEditingBanner
        visible={showAdminButtons && hasPublishedSentence}
      />

      {/* Header — permanent banner: the talker never replaces it on this page,
          so it shows in both talker and banner modes (gated only on the header
          on/off flag). Stays fixed at the top while the rows below scroll. */}
      {stateFlags.talker_visible && (
        <div className="shrink-0">
          <PageBanner
            title={folderId ? folderName : t('title')}
            backHref={folderId ? `/${locale}/sentences` : undefined}
            backLabel={t('groupBack', { name: t('groupsTitle') })}
          >
            {/* In student-view the Edit/Create affordances appear only when the
                instructor has granted `student_can_edit` (matches the detail
                pages, which render their EditButton unconditionally inside the
                banner and let PageBanner's showChildren gate on the flag). */}
            {(viewMode !== 'student-view' || stateFlags.student_can_edit) && (
              <>
                <EditButton
                  isEditing={isEditing}
                  onClick={handleEditToggle}
                  editLabel={t('edit')}
                  exitLabel={t('exitEdit')}
                />
                <CreateButton
                  onClick={handleCreateOpen}
                  label={t('create')}
                />
              </>
            )}
            {/* Publish as module — admin-only, from the folder's own page.
                Only inside a real folder (not the groups root or Ungrouped). */}
            {showAdminButtons && realFolderId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPublishOpen(true)}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                {folderDoc?.publishedModuleSlug ? t('updateModule') : t('publishModule')}
              </Button>
            )}
          </PageBanner>
        </div>
      )}

      {/* Scrollable content area — banner above + modals below stay in
          their own non-scrolling slots. */}
      <div className="flex-1 overflow-auto">
        {scopedSentences === undefined && (
          <div className="flex justify-center py-12">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {scopedSentences?.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>
              {folderId ? t('groupEmpty') : t('empty')}
            </p>
          </div>
        )}

        {filteredSentences.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {filteredSentences.map((sentence) => {
                  const audioReady =
                    !!sentence.recordedAudioPath ||
                    audioAvail?.[rowText(sentence)]?.available === true;
                  return (
                    <SortableSentenceRow
                      key={sentence._id}
                      sentence={sentence}
                      language={language}
                      isEditing={isEditing}
                      audioReady={audioReady}
                      onDeleteRequest={(id, name) => setPendingDelete({ id, name })}
                      onMoveRequest={(id, name) => { setMoveTarget({ id, name }); setMoveSelection(null); }}
                      onEditSlot={handleEditSlot}
                      onRemoveSlot={handleRemoveSlot}
                      onAddSlot={handleAddSlot}
                      onReorderSlots={handleReorderSlots}
                      onEditWord={handleEditWord}
                      onRemoveUnit={handleRemoveUnit}
                      onAddWord={handleAddWord}
                      onAddPhrase={handleAddPhrase}
                      onReorderUnits={handleReorderUnits}
                      onPhraseChange={handlePhraseChange}
                      onEditSentence={(s) => setSentenceEditTarget({
                        sentenceId: s._id,
                        // `text` is a localised record post Phase 8.0; the schema
                        // migration union still permits a string from pre-migration
                        // rows during the cutover window, so the typeof guard keeps
                        // both readable.
                        value:
                          (typeof s.text === 'string'
                            ? s.text
                            : displayString(s.text, language, DEFAULT_LOCALE)) ||
                          displayString(s.name, language, DEFAULT_LOCALE),
                        audioPath: s.audioPath,
                      })}
                      onPlay={(s) => setPlayTarget(s)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Create modal */}
      <CreateSentenceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* Free-tier upgrade nudge — fires from handleEditToggle and
          handleCreateOpen when subscription.tier === 'free'. */}
      {publishOpen && realFolderId && (
        <PublishModuleModal
          kind="sentences"
          targetId={realFolderId}
          defaultName={folderName}
          publishedSlug={folderDoc?.publishedModuleSlug}
          publishedClass={folderDoc?.publishedModuleClass}
          onClose={() => setPublishOpen(false)}
        />
      )}

      <UpgradeNudge
        open={upgradeNudgeOpen}
        onOpenChange={setUpgradeNudgeOpen}
        locale={locale}
      />

      {/* Delete confirm dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirm', { name: pendingDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('deleteCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            >
              {isDeleting ? t('deleting') : t('deleteButton')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move-to-group dialog — select a destination, then Move. */}
      <Dialog open={moveTarget !== null} onOpenChange={(open) => { if (!open) { setMoveTarget(null); setMoveSelection(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('moveToGroupTitle', { name: moveTarget?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-auto">
            {(groups ?? []).map((g) => {
              const isCurrent = realFolderId === g._id;
              const isSelected = moveSelection === g._id;
              return (
                <button
                  key={g._id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => setMoveSelection(g._id)}
                  className="text-left px-3 py-2.5 rounded-theme-sm text-theme-s font-medium transition-colors disabled:opacity-40"
                  style={{
                    background: isSelected ? 'var(--theme-primary)' : 'var(--theme-symbol-bg)',
                    color: isSelected ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                    border: `2px solid ${isSelected ? 'var(--theme-primary)' : 'transparent'}`,
                  }}
                >
                  {displayString(g.name, language, DEFAULT_LOCALE)}
                </button>
              );
            })}
            <button
              type="button"
              disabled={isUngrouped}
              onClick={() => setMoveSelection('ungrouped')}
              className="text-left px-3 py-2.5 rounded-theme-sm text-theme-s font-medium transition-colors disabled:opacity-40"
              style={{
                background: moveSelection === 'ungrouped' ? 'var(--theme-primary)' : 'var(--theme-symbol-bg)',
                color: moveSelection === 'ungrouped' ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                border: `2px solid ${moveSelection === 'ungrouped' ? 'var(--theme-primary)' : 'transparent'}`,
              }}
            >
              {t('ungrouped')}
            </button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}>
                {t('deleteCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleMoveConfirm}
              disabled={!moveSelection || isMoving}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {isMoving ? t('deleting') : t('moveToGroup')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot symbol editor */}
      {slotEditTarget && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="sentenceSlot"
          initialImagePath={existingSlotImagePath}
          onClose={() => setSlotEditTarget(null)}
          onSave={() => {}}
          onSentenceSlotSave={handleSlotSave}
        />
      )}

      {/* Unit (word) editor — sequence sentences. Uses the full listItem editor
          (label + audio) so an added/edited word speaks in the block modal
          instead of being a silent tile. Save rebuilds the units array. */}
      {unitEditTarget && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="listItem"
          initialLabel={existingUnitLabel}
          initialImagePath={existingUnitImagePath}
          initialAudioPath={existingUnitAudioPath}
          onClose={() => setUnitEditTarget(null)}
          onSave={() => {}}
          onListItemSave={handleUnitSave}
        />
      )}

      {/* Audio editor */}
      {sentenceEditTarget && accountId && (
        <SentenceAudioModal
          isOpen
          sentenceId={sentenceEditTarget.sentenceId}
          accountId={accountId}
          initialValue={sentenceEditTarget.value}
          onClose={() => setSentenceEditTarget(null)}
        />
      )}

      {/* Fullscreen play modal — talker-saved (sequence) sentences play as blocks
          with stepped glow; fluent/legacy sentences keep whole-sentence TTS. */}
      {playTarget && isSequenceRow(playTarget) ? (
        <CompositionPlayModal
          isOpen
          blocks={blocksFromUnits(playTarget.units!, playTarget.authoredLanguage ?? DEFAULT_LOCALE)}
          voiceId={voiceId}
          onClose={() => setPlayTarget(null)}
        />
      ) : (
        <SentencePlayModal
          isOpen={playTarget !== null}
          sentenceText={
            playTarget
              ? ((typeof playTarget.text === 'string'
                  ? playTarget.text
                  : displayString(playTarget.text, language, DEFAULT_LOCALE)) ||
                displayString(playTarget.name, language, DEFAULT_LOCALE))
              : ''
          }
          slots={playTarget?.slots ?? []}
          recordedAudioPath={playTarget?.recordedAudioPath}
          voiceId={voiceId}
          // Fluent sentences resolve text against the board language; pass the
          // locale it actually landed on so the voice follows it (3e) when a
          // sentence falls back to English on a non-English board.
          textLocale={
            playTarget
              ? (typeof playTarget.text === 'string'
                  ? DEFAULT_LOCALE
                  : resolvedLocale(playTarget.text ?? playTarget.name, language, DEFAULT_LOCALE))
              : undefined
          }
          moduleColour={folderDoc?.colour}
          onClose={() => setPlayTarget(null)}
        />
      )}

    </div>
  );
}
