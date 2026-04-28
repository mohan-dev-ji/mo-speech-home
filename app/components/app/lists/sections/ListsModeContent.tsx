"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Pencil, Trash2, Move, Check, X, LogOut } from 'lucide-react';
import { PageBanner } from '@/app/components/shared/PageBanner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { CreateListModal } from '@/app/components/app/lists/modals/CreateListModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/app/components/shared/ui/Dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListRow = {
  _id: Id<'profileLists'>;
  name: { eng: string; hin?: string };
  order: number;
  itemCount: number;
  thumbnails: { imagePath?: string }[];
};

type PendingDelete = { id: Id<'profileLists'>; name: string } | null;

// ─── Thumbnail strip ──────────────────────────────────────────────────────────

function ThumbnailStrip({ thumbnails }: { thumbnails: { imagePath?: string }[] }) {
  const filled = thumbnails.filter((t) => t.imagePath);
  return (
    <div className="flex gap-2 shrink-0">
      {filled.map((t, i) => (
        <div
          key={i}
          className="w-[70px] h-[70px] rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/assets?key=${t.imagePath}`}
            alt=""
            className="max-w-[78%] max-h-[78%] object-contain"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Sortable list row ────────────────────────────────────────────────────────

type SortableListRowProps = {
  list: ListRow;
  language: string;
  isEditing: boolean;
  editingNameId: Id<'profileLists'> | null;
  editingNameValue: string;
  onEditNameStart: (id: Id<'profileLists'>, name: string) => void;
  onEditNameChange: (v: string) => void;
  onEditNameSave: () => void;
  onEditNameCancel: () => void;
  onDeleteRequest: (id: Id<'profileLists'>, name: string) => void;
  onOpen: (id: Id<'profileLists'>) => void;
};

function SortableListRow({
  list, language, isEditing,
  editingNameId, editingNameValue,
  onEditNameStart, onEditNameChange, onEditNameSave, onEditNameCancel,
  onDeleteRequest, onOpen,
}: SortableListRowProps) {
  const t = useTranslations('lists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const name = language === 'hin' && list.name.hin ? list.name.hin : list.name.eng;
  const isEditingThisName = editingNameId === list._id;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="relative flex items-center gap-4 rounded-theme px-4 py-3 cursor-pointer transition-opacity"
        style={{
          background: 'var(--theme-card)',
          outline: isEditing ? '2px dashed var(--theme-enter-mode)' : 'none',
          outlineOffset: '2px',
        }}
        onClick={!isEditing ? () => onOpen(list._id) : undefined}
      >
        <ThumbnailStrip thumbnails={list.thumbnails} />

        <div className="flex-1 min-w-0">
          {isEditingThisName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingNameValue}
                onChange={(e) => onEditNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onEditNameSave();
                  if (e.key === 'Escape') onEditNameCancel();
                }}
                autoFocus
                className="flex-1 px-2 py-1 rounded-theme-sm text-theme-s outline-none"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--theme-text-primary)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <button type="button" onClick={onEditNameSave} className="p-1 rounded" style={{ color: 'var(--theme-success, #22c55e)' }}>
                <Check className="w-4 h-4" />
              </button>
              <button type="button" onClick={onEditNameCancel} className="p-1 rounded" style={{ color: 'var(--theme-text-secondary)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-theme-p font-semibold truncate" style={{ color: 'var(--theme-text-primary)' }}>
              {name}
            </p>
          )}
        </div>

        {isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(list._id, name); }}
              className="p-1.5 rounded transition-colors hover:bg-red-100/10"
              style={{ color: 'var(--theme-warning)' }}
              aria-label={t('rowDelete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditNameStart(list._id, name); }}
              className="p-1.5 rounded transition-colors hover:bg-black/10"
              style={{ color: 'var(--theme-alt-text)' }}
              aria-label={t('rowEdit')}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded cursor-grab active:cursor-grabbing touch-none"
              style={{ color: 'var(--theme-alt-text)' }}
              aria-label={t('rowMove')}
              {...listeners}
              {...attributes}
            >
              <Move className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListsModeContent() {
  const t = useTranslations('lists');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { language, activeProfileId, stateFlags } = useProfile();
  const { talkerMode } = useTalker();

  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingNameId, setEditingNameId] = useState<Id<'profileLists'> | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const profileId = activeProfileId as Id<'studentProfiles'> | undefined;

  const lists = useQuery(
    api.profileLists.getProfileLists,
    profileId ? { profileId } : 'skip'
  );
  const createList = useMutation(api.profileLists.createProfileList);
  const updateListItems = useMutation(api.profileLists.updateProfileListItems);
  const deleteList = useMutation(api.profileLists.deleteProfileList);
  const renameList = useMutation(api.profileLists.updateProfileListName);
  const reorderLists = useMutation(api.profileLists.reorderProfileLists);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!lists) return;
    setLocalOrder((prev) => {
      const serverIds = lists.map((l) => l._id as string);
      const kept = prev.filter((id) => serverIds.includes(id));
      const added = serverIds.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [lists]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !profileId) return;
    setLocalOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      reorderLists({ profileId, orderedIds: next as Id<'profileLists'>[] });
      return next;
    });
  }

  async function handleCreate(name: string, steps: string[]) {
    if (!profileId) return;
    const id = await createList({ profileId, name: { eng: name } });
    const nonEmpty = steps.map((s) => s.trim()).filter(Boolean);
    if (nonEmpty.length > 0) {
      await updateListItems({
        profileListId: id,
        items: nonEmpty.map((description, i) => ({ order: i, description })),
      });
    }
    router.push(`/${locale}/lists/${id}`);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteList({ profileListId: pendingDelete.id });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  async function handleEditNameSave() {
    if (!editingNameId || !editingNameValue.trim()) {
      setEditingNameId(null);
      return;
    }
    await renameList({ profileListId: editingNameId, name: { eng: editingNameValue.trim() } });
    setEditingNameId(null);
  }

  const listMap = Object.fromEntries((lists ?? []).map((l) => [l._id, l]));
  const orderedLists = localOrder.map((id) => listMap[id]).filter(Boolean) as ListRow[];

  return (
    <div className="p-theme-mobile-general md:p-theme-general flex flex-col gap-theme-mobile-gap md:gap-theme-gap">

      {/* Header */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')}>
            {isEditing ? (
              <button
                type="button"
                onClick={() => { setIsEditing(false); setEditingNameId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('exitEdit')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                {t('edit')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('create')}
            </button>
          </PageBanner>
        </div>
      )}

      {lists === undefined && (
        <div className="flex justify-center py-12">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {lists?.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>
            {t('empty')}
          </p>
        </div>
      )}

      {lists && lists.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {orderedLists.map((list) => (
                <SortableListRow
                  key={list._id}
                  list={list}
                  language={language}
                  isEditing={isEditing}
                  editingNameId={editingNameId}
                  editingNameValue={editingNameValue}
                  onEditNameStart={(id, name) => { setEditingNameId(id); setEditingNameValue(name); }}
                  onEditNameChange={setEditingNameValue}
                  onEditNameSave={handleEditNameSave}
                  onEditNameCancel={() => setEditingNameId(null)}
                  onDeleteRequest={(id, name) => setPendingDelete({ id, name })}
                  onOpen={(id) => router.push(`/${locale}/lists/${id}`)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CreateListModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

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
    </div>
  );
}
