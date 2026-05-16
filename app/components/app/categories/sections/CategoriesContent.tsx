"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { PackFilterDropdown, type PackFilterOption } from '@/app/components/app/shared/ui/PackFilterDropdown';
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
    starterSlug: string;
    libraryPacksBySlug: Record<
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
    api.resourcePacks.getPacksForAdminStatusV2,
    showAdminBadges ? {} : 'skip',
  );
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  const categories = useQuery(api.profileCategories.getProfileCategories, {});

  // Loaded-from packs — instructor/student-view filter options. Admin
  // view uses adminPacks for the dropdown options instead, so skip the
  // query when in admin view to save round-trips.
  const loadedPacks = useQuery(
    api.resourcePacks.getLoadedPacksForCurrentAccount,
    showAdminBadges ? 'skip' : {},
  );

  const createCategoryMutation = useMutation(api.profileCategories.createProfileCategory);
  const deleteCategoryMutation = useMutation(api.profileCategories.deleteCategory);
  const reorderCategoriesMutation = useMutation(api.profileCategories.reorderCategories);

  // ── Pack filter — URL state via ?pack=<value> ────────────────────────────
  const packFilter = searchParams.get('pack') ?? 'all';
  function setPackFilter(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === 'all') next.delete('pack');
    else next.set('pack', value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
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
  const orderedCategories = localOrder
    .map((id) => categoryMap[id])
    .filter(Boolean) as Doc<'profileCategories'>[];

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
          label: language === 'hin' && pack.name.hin ? pack.name.hin : pack.name.eng,
        });
      }
      opts.push({ value: 'unpublished', label: t('filterUnpublished') });
    } else if (loadedPacks) {
      for (const pack of loadedPacks) {
        opts.push({
          value: pack._id,
          label: language === 'hin' && pack.name.hin ? pack.name.hin : pack.name.eng,
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
      const row = categoryMap[id];
      if (!row) return false;
      if (showAdminBadges) {
        if (packFilter === 'default') return row.packSlug === adminPacks?.starterSlug;
        if (packFilter === 'unpublished') return !row.packSlug;
        return row.packSlug === packFilter;
      } else {
        if (packFilter === 'mine') return !row.librarySourceId;
        return row.librarySourceId === packFilter;
      }
    });
  }, [packFilter, localOrder, categoryMap, showAdminBadges, adminPacks?.starterSlug]);

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
      // Visible-subset reorder: drag operates inside the filtered list;
      // hidden rows keep their slot positions in the full order. When the
      // filter is "all", visibleSet covers every row and this collapses to
      // a straight arrayMove on prev.
      const visible = packFilter === 'all'
        ? prev
        : prev.filter((id) => filteredOrder.includes(id));
      const oldVisIdx = visible.indexOf(active.id as string);
      const newVisIdx = visible.indexOf(over.id as string);
      if (oldVisIdx < 0 || newVisIdx < 0) return prev;
      const reorderedVisible = arrayMove(visible, oldVisIdx, newVisIdx);

      const visibleSet = new Set(visible);
      let v = 0;
      const newOrder = prev.map((id) => visibleSet.has(id) ? reorderedVisible[v++] : id);

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

  async function handleCreate(name: string, symbolLabels: string[]) {
    const id = await createCategoryMutation({
      name: { eng: name },
      symbolLabels,
    });
    // ?edit=1 lands the detail page in edit mode so the newly-seeded
    // placeholder symbols are tappable right away — nudges the user to
    // pick an image for each label they just typed.
    router.push(`/${locale}/categories/${id}?edit=1`);
  }

  // Admin-view reminder: any category on screen that's published means
  // reorder / delete here propagates to the live pack.
  const hasPublishedCategory = !!categories?.some((c) => !!c.packSlug);

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      <AdminPackEditingBanner visible={showAdminBadges && hasPublishedCategory} />

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          <PageBanner title={t('title')}>
            {viewMode !== 'student-view' && (
              <>
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
          </PageBanner>
        </div>
      )}

      {/* Scrollable grid area — banner stays put above */}
      <div className="flex-1 overflow-auto" data-modelling-content>
        {categories === undefined && (
          <p className="text-theme-s text-theme-secondary-alt-text">{t('loading')}</p>
        )}

        {categories && categories.length > 0 && filteredCategories.length === 0 && packFilter !== 'all' && (
          <p className="text-theme-s text-theme-secondary-alt-text">{t('filterEmpty')}</p>
        )}

        {filteredCategories.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredOrder} strategy={rectSortingStrategy}>
              <div className={`grid gap-3 ${CATEGORIES_GRID_CLASSES[stateFlags.grid_size ?? 'large']}`}>
                {filteredCategories.map((cat) => (
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
