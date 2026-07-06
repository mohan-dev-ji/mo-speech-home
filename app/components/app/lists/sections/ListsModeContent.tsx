"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
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
import { Pencil, Trash2, Move, Check, X, FolderInput, Upload } from 'lucide-react';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { Button } from '@/app/components/app/shared/ui/Button';
import { PublishModuleModal } from '@/app/components/app/shared/modals/PublishModuleModal';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { AdminPackEditingBanner } from '@/app/components/app/shared/ui/AdminPackEditingBanner';
import { PackFilterDropdown, type PackFilterOption } from '@/app/components/app/shared/ui/PackFilterDropdown';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { PackStatusLabel } from '@/app/components/app/shared/ui/packStatusBadge';
import { LibrarySourceBadge } from '@/app/components/app/categories/ui/LibrarySourceBadge';
import { resolvePackName } from '@/lib/packs/resolvePackName';
import { CreateListModal } from '@/app/components/app/lists/modals/CreateListModal';
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

type ListRow = {
  _id: Id<'profileLists'>;
  name: Record<string, string>;
  order: number;
  itemCount: number;
  thumbnails: { imagePath?: string }[];
  publishedToPackId?: Id<'resourcePacks'>;
  packSlug?: string;
  librarySourceId?: string;
  folderId?: Id<'profileFolders'>;
};

type AdminPacksStatus = {
  starterSlug: string;
  libraryPacksBySlug: Record<
    string,
    { tier: 'free' | 'pro' | 'max'; name: Record<string, string> }
  >;
};

type PendingDelete = { id: Id<'profileLists'>; name: string } | null;

// ─── Thumbnail strip ──────────────────────────────────────────────────────────

function ThumbnailStrip({
  thumbnails,
  itemCount,
}: {
  thumbnails: { imagePath?: string }[];
  itemCount: number;
}) {
  const filled = thumbnails.filter((t) => t.imagePath);
  // Overflow indicator: query caps thumbnails at 4 — anything beyond that
  // shows a subtle "…" sitting flush with the bottom of the last symbol
  // card, no chrome or background of its own.
  const hasOverflow = itemCount > thumbnails.length;
  return (
    <div className="flex items-end gap-2 shrink-0">
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
      {hasOverflow && (
        <span
          className="text-theme-p font-bold leading-none pb-1 shrink-0"
          style={{ color: 'var(--theme-secondary-text)' }}
          aria-label={`${itemCount - thumbnails.length} more`}
        >
          …
        </span>
      )}
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
  onMoveRequest: (id: Id<'profileLists'>, name: string) => void;
  onOpen: (id: Id<'profileLists'>) => void;
  adminPacks?: AdminPacksStatus;
};

function SortableListRow({
  list, language, isEditing,
  editingNameId, editingNameValue,
  onEditNameStart, onEditNameChange, onEditNameSave, onEditNameCancel,
  onDeleteRequest, onMoveRequest, onOpen,
  adminPacks,
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

  const name = displayString(list.name, language, DEFAULT_LOCALE);
  const isEditingThisName = editingNameId === list._id;

  return (
    <div ref={setNodeRef} style={style}>
      {/* Figma List-strip / List-strip-edit (`3025:2324`): `card` strip, edit adds
          a stroke-2 dashed border + the Edit-panel on the right. `flex-wrap` keeps
          the strip within the content width — the right cluster drops to a new
          line (grows on Y) instead of overflowing horizontally. */}
      <div
        className={[
          'relative flex flex-wrap items-center gap-3 md:gap-4 rounded-theme-card px-theme-general py-theme-item transition-colors',
          'border-2 border-dashed',
          isEditing ? 'border-theme-enter-mode' : 'border-transparent cursor-pointer',
        ].join(' ')}
        style={{ background: 'var(--group-card, var(--theme-card))' }}
        onClick={!isEditing ? () => onOpen(list._id) : undefined}
      >
        <ThumbnailStrip thumbnails={list.thumbnails} itemCount={list.itemCount} />

        {/* Meta row — title (grows), then the right cluster (badge + edit-panel).
            No `min-w-0` here: the meta keeps its min-content width so it wraps
            below the thumbnails (grows Y) instead of overflowing horizontally. */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex-1 min-w-[8rem]">
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

          {/* Right cluster — origin badge + admin status + edit-panel. `ml-auto`
              right-aligns it; it wraps below the title as a unit when narrow. */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {/* Origin badge — everyone sees which pack this list is from. */}
            {list.librarySourceId && (
              <LibrarySourceBadge
                packName={resolvePackName(list.librarySourceId, language)}
              />
            )}

            {adminPacks && (
              <PackStatusLabel
                packSlug={list.librarySourceId}
                packs={adminPacks}
                language={language}
              />
            )}

            {isEditing && (
              <EditPanel className="flex-wrap">
                <IconButton
                  size="sm"
                  variant="neutral"
                  className="text-theme-warning"
                  icon={<Trash2 />}
                  label={t('rowDelete')}
                  onClick={(e) => { e.stopPropagation(); onDeleteRequest(list._id, name); }}
                />
                <IconButton
                  size="sm"
                  variant="neutral"
                  icon={<Pencil />}
                  label={t('rowEdit')}
                  onClick={(e) => { e.stopPropagation(); onEditNameStart(list._id, name); }}
                />
                <IconButton
                  size="sm"
                  variant="neutral"
                  icon={<FolderInput />}
                  label={t('moveToGroup')}
                  onClick={(e) => { e.stopPropagation(); onMoveRequest(list._id, name); }}
                />
                <IconButton
                  size="sm"
                  variant="neutral"
                  className="cursor-grab active:cursor-grabbing touch-none"
                  icon={<Move />}
                  label={t('rowMove')}
                  {...listeners}
                  {...attributes}
                />
              </EditPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListsModeContent({ folderId }: { folderId?: string } = {}) {
  const t = useTranslations('lists');
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { language, stateFlags, viewMode } = useProfile();
  const { setBreadcrumbExtra } = useBreadcrumb();
  const isAdmin = useIsAdmin();
  const showAdminBadges = viewMode === 'admin' && isAdmin;
  const adminPacks = useQuery(
    api.resourcePacks.getPacksForAdminStatusV2,
    showAdminBadges ? {} : 'skip',
  );
  const loadedPacks = useQuery(
    api.resourcePacks.getLoadedPacksForCurrentAccount,
    showAdminBadges ? 'skip' : {},
  );

  // ── Pack filter — URL state via ?pack=<value> ────────────────────────────
  const packFilter = searchParams.get('pack') ?? 'all';
  function setPackFilter(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all') next.delete('pack');
    else next.set('pack', value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';
  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // Free-tier intercepts. Gating the Edit toggle cascades — free users
  // can't enter edit mode, so rename / delete / reorder rows are all
  // unreachable.
  const handleEditToggle = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    if (isEditing) setEditingNameId(null);
    setIsEditing(!isEditing);
  };
  const handleCreateOpen = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setCreateModalOpen(true);
  };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editingNameId, setEditingNameId] = useState<Id<'profileLists'> | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const lists = useQuery(api.profileLists.getProfileLists, {});
  const createList = useMutation(api.profileLists.createProfileList);
  const updateListItems = useMutation(api.profileLists.updateProfileListItems);
  const deleteList = useMutation(api.profileLists.deleteProfileList);
  const renameList = useMutation(api.profileLists.updateProfileListName);
  const reorderLists = useMutation(api.profileLists.reorderProfileLists);
  const moveListToGroup = useMutation(api.profileFolders.moveListToGroup);

  // ── Folder scoping (ADR-014 §2) ──────────────────────────────────────────
  // Rendered under /lists/folder/[folderId]; show only that group's lists.
  // "ungrouped" = lists with no folder. (The /lists root is the groups view.)
  const isUngrouped = folderId === 'ungrouped';
  const realFolderId =
    folderId && !isUngrouped ? (folderId as Id<'profileFolders'>) : undefined;
  const folderDoc = useQuery(
    api.profileFolders.getProfileFolder,
    realFolderId ? { folderId: realFolderId } : 'skip',
  );
  const scopedLists = useMemo(() => {
    if (!lists || !folderId) return lists;
    return lists.filter((l) =>
      isUngrouped ? !l.folderId : l.folderId === realFolderId,
    );
  }, [lists, folderId, isUngrouped, realFolderId]);

  // Breadcrumb: Lists › <group>
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

  // Group colour tint (ADR-014) — colour-codes the whole group view (banner +
  // list cards) at the category-detail banner opacity. Exposed as `--group-card`
  // on the root; surfaces read `var(--group-card, var(--theme-card))`. Unset for
  // Ungrouped / colourless folders, so those fall back to the plain card.
  const groupTint = folderDoc?.colour
    ? `color-mix(in srgb, ${getCategoryColour(folderDoc.colour).c500} 30%, transparent)`
    : undefined;

  // Move-to-group dialog state. `moveSelection` is the chosen destination:
  // a folder id, 'ungrouped', or null (nothing chosen yet).
  const [moveTarget, setMoveTarget] = useState<{ id: Id<'profileLists'>; name: string } | null>(null);
  const [moveSelection, setMoveSelection] = useState<Id<'profileFolders'> | 'ungrouped' | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const groups = useQuery(api.profileFolders.getProfileFolders, { tree: 'lists' });

  async function handleMoveConfirm() {
    if (!moveTarget || !moveSelection) return;
    setIsMoving(true);
    try {
      await moveListToGroup({
        listId: moveTarget.id,
        folderId: moveSelection === 'ungrouped' ? null : moveSelection,
      });
      setMoveTarget(null);
      setMoveSelection(null);
    } finally {
      setIsMoving(false);
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!scopedLists) return;
    setLocalOrder((prev) => {
      const serverIds = scopedLists.map((l) => l._id as string);
      const kept = prev.filter((id) => serverIds.includes(id));
      const added = serverIds.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [scopedLists]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalOrder((prev) => {
      const visible = packFilter === 'all'
        ? prev
        : prev.filter((id) => filteredOrder.includes(id));
      const oldVisIdx = visible.indexOf(active.id as string);
      const newVisIdx = visible.indexOf(over.id as string);
      if (oldVisIdx < 0 || newVisIdx < 0) return prev;
      const reorderedVisible = arrayMove(visible, oldVisIdx, newVisIdx);

      const visibleSet = new Set(visible);
      let v = 0;
      const next = prev.map((id) => visibleSet.has(id) ? reorderedVisible[v++] : id);

      reorderLists({
        orderedIds: next as Id<'profileLists'>[],
        propagateToPack: showAdminBadges,
      });
      return next;
    });
  }

  async function handleCreate(name: string, steps: string[]) {
    const id = await createList({
      name: { en: name },
      ...(realFolderId ? { folderId: realFolderId } : {}),
    });
    const nonEmpty = steps.map((s) => s.trim()).filter(Boolean);
    if (nonEmpty.length > 0) {
      await updateListItems({
        profileListId: id,
        items: nonEmpty.map((description, i) => ({ order: i, description })),
        propagateToPack: showAdminBadges,
      });
    }
    // ?edit=1 lands the detail page in edit mode so the new symbol slots
    // are immediately visible — nudges the user to pick imagery for the
    // descriptions they just typed.
    router.push(`/${locale}/lists/${id}?edit=1`);
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteList({
        profileListId: pendingDelete.id,
        propagateToPack: showAdminBadges,
      });
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
    await renameList({
      profileListId: editingNameId,
      name: { en: editingNameValue.trim() },
      propagateToPack: showAdminBadges,
    });
    setEditingNameId(null);
  }

  const listMap = Object.fromEntries((scopedLists ?? []).map((l) => [l._id, l]));
  const orderedLists = localOrder.map((id) => listMap[id]).filter(Boolean) as ListRow[];

  // ── Filter visibility + options ──────────────────────────────────────────
  const filterVisible = showAdminBadges
    ? !!adminPacks && (
        !!adminPacks.starterSlug ||
        Object.keys(adminPacks.libraryPacksBySlug).length > 0
      )
    : (viewMode === 'student-view' ? stateFlags.student_can_filter : true)
      && !!loadedPacks && loadedPacks.length > 0;

  const filterOptions: PackFilterOption[] = useMemo(() => {
    if (!filterVisible) return [];
    const opts: PackFilterOption[] = [{ value: 'all', label: t('filterAll') }];
    if (showAdminBadges && adminPacks) {
      if (adminPacks.starterSlug) opts.push({ value: 'default', label: t('filterDefault') });
      for (const [slug, pack] of Object.entries(adminPacks.libraryPacksBySlug)) {
        opts.push({
          value: slug,
          label: displayString(pack.name, language, DEFAULT_LOCALE),
        });
      }
      opts.push({ value: 'unpublished', label: t('filterUnpublished') });
    } else if (loadedPacks) {
      for (const pack of loadedPacks) {
        opts.push({
          value: pack._id,
          label: displayString(pack.name, language, DEFAULT_LOCALE),
        });
      }
      opts.push({ value: 'mine', label: t('filterMine') });
    }
    return opts;
  }, [filterVisible, showAdminBadges, adminPacks, loadedPacks, language, t]);

  // ── Apply filter ─────────────────────────────────────────────────────────
  const filteredOrder = useMemo(() => {
    if (packFilter === 'all') return localOrder;
    return localOrder.filter((id) => {
      const row = listMap[id];
      if (!row) return false;
      if (showAdminBadges) {
        // Post-simplification: filters use librarySourceId (single field).
        if (packFilter === 'default') return row.librarySourceId === adminPacks?.starterSlug;
        if (packFilter === 'unpublished') return !row.librarySourceId;
        return row.librarySourceId === packFilter;
      } else {
        if (packFilter === 'mine') return !row.librarySourceId;
        return row.librarySourceId === packFilter;
      }
    });
  }, [packFilter, localOrder, listMap, showAdminBadges, adminPacks?.starterSlug]);

  const filteredLists = filteredOrder.map((id) => listMap[id]).filter(Boolean) as ListRow[];

  // Admin-view reminder: any list on screen that's published means
  // reorder / rename / delete here propagates to the live pack.
  const hasPublishedList = !!scopedLists?.some((l) => !!l.librarySourceId);

  return (
    <div
      className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap"
      style={groupTint ? ({ '--group-card': groupTint } as React.CSSProperties) : undefined}
    >

      <AdminPackEditingBanner visible={showAdminBadges && hasPublishedList} />

      {/* Header — permanent banner: the talker never replaces it on this page,
          so it shows in both talker and banner modes (gated only on the header
          on/off flag). Stays fixed at the top while the rows below scroll. */}
      {stateFlags.talker_visible && (
        <div className="shrink-0">
          <PageBanner
            title={folderId ? folderName : t('title')}
            backHref={folderId ? `/${locale}/lists` : undefined}
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
            {filterVisible && (
              <PackFilterDropdown
                value={packFilter}
                options={filterOptions}
                onChange={setPackFilter}
                ariaLabel={t('filterPackLabel')}
              />
            )}
            {/* Publish as module — admin-only, from the folder's own page.
                Only inside a real folder (not the groups root or Ungrouped). */}
            {showAdminBadges && realFolderId && (
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
        {scopedLists === undefined && (
          <div className="flex justify-center py-12">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {scopedLists?.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>
              {folderId ? t('groupEmpty') : t('empty')}
            </p>
          </div>
        )}

        {scopedLists && scopedLists.length > 0 && filteredLists.length === 0 && packFilter !== 'all' && (
          <div className="flex items-center justify-center py-16">
            <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>
              {t('filterEmpty')}
            </p>
          </div>
        )}

        {filteredLists.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {filteredLists.map((list) => (
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
                    onMoveRequest={(id, name) => { setMoveTarget({ id, name }); setMoveSelection(null); }}
                    onOpen={(id) => router.push(`/${locale}/lists/${id}`)}
                    adminPacks={showAdminBadges && adminPacks ? adminPacks : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <CreateListModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreate}
      />

      {/* Free-tier upgrade nudge — fires from handleEditToggle and
          handleCreateOpen when subscription.tier === 'free'. */}
      {publishOpen && realFolderId && (
        <PublishModuleModal
          kind="lists"
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

      {/* Move-to-group dialog — select a destination, then Move. Current group
          is disabled. */}
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
    </div>
  );
}
