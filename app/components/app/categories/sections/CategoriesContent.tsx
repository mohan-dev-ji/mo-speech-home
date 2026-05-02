"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Edit2, LogOut, Plus } from 'lucide-react';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
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
import { CategoryTile } from '@/app/components/app/categories/ui/CategoryTile';
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
};

function SortableCategoryTile({ category, language, isEditing, onDeleteRequest, onClick }: SortableTileProps) {
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
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PendingDelete = { id: Id<'profileCategories'>; name: string } | null;

export function CategoriesContent() {
  const t = useTranslations('categories');
  const { language, stateFlags } = useProfile();
  const { talkerMode } = useTalker();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [isEditing, setIsEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  const categories = useQuery(api.profileCategories.getProfileCategories, {});

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

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')}>
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-90"
              style={{
                background: isEditing ? 'var(--theme-button-highlight)' : 'var(--theme-card)',
                color: isEditing ? 'var(--theme-text)' : 'var(--theme-text-primary)',
              }}
            >
              {isEditing ? (
                <><LogOut className="w-3.5 h-3.5" />{t('exitEdit')}</>
              ) : (
                <><Edit2 className="w-3.5 h-3.5" />{t('edit')}</>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('add')}
            </button>
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
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

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
