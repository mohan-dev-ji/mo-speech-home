"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Folder as FolderIcon, Trash2, Move } from 'lucide-react';
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
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { CreateGroupModal } from '@/app/components/app/shared/modals/CreateGroupModal';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { getCategoryColour } from '@/app/lib/categoryColours';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/app/components/app/shared/ui/Dialog';

const GROUPS_GRID_CLASSES = {
  large: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  medium: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6',
  small: 'grid-cols-3 md:grid-cols-6 lg:grid-cols-8',
} as const;

const UNGROUPED_COLOUR = '#6B7280';

// ─── Sortable group tile ────────────────────────────────────────────────────────

type GroupTileProps = {
  folder: Doc<'profileFolders'>;
  count: number;
  language: string;
  isEditing: boolean;
  onOpen: () => void;
  onRename: (id: Id<'profileFolders'>, value: string) => void;
  onDeleteRequest: (id: Id<'profileFolders'>, name: string, count: number) => void;
};

function SortableGroupTile({
  folder, count, language, isEditing,
  onOpen, onRename, onDeleteRequest,
}: GroupTileProps) {
  const t = useTranslations('lists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder._id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };
  const name = displayString(folder.name, language, DEFAULT_LOCALE);
  const colourPair = getCategoryColour(folder.colour ?? UNGROUPED_COLOUR);
  const Tag = isEditing ? ('div' as const) : ('button' as const);

  // Inline title editing — dashed box in edit mode, commit on blur/Enter.
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename(folder._id, v);
    else setDraft(name);
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Tag
        {...(!isEditing && { type: 'button', onClick: onOpen })}
        className={[
          'relative w-full @container flex flex-col items-center justify-center text-center',
          'gap-theme-gap p-theme-folder rounded-theme-card border-2 border-dashed',
          isEditing ? 'border-theme-enter-mode' : 'border-transparent cursor-pointer group transition-opacity hover:opacity-90',
        ].join(' ')}
        style={{ backgroundColor: `color-mix(in srgb, ${colourPair.c500} 30%, transparent)` }}
      >
        {isEditing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={t('renameGroup')}
            className="w-full text-center text-theme-alt-text font-normal leading-tight rounded-theme-sm px-2 py-1 outline-none"
            style={{ fontSize: 'clamp(0.875rem, 6cqi, 1.25rem)', background: 'transparent', border: '2px dashed var(--theme-enter-mode)' }}
          />
        ) : (
          <p className="w-full text-center text-theme-alt-text font-normal truncate leading-tight" style={{ fontSize: 'clamp(0.875rem, 6cqi, 1.25rem)' }}>
            {name}
          </p>
        )}

        <div
          className="w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: colourPair.c100, padding: '8cqi' }}
        >
          <FolderIcon className="w-1/2 h-1/2" style={{ color: colourPair.c500 }} />
        </div>

        <p className="text-theme-xs text-theme-secondary-alt-text">{count}</p>

        {isEditing && (
          <EditPanel orientation="horizontal" className="flex-wrap">
            <IconButton
              size="sm"
              variant="neutral"
              className="text-theme-warning"
              icon={<Trash2 />}
              label={t('deleteGroup')}
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(folder._id, name, count); }}
            />
            <IconButton
              size="sm"
              variant="neutral"
              className="cursor-grab active:cursor-grabbing touch-none"
              icon={<Move />}
              label={t('reorderGroup')}
              {...listeners}
              {...attributes}
            />
          </EditPanel>
        )}
      </Tag>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

type PendingDelete = { id: Id<'profileFolders'>; name: string; count: number } | null;

export function ListsGroupsView() {
  const t = useTranslations('lists');
  const { language, stateFlags } = useProfile();
  const { talkerMode } = useTalker();
  const router = useRouter();
  const locale = useParams().locale as string;
  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';

  const folders = useQuery(api.profileFolders.getProfileFolders, { tree: 'lists' });
  const lists = useQuery(api.profileLists.getProfileLists, {});

  const createFolder = useMutation(api.profileFolders.createFolder);
  const renameFolder = useMutation(api.profileFolders.renameFolder);
  const deleteFolder = useMutation(api.profileFolders.deleteFolder);
  const reorderFolders = useMutation(api.profileFolders.reorderFolders);

  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Counts per folder + ungrouped, from the lists query.
  const { countByFolder, ungroupedCount } = useMemo(() => {
    const map = new Map<string, number>();
    let ungrouped = 0;
    for (const l of lists ?? []) {
      if (l.folderId) map.set(l.folderId, (map.get(l.folderId) ?? 0) + 1);
      else ungrouped++;
    }
    return { countByFolder: map, ungroupedCount: ungrouped };
  }, [lists]);

  useEffect(() => {
    if (!folders) return;
    setLocalOrder((prev) => {
      const ids = folders.map((f) => f._id as string);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [folders]);

  const folderMap = Object.fromEntries((folders ?? []).map((f) => [f._id, f]));
  const orderedFolders = localOrder.map((id) => folderMap[id]).filter(Boolean) as Doc<'profileFolders'>[];

  const handleEditToggle = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setIsEditing((v) => !v);
  };
  const handleCreateOpen = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setCreateOpen(true);
  };

  async function handleCreate(name: string) {
    await createFolder({ tree: 'lists', name: { en: name } });
  }

  // Inline rename from a tile's dashed title box. Merge into the folder's
  // localised name so other locales are preserved.
  function handleRename(id: Id<'profileFolders'>, value: string) {
    const folder = folderMap[id];
    if (!folder) return;
    renameFolder({ folderId: id, name: { ...folder.name, [language]: value } });
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteFolder({ folderId: pendingDelete.id });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      reorderFolders({ tree: 'lists', orderedIds: next as Id<'profileFolders'>[] });
      return next;
    });
  }

  const loading = folders === undefined || lists === undefined;
  const showHeaderActions = true; // group CRUD is instructor/admin-side; free-tier gated above

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('groupsTitle')}>
            {showHeaderActions && (
              <>
                <EditButton
                  isEditing={isEditing}
                  onClick={handleEditToggle}
                  editLabel={t('edit')}
                  exitLabel={t('exitEdit')}
                />
                <CreateButton onClick={handleCreateOpen} label={t('createGroup')} />
              </>
            )}
          </PageBanner>
        </div>
      )}

      <div className="flex-1 overflow-auto" data-modelling-content>
        {loading && (
          <div className="flex justify-center py-12">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {!loading && orderedFolders.length === 0 && ungroupedCount === 0 && (
          <p className="text-theme-s text-theme-secondary-alt-text">{t('groupsEmpty')}</p>
        )}

        {!loading && (orderedFolders.length > 0 || ungroupedCount > 0) && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localOrder} strategy={rectSortingStrategy}>
              <div className={`grid gap-3 ${GROUPS_GRID_CLASSES[stateFlags.grid_size ?? 'large']}`}>
                {orderedFolders.map((folder) => (
                  <SortableGroupTile
                    key={folder._id}
                    folder={folder}
                    count={countByFolder.get(folder._id) ?? 0}
                    language={language}
                    isEditing={isEditing}
                    onOpen={() => router.push(`/${locale}/lists/folder/${folder._id}`)}
                    onRename={handleRename}
                    onDeleteRequest={(id, name, count) => setPendingDelete({ id, name, count })}
                  />
                ))}

                {/* Synthetic Ungrouped tile — not editable, always last. */}
                {ungroupedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/lists/folder/ungrouped`)}
                    aria-label={t('openGroup', { name: t('ungrouped') })}
                    className="relative w-full @container flex flex-col items-center justify-center text-center gap-theme-gap p-theme-folder rounded-theme-card border-2 border-transparent cursor-pointer group transition-opacity hover:opacity-90"
                    style={{ backgroundColor: `color-mix(in srgb, ${getCategoryColour(UNGROUPED_COLOUR).c500} 30%, transparent)` }}
                  >
                    <p className="w-full text-center text-theme-alt-text font-normal truncate leading-tight" style={{ fontSize: 'clamp(0.875rem, 6cqi, 1.25rem)' }}>
                      {t('ungrouped')}
                    </p>
                    <div className="w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden" style={{ backgroundColor: getCategoryColour(UNGROUPED_COLOUR).c100, padding: '8cqi' }}>
                      <FolderIcon className="w-1/2 h-1/2" style={{ color: getCategoryColour(UNGROUPED_COLOUR).c500 }} />
                    </div>
                    <p className="text-theme-xs text-theme-secondary-alt-text">{ungroupedCount}</p>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Create group modal — shared design system (CreateGroupModal). */}
      <CreateGroupModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        namespace="lists"
      />

      {/* Delete group confirmation — warns that lists inside are deleted too. */}
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteGroupTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteGroupConfirm', { name: pendingDelete?.name ?? '', count: pendingDelete?.count ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}>
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

      <UpgradeNudge open={upgradeNudgeOpen} onOpenChange={setUpgradeNudgeOpen} locale={locale} />
    </div>
  );
}
