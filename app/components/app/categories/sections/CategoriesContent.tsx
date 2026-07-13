"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
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
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { GroupTile } from '@/app/components/app/shared/ui/GroupTile';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import { ModuleClassBadge } from '@/app/components/app/shared/ui/ModuleClassBadge';
import { CreateCategoryModal } from '@/app/components/app/categories/modals/CreateCategoryModal';
import { AdminPackEditingBanner } from '@/app/components/app/shared/ui/AdminPackEditingBanner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/app/components/app/shared/ui/Dialog';

// Categories list grid columns — mirrors CategoryBoardGrid's symbol-card scale
// but one step coarser so category tiles stay legible.
//   large  → 1 / 2 / 4    (default; matches old layout)
//   medium → 2 / 4 / 6
//   small  → 3 / 6 / 8
const CATEGORIES_GRID_CLASSES = {
  large:  'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  medium: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6',
  small:  'grid-cols-3 md:grid-cols-6 lg:grid-cols-8',
} as const;

// ─── Main component ───────────────────────────────────────────────────────────

type PendingDelete = { id: Id<'profileCategories'>; name: string } | null;

export function CategoriesContent() {
  const t = useTranslations('categories');
  const { language, stateFlags, viewMode, accountId, voiceId } = useProfile();
  const { talkerMode } = useTalker();
  const isAdmin = useIsAdmin();
  const showAdminBadges = viewMode === 'admin' && isAdmin;
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';
  const [isEditing, setIsEditing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // Edit toggle + Create button intercept on free tier — opens the upgrade
  // nudge instead of running the original action. Gating the two entry
  // points cascades: free users can't enter edit mode, so reorder / delete
  // / rename inside edit mode are auto-unreachable.
  const handleEditToggle = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setIsEditing((v) => !v);
  };
  const handleCreateOpen = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setIsCreateOpen(true);
  };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  // Folder-image picker target (the category whose image is being chosen).
  const [imageTarget, setImageTarget] = useState<
    { id: Id<'profileCategories'>; name: string; imagePath?: string } | null
  >(null);
  // Admin "publish as module" target (the category being published). Carries the
  // existing module slug/class when already published → Update mode.
  const categories = useQuery(api.profileCategories.getProfileCategories, {});

  const createCategoryMutation = useMutation(api.profileCategories.createProfileCategory);
  const deleteCategoryMutation = useMutation(api.profileCategories.deleteCategory);
  const reorderCategoriesMutation = useMutation(api.profileCategories.reorderCategories);
  const updateCategoryMeta = useMutation(api.profileCategories.updateCategoryMeta);

  // Inline rename from the edit-mode dashed title box. Merge into the existing
  // localised name so other locales are preserved; only the active locale's
  // value changes.
  function handleRename(id: Id<'profileCategories'>, value: string) {
    const cat = categoryMap[id];
    if (!cat) return;
    updateCategoryMeta({
      profileCategoryId: id,
      name: { ...cat.name, [language]: value },
    });
  }

  // Colour swatch — drives the category's colour variants (tile + board banner).
  function handleRecolour(id: Id<'profileCategories'>, key: string) {
    updateCategoryMeta({ profileCategoryId: id, colour: key });
  }

  // Folder image — Symbol Editor (image only) writes back via updateCategoryMeta.
  function handleFolderImageSave(imagePath: string) {
    if (!imageTarget) return;
    updateCategoryMeta({ profileCategoryId: imageTarget.id, imagePath });
    setImageTarget(null);
  }

  // Sync localOrder from server: keep existing order, remove deleted, append new
  useEffect(() => {
    if (!categories) return;
    setLocalOrder((prev) => {
      const serverIds = categories.map((c) => c._id as string);
      const kept = prev.filter((id) => serverIds.includes(id));
      const added = serverIds.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [categories]);

  // Build a lookup map and derive display order from localOrder
  const categoryMap = Object.fromEntries((categories ?? []).map((c) => [c._id, c]));
  // Display order = local order (drag-reorder mirror). The pack-origin filter
  // dropdown was removed with the resource-pack teardown (Phase 14.5 Stage 2).
  const filteredOrder = localOrder;
  const filteredCategories = filteredOrder
    .map((id) => categoryMap[id])
    .filter(Boolean) as Doc<'profileCategories'>[];

  // dnd-kit sensors — 8px distance threshold prevents accidental drag on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
      const newOrder = prev.map((id) => visibleSet.has(id) ? reorderedVisible[v++] : id);

      reorderCategoriesMutation({
        orderedIds: newOrder as Id<'profileCategories'>[],
      });

      return newOrder;
    });
  }

  function handleDeleteRequest(id: Id<'profileCategories'>, name: string) {
    setPendingDelete({ id, name });
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteCategoryMutation({ profileCategoryId: pendingDelete.id });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  async function handleCreate(name: string, symbolLabels: string[]) {
    const id = await createCategoryMutation({
      // Key by the board language you're authoring in (ADR-016 Addendum D — names
      // never auto-translate; the translate icon fills other languages on demand).
      name: { [language]: name },
      symbolLabels,
    });
    // ?edit=1 lands the detail page in edit mode so the newly-seeded
    // placeholder symbols are tappable right away — nudges the user to
    // pick an image for each label they just typed.
    router.push(`/${locale}/categories/${id}?edit=1`);
  }

  // Admin-view reminder: any category on screen that's published means
  // reorder / delete here propagates to the live pack.
  const hasPublishedCategory = !!categories?.some((c) => !!c.librarySourceId);

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      <AdminPackEditingBanner visible={showAdminBadges && hasPublishedCategory} />

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')}>
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
          </PageBanner>
        </div>
      )}

      {/* Scrollable grid area — banner stays put above */}
      <div className="flex-1 overflow-auto" data-modelling-content>
        {categories === undefined && (
          <p className="text-theme-s text-theme-secondary-alt-text">{t('loading')}</p>
        )}

        {filteredCategories.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredOrder} strategy={rectSortingStrategy}>
              <div className={`grid gap-3 ${CATEGORIES_GRID_CLASSES[stateFlags.grid_size ?? 'large']}`}>
                {filteredCategories.map((cat) => {
                  const name = displayString(cat.name, language, DEFAULT_LOCALE);
                  return (
                    <GroupTile
                      key={cat._id}
                      id={cat._id}
                      name={name}
                      colour={cat.colour}
                      imagePath={cat.imagePath}
                      isEditing={isEditing}
                      gridSize={stateFlags.grid_size ?? 'large'}
                      badgeSlot={
                        showAdminBadges ? (
                          <ModuleClassBadge publishedClass={cat.publishedModuleClass} />
                        ) : undefined
                      }
                      nameRecord={cat.name}
                      language={language}
                      onOpen={() => router.push(`/${locale}/categories/${cat._id}`)}
                      onRename={(value) => handleRename(cat._id, value)}
                      onRecolour={(key) => handleRecolour(cat._id, key)}
                      onEditImage={() => setImageTarget({ id: cat._id, name, imagePath: cat.imagePath })}
                      onDeleteRequest={() => handleDeleteRequest(cat._id, name)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Create modal */}
      <CreateCategoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />

      {/* Free-tier upgrade nudge — fires from the Edit and Create handlers
          when subscription.tier === 'free'. */}
      <UpgradeNudge
        open={upgradeNudgeOpen}
        onOpenChange={setUpgradeNudgeOpen}
        locale={locale}
      />

      {/* Delete confirmation dialog */}
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
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-colors"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('cancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            >
              {isDeleting ? t('deleting') : t('delete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
