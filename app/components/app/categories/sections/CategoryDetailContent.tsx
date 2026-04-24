"use client";

import { useState, useEffect } from 'react';
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
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { CategoryBoardGrid } from '@/app/components/shared/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/shared/SymbolCard';
import { SymbolCardEditable } from '@/app/components/app/categories/ui/SymbolCardEditable';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { CategoryPageHeader } from '@/app/components/app/categories/ui/CategoryPageHeader';
import { BannerEdit } from '@/app/components/app/categories/ui/BannerEdit';
import { SymbolEditorModal } from '@/app/components/shared/SymbolEditorModal';
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

type SymbolEditorState =
  | { isOpen: false }
  | { isOpen: true; profileSymbolId?: Id<'profileSymbols'> };

type PendingDelete = { id: Id<'profileSymbols'>; name: string } | null;

type SymbolRow = {
  _id: string;
  profileCategoryId: Id<'profileCategories'>;
  order: number;
  label: { eng: string; hin?: string };
  display?: {
    bgColour?: string;
    textColour?: string;
    textSize?: 'sm' | 'md' | 'lg' | 'xl';
    borderColour?: string;
    borderWidth?: number;
    showLabel?: boolean;
    showImage?: boolean;
    shape?: 'square' | 'rounded' | 'circle';
  };
  imagePath?: string;
  audioEng?: string;
  audioHin?: string;
};

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Sortable symbol wrapper ──────────────────────────────────────────────────

type SortableSymbolProps = {
  sym: SymbolRow;
  language: string;
  categoryColour?: string;
  onEdit: (id: Id<'profileSymbols'>) => void;
  onDeleteRequest: (id: Id<'profileSymbols'>, name: string) => void;
};

function SortableSymbolCard({ sym, language, categoryColour, onEdit, onDeleteRequest }: SortableSymbolProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sym._id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const label = language === 'hin' && sym.label.hin ? sym.label.hin : sym.label.eng;
  const imageUrl = sym.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <SymbolCardEditable
        imagePath={imageUrl}
        label={label}
        display={sym.display}
        categoryColour={categoryColour}
        onEdit={() => onEdit(sym._id as Id<'profileSymbols'>)}
        onDelete={() => onDeleteRequest(sym._id as Id<'profileSymbols'>, label)}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  categoryId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryDetailContent({ categoryId }: Props) {
  const t = useTranslations('categoryDetail');

  const { language, stateFlags, activeProfileId } = useProfile();
  const { talkerMode, addToTalker } = useTalker();
  const { setBreadcrumbExtra } = useBreadcrumb();

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draftColour, setDraftColour] = useState('orange');
  const [draftImagePath, setDraftImagePath] = useState<string | undefined>(undefined);
  const [symbolEditorState, setSymbolEditorState] = useState<SymbolEditorState>({ isOpen: false });
  const [folderImageModalOpen, setFolderImageModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  // ── Convex ──────────────────────────────────────────────────────────────────
  const profileCategoryId = categoryId as Id<'profileCategories'>;

  const category = useQuery(
    api.profileCategories.getProfileCategory,
    { profileCategoryId }
  );

  const symbols = useQuery(
    api.profileCategories.getProfileSymbolsWithImages,
    { profileCategoryId }
  );

  const updateCategoryMeta = useMutation(api.profileCategories.updateCategoryMeta);
  const deleteProfileSymbol = useMutation(api.profileSymbols.deleteProfileSymbol);
  const reorderProfileSymbols = useMutation(api.profileSymbols.reorderProfileSymbols);

  // ── dnd-kit sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Sync localOrder from server ─────────────────────────────────────────────
  useEffect(() => {
    if (!symbols) return;
    setLocalOrder((prev) => {
      const serverIds = symbols.map((s) => s._id as string);
      const kept = prev.filter((id) => serverIds.includes(id));
      const added = serverIds.filter((id) => !prev.includes(id));
      return [...added, ...kept];
    });
  }, [symbols]);

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const newOrder = arrayMove(prev, oldIndex, newIndex);

      reorderProfileSymbols({
        profileCategoryId,
        orderedIds: newOrder as Id<'profileSymbols'>[],
      });

      return newOrder;
    });
  }

  // ── Edit mode handlers ──────────────────────────────────────────────────────

  function handleEditStart() {
    setDraftColour(category?.colour ?? 'orange');
    setDraftImagePath(category?.imagePath);
    setIsEditing(true);
  }

  function handleEditExit() {
    setIsEditing(false);
  }

  function handleColourChange(colour: string) {
    setDraftColour(colour);
    updateCategoryMeta({ profileCategoryId, colour }).catch((e) =>
      console.error('[CategoryDetailContent] colour update failed', e)
    );
  }

  function handleDeleteRequest(id: Id<'profileSymbols'>, name: string) {
    setPendingDelete({ id, name });
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteProfileSymbol({ profileSymbolId: pendingDelete.id });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  function handleEditSymbol(symbolId: Id<'profileSymbols'>) {
    setSymbolEditorState({ isOpen: true, profileSymbolId: symbolId });
  }

  function handleAddSymbol() {
    setSymbolEditorState({ isOpen: true });
  }

  function handleEditFolderImage() {
    setFolderImageModalOpen(true);
  }

  function handleFolderImageSave(imagePath: string) {
    setDraftImagePath(imagePath);
    updateCategoryMeta({ profileCategoryId, imagePath }).catch((e) =>
      console.error('[CategoryDetailContent] folder image update failed', e)
    );
    setFolderImageModalOpen(false);
  }

  // ── Breadcrumb ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!category) return;
    const name = language === 'hin' && category.name.hin ? category.name.hin : category.name.eng;
    setBreadcrumbExtra({ label: name, colour: category.colour });
    return () => setBreadcrumbExtra(null);
  }, [category, language, setBreadcrumbExtra]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const categoryName = category
    ? (language === 'hin' && category.name.hin ? category.name.hin : category.name.eng)
    : '';

  const symbolMap = Object.fromEntries((symbols ?? []).map((s) => [s._id, s]));
  const orderedSymbols = localOrder
    .map((id) => symbolMap[id])
    .filter(Boolean) as SymbolRow[];

  if (!activeProfileId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-body" style={{ color: 'var(--theme-secondary-text)' }}>{t('noProfile')}</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          {isEditing ? (
            <div
              className="relative rounded-theme p-3 min-h-[200px] flex flex-col justify-center"
              style={{ background: getCategoryColour(draftColour).c700 }}
            >
              <BannerEdit
                categoryName={categoryName}
                imagePath={draftImagePath}
                draftColour={draftColour}
                onColourChange={handleColourChange}
                onExit={handleEditExit}
                onAddSymbol={handleAddSymbol}
                onEditFolderImage={handleEditFolderImage}
              />
            </div>
          ) : (
            <CategoryPageHeader
              categoryName={categoryName}
              imagePath={category?.imagePath}
              colour={category?.colour}
              onEdit={handleEditStart}
            />
          )}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-auto">
        {symbols === undefined && (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {symbols?.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-body" style={{ color: 'var(--theme-secondary-text)' }}>{t('empty')}</p>
          </div>
        )}

        {symbols && symbols.length > 0 && (
          isEditing ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={localOrder} strategy={rectSortingStrategy}>
                <CategoryBoardGrid>
                  {orderedSymbols.map((sym) => (
                    <SortableSymbolCard
                      key={sym._id}
                      sym={sym}
                      language={language}
                      categoryColour={category?.colour}
                      onEdit={handleEditSymbol}
                      onDeleteRequest={handleDeleteRequest}
                    />
                  ))}
                </CategoryBoardGrid>
              </SortableContext>
            </DndContext>
          ) : (
            <CategoryBoardGrid>
              {symbols.map((sym) => {
                const label = language === 'hin' && sym.label.hin ? sym.label.hin : sym.label.eng;
                const audioPath = language === 'hin' ? (sym.audioHin ?? sym.audioEng) : sym.audioEng;
                const imageUrl = sym.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined;

                return (
                  <SymbolCard
                    key={sym._id}
                    symbolId={sym._id}
                    imagePath={imageUrl}
                    label={label}
                    language={language}
                    display={sym.display}
                    categoryColour={category?.colour}
                    onTap={() => {
                      if (!audioPath) return;
                      if (talkerMode === 'banner') {
                        playAudio(audioPath);
                      } else if (sym.imagePath) {
                        playAudio(audioPath);
                        addToTalker({
                          symbolId: sym._id,
                          imagePath: `/api/assets?key=${sym.imagePath}`,
                          audioPath,
                          label,
                        });
                      }
                    }}
                  />
                );
              })}
            </CategoryBoardGrid>
          )
        )}
      </div>

      {/* Symbol editor modal */}
      {symbolEditorState.isOpen && activeProfileId && (
        <SymbolEditorModal
          isOpen={true}
          profileSymbolId={symbolEditorState.profileSymbolId}
          profileCategoryId={profileCategoryId}
          profileId={activeProfileId as Id<'studentProfiles'>}
          language={language}
          onClose={() => setSymbolEditorState({ isOpen: false })}
          onSave={() => setSymbolEditorState({ isOpen: false })}
        />
      )}

      {/* Folder image picker modal */}
      {folderImageModalOpen && activeProfileId && (
        <SymbolEditorModal
          isOpen={true}
          profileId={activeProfileId as Id<'studentProfiles'>}
          language={language}
          folderImageMode={true}
          initialImagePath={draftImagePath}
          onClose={() => setFolderImageModalOpen(false)}
          onSave={() => {}}
          onFolderImageSave={handleFolderImageSave}
        />
      )}

      {/* Symbol delete confirmation */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('symbolDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('symbolDeleteConfirm', { name: pendingDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('symbolDeleteCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            >
              {isDeleting ? t('symbolDeleting') : t('symbolDeleteButton')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
