"use client";

import { useState, useEffect } from 'react';
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
  Bookmark,
  Library,
  Move,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { useToast } from '@/app/components/app/shared/ui/Toast';
import { ToggleButton } from '@/app/components/app/shared/ui/ToggleButton';
import { PlanTierPicker } from '@/app/components/app/shared/ui/PlanTierPicker';
import { PackStatusLabel } from '@/app/components/app/shared/ui/packStatusBadge';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { AdminPackEditingBanner } from '@/app/components/app/shared/ui/AdminPackEditingBanner';
import { CreateSentenceModal } from '@/app/components/app/sentences/modals/CreateSentenceModal';
import { SentenceAudioModal } from '@/app/components/app/sentences/modals/SentenceAudioModal';
import { SentencePlayModal } from '@/app/components/app/sentences/modals/SentencePlayModal';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import type { SentenceSlotSaveResult } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import {
  LibraryPackPickerModal,
  type PackPickerTarget,
} from '@/app/components/app/shared/modals/LibraryPackPickerModal';
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
  name: { eng: string; hin?: string };
  order: number;
  text?: string;
  audioPath?: string;
  slots: Slot[];
  publishedToPackId?: Id<'resourcePacks'>;
};

type AdminPacksStatus = {
  starterPackId: Id<'resourcePacks'> | null;
  libraryPacksById: Record<
    string,
    { tier: 'free' | 'pro' | 'max'; name: { eng: string; hin?: string } }
  >;
};

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
  // new array index and forwards to `updateProfileSentenceSlots` with
  // `propagateToPack` set per current viewMode.
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

// ─── Sortable sentence row ────────────────────────────────────────────────────

type SortableSentenceRowProps = {
  sentence: SentenceRow;
  language: string;
  isEditing: boolean;
  onDeleteRequest: (id: Id<'profileSentences'>, name: string) => void;
  onEditSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onRemoveSlot: (sentenceId: Id<'profileSentences'>, slotIndex: number) => void;
  onAddSlot: (sentenceId: Id<'profileSentences'>) => void;
  onReorderSlots: (sentenceId: Id<'profileSentences'>, nextSlots: Slot[]) => void;
  onEditSentence: (sentence: SentenceRow) => void;
  onPlay: (sentence: SentenceRow) => void;
  // Admin-only per-row affordances. Parent gates on viewMode === 'admin' && useIsAdmin().
  // Pack-membership status is parameterised so the row toggle UI can reflect
  // current state and the toggle handler knows which way to flip.
  showAdminButtons?: boolean;
  isDefault?: boolean;
  isInLibrary?: boolean;
  libraryTier?: 'free' | 'pro' | 'max';
  onToggleDefault?: (sentence: SentenceRow) => void;
  onToggleLibrary?: (sentence: SentenceRow) => void;
  onSetTier?: (sentence: SentenceRow, tier: 'free' | 'pro' | 'max') => void;
  // Pack-status data — only passed in admin viewMode. Drives the
  // PackStatusLabel pill on the right edge of the sentence text row.
  adminPacks?: AdminPacksStatus;
};

function SortableSentenceRow({
  sentence, language, isEditing,
  onDeleteRequest,
  onEditSlot, onRemoveSlot, onAddSlot, onReorderSlots,
  onEditSentence, onPlay,
  showAdminButtons = false,
  isDefault = false,
  isInLibrary = false,
  libraryTier = 'free',
  onToggleDefault,
  onToggleLibrary,
  onSetTier,
  adminPacks,
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

  const name = language === 'hin' && sentence.name.hin ? sentence.name.hin : sentence.name.eng;
  const sentenceText = sentence.text || name;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex flex-col gap-3 rounded-theme px-4 py-3"
        style={{
          background: 'var(--theme-card)',
          outline: isEditing ? '2px dashed var(--theme-enter-mode)' : 'none',
          outlineOffset: '2px',
          cursor: isEditing ? undefined : 'pointer',
        }}
        onClick={isEditing ? undefined : () => onPlay(sentence)}
        role={isEditing ? undefined : 'button'}
        aria-label={isEditing ? undefined : t('rowPlay')}
      >
        <div className="flex items-center gap-4">

          {/* Symbol preview area */}
          <div className="shrink-0" onClick={isEditing ? undefined : (e) => e.stopPropagation()}>
            {isEditing ? (
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
            ) : (
              <ThumbnailStrip slots={sentence.slots} />
            )}
          </div>

          {/* Sentence text — grows to fill the outer row, pushing the
              pack-status label (and the edit-mode action cluster) to the
              right edge. */}
          {isEditing ? (
            <button
              type="button"
              onClick={() => onEditSentence(sentence)}
              className="flex-1 min-w-0 px-3 py-2 rounded-theme-sm text-left transition-opacity hover:opacity-80"
              style={{
                border: '1.5px dashed var(--theme-brand-primary)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <p className="text-theme-p font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
                {sentenceText}
              </p>
              {/* Audio-status nudge — visible inside the click area so it
                  doubles as a call to action: "click here to add audio". */}
              {sentence.audioPath ? (
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
            <p className="flex-1 min-w-0 text-theme-p font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
              {sentenceText}
            </p>
          )}

          {/* Admin pack-status label — sits at the right edge of the text
              zone. With the text element grown via flex-1, this is naturally
              flush right in non-edit mode; in edit mode the action cluster
              follows with extra left-margin for visual separation. */}
          {adminPacks && (
            <div className="shrink-0">
              <PackStatusLabel
                publishedToPackId={sentence.publishedToPackId}
                packs={adminPacks}
                language={language}
              />
            </div>
          )}

          {/* Edit mode action buttons — `ml-4` gives visible separation
              from the pack-status label. */}
          {isEditing && (
            <div className="flex items-center gap-1 shrink-0 ml-4">
              {showAdminButtons && (
                <div
                  className="flex items-center gap-1 mr-1 px-1.5 py-1 rounded-theme-sm"
                  style={{
                    background: 'rgba(255,200,0,0.06)',
                    border: '1px solid rgba(255,200,0,0.2)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ToggleButton
                    pressed={isDefault}
                    disabled={isInLibrary}
                    onClick={() => onToggleDefault?.(sentence)}
                    icon={<Bookmark className="w-3.5 h-3.5" />}
                  >
                    {t('toggleDefault')}
                  </ToggleButton>
                  <ToggleButton
                    pressed={isInLibrary}
                    disabled={isDefault}
                    onClick={() => onToggleLibrary?.(sentence)}
                    icon={<Library className="w-3.5 h-3.5" />}
                  >
                    {t('toggleLibrary')}
                  </ToggleButton>
                  {isInLibrary && onSetTier && (
                    <PlanTierPicker
                      value={libraryTier}
                      onChange={(tier) => onSetTier(sentence, tier)}
                      translationNamespace="sentences"
                    />
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteRequest(sentence._id, name); }}
                className="p-1.5 rounded transition-colors hover:bg-red-100/10"
                style={{ color: 'var(--theme-warning)' }}
                aria-label={t('rowDelete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded cursor-grab active:cursor-grabbing touch-none"
                style={{ color: 'var(--theme-alt-text)' }}
                aria-label={t('rowMove')}
                onClick={(e) => e.stopPropagation()}
                {...listeners}
                {...attributes}
              >
                <Move className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SentencesModeContent() {
  const t = useTranslations('sentences');
  const params = useParams();
  const locale = params.locale as string;
  const { language, viewMode, accountId, stateFlags } = useProfile();
  const { talkerMode } = useTalker();
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const showAdminButtons = viewMode === 'admin' && isAdmin;

  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [slotEditTarget, setSlotEditTarget] = useState<SlotEditTarget>(null);
  const [sentenceEditTarget, setSentenceEditTarget] = useState<SentenceEditTarget>(null);
  const [playTarget, setPlayTarget] = useState<SentenceRow | null>(null);
  const [packPickerSentence, setPackPickerSentence] = useState<SentenceRow | null>(null);

  const sentences = useQuery(api.profileSentences.getProfileSentences, {});
  const createSentence   = useMutation(api.profileSentences.createProfileSentence);
  const updateSlots      = useMutation(api.profileSentences.updateProfileSentenceSlots);
  const deleteSentence   = useMutation(api.profileSentences.deleteProfileSentence);
  const reorderSentences = useMutation(api.profileSentences.reorderProfileSentences);
  const setSentenceDefault   = useMutation(api.resourcePacks.setSentenceDefault);
  const setSentenceInLibrary = useMutation(api.resourcePacks.setSentenceInLibrary);
  const setLibraryPackTier   = useMutation(api.resourcePacks.setLibraryPackTier);

  // Pack status — drives the per-row Default/Library toggle pressed states + tier.
  const packsStatus = useQuery(api.resourcePacks.getPacksForAdminStatus, showAdminButtons ? {} : 'skip');
  function statusFor(sentence: SentenceRow) {
    const pid = sentence.publishedToPackId;
    const isDefault = !!(pid && packsStatus && pid === packsStatus.starterPackId);
    const libraryPack = pid && packsStatus ? packsStatus.libraryPacksById[pid] : undefined;
    return {
      isDefault,
      isInLibrary: !!libraryPack,
      libraryTier: libraryPack?.tier ?? ('free' as const),
    };
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!sentences) return;
    setLocalOrder((prev) => {
      const serverIds = sentences.map((s) => s._id as string);
      const kept = prev.filter((id) => serverIds.includes(id));
      const added = serverIds.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [sentences]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      reorderSentences({ orderedIds: next as Id<'profileSentences'>[], propagateToPack: showAdminButtons });
      return next;
    });
  }

  async function handleCreate(name: string) {
    await createSentence({ name: { eng: name } });
    // Drop straight into edit mode so the new sentence's empty slots and
    // audio affordances are visible immediately — same pattern as list
    // creation, just no navigation since sentences live inline on this page.
    setIsEditing(true);
  }

  async function handleToggleDefault(sentence: SentenceRow) {
    const { isDefault } = statusFor(sentence);
    try {
      await setSentenceDefault({ profileSentenceId: sentence._id, on: !isDefault });
      showToast({
        tone: 'info',
        title: !isDefault ? t('toastDefaultOn') : t('toastDefaultOff'),
      });
    } catch (e) {
      console.error('[SentencesModeContent] toggle default failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
  }

  async function handleToggleLibrary(sentence: SentenceRow) {
    const { isInLibrary } = statusFor(sentence);
    if (isInLibrary) {
      try {
        await setSentenceInLibrary({ profileSentenceId: sentence._id, on: false });
        showToast({ tone: 'info', title: t('toastLibraryOff') });
      } catch (e) {
        console.error('[SentencesModeContent] toggle library off failed', e);
        showToast({ tone: 'warning', title: t('toastAdminError') });
      }
      return;
    }
    setPackPickerSentence(sentence);
  }

  async function handlePackPickerConfirm(target: PackPickerTarget) {
    if (!packPickerSentence) return;
    try {
      await setSentenceInLibrary({
        profileSentenceId: packPickerSentence._id,
        on: true,
        target,
      });
      showToast({ tone: 'info', title: t('toastLibraryOn') });
    } catch (e) {
      console.error('[SentencesModeContent] save to library failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
      throw e;
    }
  }

  async function handleSetTier(sentence: SentenceRow, tier: 'free' | 'pro' | 'max') {
    if (!sentence.publishedToPackId) return;
    try {
      await setLibraryPackTier({ packId: sentence.publishedToPackId, tier });
      showToast({ tone: 'info', title: t('toastTierUpdated') });
    } catch (e) {
      console.error('[SentencesModeContent] set tier failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteSentence({ profileSentenceId: pendingDelete.id, propagateToPack: showAdminButtons });
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
    updateSlots({ profileSentenceId: sentenceId, slots: updated, propagateToPack: showAdminButtons });
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
      propagateToPack: showAdminButtons,
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
    updateSlots({ profileSentenceId: slotEditTarget.sentenceId, slots: reindexed, propagateToPack: showAdminButtons });
    setSlotEditTarget(null);
  }

  const sentenceMap = Object.fromEntries((sentences ?? []).map((s) => [s._id, s]));
  const orderedSentences = localOrder.map((id) => sentenceMap[id]).filter(Boolean) as SentenceRow[];

  const slotEditorSentence = slotEditTarget
    ? sentences?.find((s) => s._id === slotEditTarget.sentenceId)
    : undefined;

  const existingSlotImagePath =
    slotEditTarget && slotEditTarget.slotIndex >= 0
      ? slotEditorSentence?.slots[slotEditTarget.slotIndex]?.imagePath
      : undefined;

  // Only render sentences page if state flag allows it (same pattern as lists)
  if (stateFlags && !stateFlags.sentences_visible) return null;

  // Show the admin disclaimer when at least one sentence on this page is
  // published to a pack — admin in admin view editing those sentences will
  // propagate to the pack.
  const hasPublishedSentence = !!sentences?.some((s) => !!s.publishedToPackId);

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      <AdminPackEditingBanner
        visible={showAdminButtons && hasPublishedSentence}
      />

      {/* Header — banner + talker stay fixed at the top of the viewport
          while the rows below scroll. Mirrors the categories listing. */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')}>
            <EditButton
              isEditing={isEditing}
              onClick={() => setIsEditing(!isEditing)}
              editLabel={t('edit')}
              exitLabel={t('exitEdit')}
            />
            <CreateButton
              onClick={() => setCreateModalOpen(true)}
              label={t('create')}
            />
          </PageBanner>
        </div>
      )}

      {/* Scrollable content area — banner above + modals below stay in
          their own non-scrolling slots. */}
      <div className="flex-1 overflow-auto">
        {sentences === undefined && (
          <div className="flex justify-center py-12">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {sentences?.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>
              {t('empty')}
            </p>
          </div>
        )}

        {sentences && sentences.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {orderedSentences.map((sentence) => {
                  const status = statusFor(sentence);
                  return (
                    <SortableSentenceRow
                      key={sentence._id}
                      sentence={sentence}
                      language={language}
                      isEditing={isEditing}
                      onDeleteRequest={(id, name) => setPendingDelete({ id, name })}
                      onEditSlot={handleEditSlot}
                      onRemoveSlot={handleRemoveSlot}
                      onAddSlot={handleAddSlot}
                      onReorderSlots={handleReorderSlots}
                      onEditSentence={(s) => setSentenceEditTarget({
                        sentenceId: s._id,
                        value: s.text || (language === 'hin' && s.name.hin ? s.name.hin : s.name.eng),
                        audioPath: s.audioPath,
                      })}
                      onPlay={(s) => setPlayTarget(s)}
                      showAdminButtons={showAdminButtons}
                      isDefault={status.isDefault}
                      isInLibrary={status.isInLibrary}
                      libraryTier={status.libraryTier}
                      onToggleDefault={handleToggleDefault}
                      onToggleLibrary={handleToggleLibrary}
                      onSetTier={handleSetTier}
                      adminPacks={showAdminButtons && packsStatus ? packsStatus : undefined}
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

      {/* Slot symbol editor */}
      {slotEditTarget && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          editorMode="sentenceSlot"
          initialImagePath={existingSlotImagePath}
          onClose={() => setSlotEditTarget(null)}
          onSave={() => {}}
          onSentenceSlotSave={handleSlotSave}
        />
      )}

      {/* Audio editor */}
      {sentenceEditTarget && accountId && (
        <SentenceAudioModal
          isOpen
          sentenceId={sentenceEditTarget.sentenceId}
          accountId={accountId}
          initialValue={sentenceEditTarget.value}
          initialAudioPath={sentenceEditTarget.audioPath}
          onClose={() => setSentenceEditTarget(null)}
        />
      )}

      {/* Fullscreen play modal */}
      <SentencePlayModal
        isOpen={playTarget !== null}
        sentenceText={playTarget ? (playTarget.text || (language === 'hin' && playTarget.name.hin ? playTarget.name.hin : playTarget.name.eng)) : ''}
        slots={playTarget?.slots ?? []}
        audioPath={playTarget?.audioPath}
        onClose={() => setPlayTarget(null)}
      />

      {/* Make Default + Library are now toggle buttons in each row's edit
          action group — no confirmation dialog needed. */}

      {/* Library save dialogue — admin-only. Opens when toggling a sentence's
          Library button ON; pick or create the target pack. */}
      {showAdminButtons && (
        <LibraryPackPickerModal
          isOpen={packPickerSentence !== null}
          onClose={() => setPackPickerSentence(null)}
          itemKind="sentence"
          defaultName={
            packPickerSentence
              ? language === 'hin' && packPickerSentence.name.hin
                ? packPickerSentence.name.hin
                : packPickerSentence.name.eng
              : ''
          }
          onConfirm={handlePackPickerConfirm}
        />
      )}
    </div>
  );
}
