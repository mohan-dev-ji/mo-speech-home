"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { ImageIcon } from 'lucide-react';
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
} from '@dnd-kit/sortable';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { CreateGroupModal } from '@/app/components/app/shared/modals/CreateGroupModal';
import { GroupTile } from '@/app/components/app/shared/ui/GroupTile';
import { ModuleClassBadge } from '@/app/components/app/shared/ui/ModuleClassBadge';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { useToast } from '@/app/components/app/shared/ui/Toast';
import { track } from '@/lib/analytics';
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

type FolderedTree = 'lists' | 'sentences';
type PendingDelete = {
  id: Id<'profileFolders'>;
  name: string;
  count: number;
  source?: string;
  librarySourceId?: string;
} | null;
type ImageTarget = { id: Id<'profileFolders'>; name: string; imagePath?: string } | null;

/**
 * Shared groups grid (ADR-014) for the Lists and Sentences trees — the single
 * component behind List Groups and Sentence Groups. Renders the shared
 * `GroupTile` for each user folder (create / rename / delete / reorder / colour
 * / folder-image in edit mode), plus a synthetic, non-editable "Ungrouped"
 * tile. Parameterised by `tree` + `namespace` (their group copy lives in the
 * matching i18n namespace).
 */
export function GroupsView({
  tree,
  namespace,
}: {
  tree: FolderedTree;
  namespace: FolderedTree;
}) {
  const t = useTranslations(namespace);
  const tGroup = useTranslations('group');
  const { language, stateFlags, viewMode, accountId, voiceId } = useProfile();
  const router = useRouter();
  const locale = useParams().locale as string;
  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';
  const isAdmin = useIsAdmin();
  const showPublish = viewMode === 'admin' && isAdmin;
  const { showToast } = useToast();

  const folders = useQuery(api.profileFolders.getProfileFolders, { tree });
  // Item counts feed the delete-confirmation copy only. Query the matching
  // tree's items; the other stays skipped.
  const lists = useQuery(api.profileLists.getProfileLists, tree === 'lists' ? {} : 'skip');
  const sentences = useQuery(api.profileSentences.getProfileSentences, tree === 'sentences' ? {} : 'skip');
  const items = tree === 'lists' ? lists : sentences;

  const createFolder = useMutation(api.profileFolders.createFolder);
  const renameFolder = useMutation(api.profileFolders.renameFolder);
  const updateFolderMeta = useMutation(api.profileFolders.updateFolderMeta);
  const deleteFolder = useMutation(api.profileFolders.deleteFolder);
  const reorderFolders = useMutation(api.profileFolders.reorderFolders);

  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageTarget, setImageTarget] = useState<ImageTarget>(null);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { countByFolder, ungroupedCount } = useMemo(() => {
    const map = new Map<string, number>();
    let ungrouped = 0;
    for (const it of items ?? []) {
      if (it.folderId) map.set(it.folderId, (map.get(it.folderId) ?? 0) + 1);
      else ungrouped++;
    }
    return { countByFolder: map, ungroupedCount: ungrouped };
  }, [items]);

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
    // Key by the board language you're authoring in (ADR-016 Addendum D — names
    // never auto-translate; the translate icon fills other languages on demand).
    await createFolder({ tree, name: { [language]: name } });
  }

  function handleRename(id: Id<'profileFolders'>, value: string) {
    const folder = folderMap[id];
    if (!folder) return;
    renameFolder({ folderId: id, name: { ...folder.name, [language]: value } });
  }

  function handleRecolour(id: Id<'profileFolders'>, key: string) {
    updateFolderMeta({ folderId: id, colour: key });
  }

  function handleFolderImageSave(imagePath: string) {
    if (!imageTarget) return;
    updateFolderMeta({ folderId: imageTarget.id, imagePath });
    setImageTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.source === 'module' && pendingDelete.librarySourceId) {
        // Module-sourced folder → uninstall the module via the route (cascade
        // delete + R2 orphan cleanup), not the plain folder delete. This is the
        // in-app home for uninstall (ADR-014 §5, owner decision 2026-06-28).
        const res = await fetch('/api/uninstall-content-module', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tree, slug: pendingDelete.librarySourceId }),
        });
        if (!res.ok) throw new Error('uninstall failed');
        track('module_uninstalled', { slug: pendingDelete.librarySourceId, tree });
      } else {
        await deleteFolder({ folderId: pendingDelete.id });
      }
      setPendingDelete(null);
    } catch {
      showToast({ tone: 'warning', title: tGroup('uninstallError') });
    } finally {
      setIsDeleting(false);
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
      reorderFolders({ tree, orderedIds: next as Id<'profileFolders'>[] });
      return next;
    });
  }

  const loading = folders === undefined || items === undefined;

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">
      {stateFlags.talker_visible && (
        <div className="shrink-0">
          <PageBanner title={t('groupsTitle')}>
            <EditButton
              isEditing={isEditing}
              onClick={handleEditToggle}
              editLabel={t('edit')}
              exitLabel={t('exitEdit')}
            />
            <CreateButton onClick={handleCreateOpen} label={t('createGroup')} />
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
                {orderedFolders.map((folder) => {
                  const name = displayString(folder.name, language, DEFAULT_LOCALE);
                  return (
                    <GroupTile
                      key={folder._id}
                      id={folder._id}
                      name={name}
                      colour={folder.colour}
                      imagePath={folder.imagePath}
                      isEditing={isEditing}
                      gridSize={stateFlags.grid_size ?? 'large'}
                      badgeSlot={
                        showPublish ? (
                          <ModuleClassBadge publishedClass={folder.publishedModuleClass} />
                        ) : undefined
                      }
                      nameRecord={folder.name}
                      language={language}
                      onOpen={() => router.push(`/${locale}/${tree}/folder/${folder._id}`)}
                      onRename={(value) => handleRename(folder._id, value)}
                      onRecolour={(key) => handleRecolour(folder._id, key)}
                      onEditImage={() => setImageTarget({ id: folder._id, name, imagePath: folder.imagePath })}
                      onDeleteRequest={() => setPendingDelete({ id: folder._id, name, count: countByFolder.get(folder._id) ?? 0, source: folder.source, librarySourceId: folder.librarySourceId })}
                    />
                  );
                })}

                {/* Synthetic Ungrouped tile — not editable, always last. Mirrors
                    GroupTile's view-mode look (same ImageIcon fallback). */}
                {ungroupedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/${tree}/folder/ungrouped`)}
                    aria-label={t('openGroup', { name: t('ungrouped') })}
                    className="relative w-full @container flex flex-col items-center justify-center text-center gap-theme-gap p-theme-folder rounded-theme-card border-2 border-transparent cursor-pointer group transition-opacity hover:opacity-90"
                    style={{ backgroundColor: `color-mix(in srgb, ${getCategoryColour(UNGROUPED_COLOUR).c500} 30%, transparent)` }}
                  >
                    <p className="w-full text-center text-theme-alt-text font-normal truncate leading-tight" style={{ fontSize: 'clamp(0.875rem, 6cqi, 1.25rem)' }}>
                      {t('ungrouped')}
                    </p>
                    <div className="w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden" style={{ backgroundColor: getCategoryColour(UNGROUPED_COLOUR).c100, padding: '8cqi' }}>
                      <ImageIcon className="w-1/2 h-1/2" style={{ color: getCategoryColour(UNGROUPED_COLOUR).c500 }} />
                    </div>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <CreateGroupModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        namespace={namespace}
      />

      {/* Folder image picker — Symbol Editor restricted to image picking. */}
      {imageTarget && accountId && (
        <SymbolEditorModal
          isOpen={true}
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          folderImageMode={true}
          initialImagePath={imageTarget.imagePath}
          initialLabel={imageTarget.name}
          onClose={() => setImageTarget(null)}
          onSave={() => {}}
          onFolderImageSave={handleFolderImageSave}
        />
      )}

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
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}>
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
