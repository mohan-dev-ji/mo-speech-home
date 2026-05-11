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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { CategoryTile } from '@/app/components/app/categories/ui/CategoryTile';
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

// ─── Sortable wrapper ─────────────────────────────────────────────────────────
// Owns the useSortable hook and passes drag handle props down to CategoryTile.

type SortableTileProps = {
  category: Doc<'profileCategories'>;
  language: string;
  isEditing: boolean;
  onDeleteRequest: (id: Id<'profileCategories'>, name: string) => void;
  onClick?: () => void;
  adminPacks?: {
    starterPackId: Id<'resourcePacks'> | null;
    libraryPacksById: Record<
      string,
      { tier: 'free' | 'pro' | 'max'; name: { eng: string; hin?: string } }
    >;
  };
};

function SortableCategoryTile({ category, language, isEditing, onDeleteRequest, onClick, adminPacks }: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryTile
        category={category}
        language={language}
        isEditing={isEditing}
        onClick={onClick}
        onDeleteRequest={onDeleteRequest}
        dragHandleProps={{ listeners, attributes }}
        adminPacks={adminPacks}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PendingDelete = { id: Id<'profileCategories'>; name: string } | null;

export function CategoriesContent() {
  const t = useTranslations('categories');
  const { language, stateFlags, viewMode } = useProfile();
  const { talkerMode } = useTalker();
  const isAdmin = useIsAdmin();
  const showAdminBadges = viewMode === 'admin' && isAdmin;
  const adminPacks = useQuery(
    api.resourcePacks.getPacksForAdminStatus,
    showAdminBadges ? {} : 'skip',
  );
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  const categories = useQuery(api.profileCategories.getProfileCategories, {});

  const createCategoryMutation = useMutation(api.profileCategories.createProfileCategory);
  const deleteCategoryMutation = useMutation(api.profileCategories.deleteCategory);
  const reorderCategoriesMutation = useMutation(api.profileCategories.reorderCategories);

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
  const orderedCategories = localOrder
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
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const newOrder = arrayMove(prev, oldIndex, newIndex);

      reorderCategoriesMutation({
        orderedIds: newOrder as Id<'profileCategories'>[],
        propagateToPack: showAdminBadges,
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

  async function handleCreate(name: string) {
    await createCategoryMutation({ name: { eng: name } });
  }

  // Admin-view reminder: any category on screen that's published means
  // reorder / delete here propagates to the live pack.
  const hasPublishedCategory = !!categories?.some((c) => !!c.publishedToPackId);

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      <AdminPackEditingBanner visible={showAdminBadges && hasPublishedCategory} />

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')}>
            <EditButton
              isEditing={isEditing}
              onClick={() => setIsEditing((v) => !v)}
              editLabel={t('edit')}
              exitLabel={t('exitEdit')}
            />
            <CreateButton
              onClick={() => setIsCreateOpen(true)}
              label={t('create')}
            />
          </PageBanner>
        </div>
      )}

      {/* Scrollable grid area — banner stays put above */}
      <div className="flex-1 overflow-auto" data-modelling-content>
        {categories === undefined && (
          <p className="text-theme-s text-theme-secondary-alt-text">{t('loading')}</p>
        )}

        {orderedCategories.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={localOrder} strategy={rectSortingStrategy}>
              <div className={`grid gap-3 ${CATEGORIES_GRID_CLASSES[stateFlags.grid_size ?? 'large']}`}>
                {orderedCategories.map((cat) => (
                  <SortableCategoryTile
                    key={cat._id}
                    category={cat}
                    language={language}
                    isEditing={isEditing}
                    onDeleteRequest={handleDeleteRequest}
                    onClick={() => router.push(`/${locale}/categories/${cat._id}`)}
                    adminPacks={showAdminBadges && adminPacks ? adminPacks : undefined}
                  />
                ))}
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
    </div>
  );
}
