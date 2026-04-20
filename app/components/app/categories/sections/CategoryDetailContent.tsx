"use client";

import { useState, useRef, useEffect } from 'react';
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
import { getCategoryColour } from '@/app/lib/categoryColours';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { CategoryBoardGrid } from '@/app/components/shared/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/shared/SymbolCard';
import { SymbolCardEditable } from '@/app/components/app/categories/ui/SymbolCardEditable';
import { Header, type TalkerSymbolItem, type QuickSymbolItem } from '@/app/components/shared/Header';
import { BannerEdit } from '@/app/components/app/categories/ui/BannerEdit';
import { PlayModal } from '@/app/components/shared/PlayModal';
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

type PlayModalState = {
  symbolId: string;
  imagePath?: string;
  audioPath?: string;
  label: string;
} | null;

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
  const { setBreadcrumbExtra } = useBreadcrumb();

  // ── View state ──────────────────────────────────────────────────────────────
  const [talkerSymbols, setTalkerSymbols] = useState<TalkerSymbolItem[]>([]);
  const [headerMode, setHeaderMode] = useState<'talker' | 'banner'>('talker');
  const [playModal, setPlayModal] = useState<PlayModalState>(null);
  const cancelSequenceRef = useRef(false);

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
      // Prepend new symbols so they appear top-left (order 0)
      return [...added, ...kept];
    });
  }, [symbols]);

  // ── Talker handlers ─────────────────────────────────────────────────────────

  function addToTalker(symbolId: string, imagePath: string, label: string, audioPath: string) {
    playAudio(audioPath);
    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId,
        imagePath: `/api/assets?key=${imagePath}`,
        audioPath,
        label,
      },
    ]);
  }

  function addQuickSymbol(item: QuickSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    setTalkerSymbols((prev) => [
      ...prev,
      {
        instanceId: crypto.randomUUID(),
        symbolId: item.symbolId,
        imagePath: item.imagePath,
        audioPath: item.audioPath,
        label: item.label,
      },
    ]);
  }

  function handleChipTap(item: TalkerSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    setPlayModal({
      symbolId: item.symbolId,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
      label: item.label,
    });
  }

  async function handlePlaySentence() {
    if (talkerSymbols.length === 0) return;
    cancelSequenceRef.current = false;

    for (const symbol of talkerSymbols) {
      if (cancelSequenceRef.current) break;
      setPlayModal({
        symbolId: symbol.symbolId,
        imagePath: symbol.imagePath,
        audioPath: symbol.audioPath,
        label: symbol.label,
      });
      if (symbol.audioPath) {
        const path = symbol.audioPath;
        await new Promise<void>((resolve) => {
          const audio = new Audio(`/api/assets?key=${path}`);
          audio.addEventListener('ended', () => resolve());
          audio.addEventListener('error', () => resolve());
          audio.play().catch(() => resolve());
        });
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
      }
    }
    if (!cancelSequenceRef.current) setPlayModal(null);
  }

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

  // ── Breadcrumb + TopBar extras ──────────────────────────────────────────────

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

      {/* Board header */}
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
          ) : stateFlags.talker_visible ? (
            <Header
              symbols={talkerSymbols}
              language={language}
              onChipTap={handleChipTap}
              onPlaySentence={handlePlaySentence}
              onClear={() => setTalkerSymbols([])}
              onQuickSymbolTap={addQuickSymbol}
              showToggle={true}
              mode={headerMode}
              onToggleMode={() => setHeaderMode((m) => (m === 'talker' ? 'banner' : 'talker'))}
              categoryName={categoryName}
              categoryImagePath={category?.imagePath}
              categoryColour={category?.colour}
              onEditCategory={handleEditStart}
            />
          ) : null}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto mt-8">
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
                      if (headerMode === 'banner') {
                        playAudio(audioPath);
                      } else if (sym.imagePath) {
                        addToTalker(sym._id, sym.imagePath, label, audioPath);
                      }
                    }}
                  />
                );
              })}
            </CategoryBoardGrid>
          )
        )}
      </div>

      {/* Play modal */}
      {playModal && (
        <PlayModal
          isOpen={true}
          symbolId={playModal.symbolId}
          imagePath={playModal.imagePath}
          label={playModal.label}
          language={language}
          onClose={() => { cancelSequenceRef.current = true; setPlayModal(null); }}
        />
      )}

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
