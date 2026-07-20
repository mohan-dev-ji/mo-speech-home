"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { Pencil, Trash2, Move, Check, X, FolderInput, Upload, RotateCcw } from 'lucide-react';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { Button } from '@/app/components/app/shared/ui/Button';
import { PublishModuleModal } from '@/app/components/app/shared/modals/PublishModuleModal';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { AdminPackEditingBanner } from '@/app/components/app/shared/ui/AdminPackEditingBanner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { displayString, resolvedLocale } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { translateTexts, makeRecordFiller } from '@/lib/languages/translateClient';
import { TranslateBadge } from '@/app/components/app/shared/ui/TranslateBadge';
import { TranslateChoiceModal } from '@/app/components/app/shared/modals/TranslateChoiceModal';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
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
  librarySourceId?: string;
  folderId?: Id<'profileFolders'>;
};


type PendingDelete = { id: Id<'profileLists'>; name: string } | null;
type PendingRevert = { id: Id<'profileLists'>; name: string } | null;

// ─── Thumbnail strip ──────────────────────────────────────────────────────────

function ThumbnailStrip({
  thumbnails,
}: {
  thumbnails: { imagePath?: string }[];
}) {
  const filled = thumbnails.filter((t) => t.imagePath);
  // All item thumbnails, wrapping onto new lines (no cap / overflow "…").
  return (
    <div className="flex flex-wrap items-end gap-2">
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
  onMoveRequest: (id: Id<'profileLists'>, name: string) => void;
  onOpen: (id: Id<'profileLists'>) => void;
  /** Phase 15.5 — open the translate modal for this list (badge tap). */
  onTranslateList: (id: Id<'profileLists'>) => void;
  /** Stage 3 — strip this board's language key from the list name + item descriptions. */
  onRevertRequest: (id: Id<'profileLists'>, name: string) => void;
};

function SortableListRow({
  list, language, isEditing,
  editingNameId, editingNameValue,
  onEditNameStart, onEditNameChange, onEditNameSave, onEditNameCancel,
  onDeleteRequest, onMoveRequest, onOpen, onTranslateList, onRevertRequest,
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
          'relative flex flex-col gap-3 rounded-theme-card px-theme-general py-theme-item transition-colors',
          'border-2 border-dashed',
          isEditing ? 'border-theme-enter-mode' : 'border-transparent cursor-pointer',
        ].join(' ')}
        style={{ background: 'var(--group-card, var(--theme-card))' }}
        onClick={!isEditing ? () => onOpen(list._id) : undefined}
      >
        {/* Top row: all thumbnails (fill + wrap) + the edit panel (top-right). */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <ThumbnailStrip thumbnails={list.thumbnails} />
          </div>
          <div className="shrink-0">
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
                {/* Stage 3 — revert: only when this board is showing a real
                    board-language key over a surviving origin key. */}
                {typeof list.name === 'object' &&
                  list.name[language] != null &&
                  Object.keys(list.name).some((k) => k !== language) && (
                    <IconButton
                      size="sm"
                      variant="neutral"
                      icon={<RotateCcw />}
                      label={t('rowRevert')}
                      onClick={(e) => { e.stopPropagation(); onRevertRequest(list._id, name); }}
                    />
                  )}
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

        {/* Below: list name (or inline rename input), full width. */}
        <div className="min-w-0">
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
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-theme-p font-semibold break-words min-w-0" style={{ color: 'var(--theme-text-primary)' }}>
                {name}
              </p>
              {/* Phase 15.5 — order-free list title translate badge. */}
              <TranslateBadge
                record={list.name}
                language={language}
                onClick={() => onTranslateList(list._id)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListsModeContent({ folderId }: { folderId?: string } = {}) {
  const t = useTranslations('lists');
  const tTranslate = useTranslations('translate');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { language, stateFlags, viewMode } = useProfile();
  const { setBreadcrumbExtra } = useBreadcrumb();
  const isAdmin = useIsAdmin();
  const showAdminBadges = viewMode === 'admin' && isAdmin;

  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';
  const [isEditing, setIsEditing] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  // Last-seen server id-set, so the localOrder sync below can run during render
  // (not in an effect) only when the set actually changes.
  const [seenOrderKey, setSeenOrderKey] = useState<string | null>(null);
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
  const [pendingRevert, setPendingRevert] = useState<PendingRevert>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editingNameId, setEditingNameId] = useState<Id<'profileLists'> | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const lists = useQuery(api.profileLists.getProfileLists, {});
  const createList = useMutation(api.profileLists.createProfileList);
  const updateListItems = useMutation(api.profileLists.updateProfileListItems);
  const deleteList = useMutation(api.profileLists.deleteProfileList);
  const revertListLanguage = useMutation(api.profileLists.revertProfileListLanguage);
  const renameList = useMutation(api.profileLists.updateProfileListName);
  const reorderLists = useMutation(api.profileLists.reorderProfileLists);
  const moveListToGroup = useMutation(api.profileFolders.moveListToGroup);

  // Phase 15.5 — list-title translate. The tile carries only thumbnails, so the
  // whole-list path needs the items; fetch the target list on demand.
  const [translateTarget, setTranslateTarget] = useState<Id<'profileLists'> | null>(null);
  const translateFullList = useQuery(
    api.profileLists.getProfileListWithItems,
    translateTarget ? { profileListId: translateTarget } : 'skip',
  );

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

  // Re-sync the local drag order with the server set DURING render (React's
  // "adjust state when inputs change" pattern) rather than a setState-in-effect:
  // keep still-present ids in their local order and append newcomers. Guarded by
  // `seenOrderKey` so it runs only on an actual change.
  if (scopedLists) {
    const serverIds = scopedLists.map((l) => l._id as string);
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

      reorderLists({
        orderedIds: next as Id<'profileLists'>[],
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
      });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  async function handleRevertConfirm() {
    if (!pendingRevert) return;
    setIsReverting(true);
    try {
      await revertListLanguage({
        profileListId: pendingRevert.id,
        language,
      });
    } finally {
      setIsReverting(false);
      setPendingRevert(null);
    }
  }

  async function handleEditNameSave() {
    if (!editingNameId || !editingNameValue.trim()) {
      setEditingNameId(null);
      return;
    }
    // Merge under the board language — preserve every other locale's label so
    // renaming on a HI board doesn't flatten the EN name (mirrors the detail
    // view's commitName).
    const existing = listMap[editingNameId]?.name ?? {};
    await renameList({
      profileListId: editingNameId,
      name: { ...existing, [language]: editingNameValue.trim() },
    });
    setEditingNameId(null);
  }

  // Memoised so its identity is stable while the server set is unchanged — the
  // filter below reads it, and a fresh object every render trips the compiler's
  // "could not be preserved".
  const listMap = useMemo(
    () => Object.fromEntries((scopedLists ?? []).map((l) => [l._id, l])),
    [scopedLists],
  );

  // Display order = local order (drag-reorder mirror). The pack-origin filter
  // dropdown was removed with the resource-pack teardown (Phase 14.5 Stage 2).
  const filteredOrder = localOrder;
  const filteredLists = filteredOrder.map((id) => listMap[id]).filter(Boolean) as ListRow[];

  // Admin-view reminder: any list on screen that's published means
  // reorder / rename / delete here propagates to the live pack.
  const hasPublishedList = !!scopedLists?.some((l) => !!l.librarySourceId);

  // Phase 15.5 — list-title translate modal. Fills the missing board-language
  // key(s) via the shared MT helpers, then persists silently (no edit mode).
  const translateName = translateTarget ? listMap[translateTarget]?.name : undefined;
  const translateSrcLang = translateName
    ? (resolvedLocale(translateName, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE)
    : DEFAULT_LOCALE;
  async function handleTranslateChoice(mode: string) {
    if (!translateTarget) return;
    const name = listMap[translateTarget]?.name ?? translateFullList?.name ?? {};
    const srcLang = resolvedLocale(name, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE;

    if (mode === 'manual') {
      // Type it myself — reveal the inline rename input for this list.
      setEditingNameId(translateTarget);
      setEditingNameValue(displayString(name, language, DEFAULT_LOCALE));
      setTranslateTarget(null);
      return;
    }

    if (mode === 'title') {
      const src = displayString(name, srcLang, DEFAULT_LOCALE);
      if (src) {
        const [tr] = await translateTexts([src], language);
        if (tr) await renameList({ profileListId: translateTarget, name: { ...name, [language]: tr } });
      }
      setTranslateTarget(null);
      return;
    }

    // 'whole' — title + every item, in one batch.
    if (!translateFullList) throw new Error('list not loaded');
    const recordOf = (d: string | Record<string, string> | undefined): Record<string, string> =>
      typeof d === 'string' ? { [srcLang]: d } : (d ?? {});
    const itemRecords = translateFullList.items.map((it) => recordOf(it.description));
    const fill = await makeRecordFiller([translateFullList.name, ...itemRecords], srcLang, language);
    await renameList({ profileListId: translateTarget, name: fill(translateFullList.name) });
    await updateListItems({
      profileListId: translateTarget,
      items: translateFullList.items.map((it, i) => ({
        imagePath: it.imagePath,
        order: i,
        description: it.description === undefined ? undefined : fill(recordOf(it.description)),
        audioPath: it.audioPath,
        activeAudioSource: it.activeAudioSource,
        defaultAudioPath: it.defaultAudioPath,
        generatedAudioPath: it.generatedAudioPath,
        recordedAudioPath: it.recordedAudioPath,
        imageSourceType: it.imageSourceType,
      })),
    });
    setTranslateTarget(null);
  }

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
                    onTranslateList={(id) => setTranslateTarget(id)}
                    onRevertRequest={(id, name) => setPendingRevert({ id, name })}
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

      {/* Phase 15.5 — list-title translate: whole list / just the title / manual. */}
      {translateTarget && (
        <TranslateChoiceModal
          isOpen={true}
          onClose={() => setTranslateTarget(null)}
          title={tTranslate('chooseTitle', { lang: language.toUpperCase() })}
          description={tTranslate('chooseDescription', { authoredLang: translateSrcLang.toUpperCase(), lang: language.toUpperCase() })}
          options={[
            { mode: 'whole', label: tTranslate('wholeList'), hint: tTranslate('wholeListHint'), icon: 'list', primary: true },
            { mode: 'title', label: tTranslate('thisTitle'), icon: 'translate' },
            { mode: 'manual', label: tTranslate('manual'), hint: tTranslate('manualHint', { lang: language.toUpperCase() }), icon: 'manual' },
          ]}
          onChoose={handleTranslateChoice}
        />
      )}

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

      <Dialog
        open={pendingRevert !== null}
        onOpenChange={(open) => { if (!open) setPendingRevert(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('rowRevert')}</DialogTitle>
            <DialogDescription>
              {t('revertConfirm', { name: pendingRevert?.name ?? '' })}
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
              onClick={handleRevertConfirm}
              disabled={isReverting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-button-highlight)' }}
            >
              {isReverting ? t('deleting') : t('rowRevert')}
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
