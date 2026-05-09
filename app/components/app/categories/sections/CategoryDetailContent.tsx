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
import { useModellingSession } from '@/app/contexts/ModellingSessionContext';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { useToast } from '@/app/components/app/shared/ui/Toast';
import { PackStatusLabel } from '@/app/components/app/shared/ui/packStatusBadge';
import { CategoryBoardGrid } from '@/app/components/app/shared/ui/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/app/shared/ui/SymbolCard';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';
import { SymbolCardEditable } from '@/app/components/app/categories/ui/SymbolCardEditable';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { CategoryPageHeader } from '@/app/components/app/categories/ui/CategoryPageHeader';
import { BannerEdit } from '@/app/components/app/categories/ui/BannerEdit';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import { ModellingPickerModal } from '@/app/components/app/categories/modals/ModellingPickerModal';
import {
  ReloadDefaultsDialog,
  type ReloadDefaultsResult,
} from '@/app/components/app/categories/modals/ReloadDefaultsDialog';
import {
  LibraryPackPickerModal,
  type PackPickerTarget,
} from '@/app/components/app/shared/modals/LibraryPackPickerModal';
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

  const { language, viewMode, stateFlags, accountId, studentProfile } = useProfile();
  const { talkerMode, addToTalker } = useTalker();
  const { setBreadcrumbExtra } = useBreadcrumb();
  const { isActive: modellingActive } = useModellingSession();
  const { subscription } = useAppState();
  const tBanner = useTranslations('banner');

  // Modelling trigger gate — instructor (or admin) view + Pro/Max tier + the
  // active student profile has modelling_push enabled. The flag is a per-student
  // permission (controls whether modelling can be pushed TO that student), so
  // it's read from the student profile directly rather than the viewMode-resolved
  // stateFlags. Admin acts as instructor here — see ADR-008.
  const hasModelling = subscription.tier !== 'free';
  const studentAllowsPush = studentProfile?.stateFlags?.modelling_push === true;
  const canModel =
    viewMode !== 'student-view' && hasModelling && studentAllowsPush;
  const modelDisabledReason = canModel
    ? undefined
    : viewMode === 'student-view'
      ? tBanner('modelDisabled.studentView')
      : !hasModelling
        ? tBanner('modelDisabled.upgrade')
        : tBanner('modelDisabled.flag');
  const [pickerOpen, setPickerOpen] = useState(false);
  const handleModelClick = canModel
    ? () => setPickerOpen(true)
    : undefined;

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draftColour, setDraftColour] = useState('orange');
  const [draftImagePath, setDraftImagePath] = useState<string | undefined>(undefined);
  const [symbolEditorState, setSymbolEditorState] = useState<SymbolEditorState>({ isOpen: false });
  const [folderImageModalOpen, setFolderImageModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadDialogOpen, setReloadDialogOpen] = useState(false);
  const [packPickerOpen, setPackPickerOpen] = useState(false);
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
  // deleteProfileSymbol now routed through /api/delete-profile-symbol so
  // the server can also clean up R2 personal media on delete. See
  // handleDeleteConfirm below.
  const reorderProfileSymbols = useMutation(api.profileSymbols.reorderProfileSymbols);
  const setCategoryDefault = useMutation(api.resourcePacks.setCategoryDefault);
  const setCategoryInLibrary = useMutation(api.resourcePacks.setCategoryInLibrary);
  const setLibraryPackTier = useMutation(api.resourcePacks.setLibraryPackTier);

  // ── Admin gating + pack status ──────────────────────────────────────────────
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const showAdminButtons = viewMode === 'admin' && isAdmin;

  // Subscribe once at the page level — used by the toolbar to show pressed state
  // on the Default/Library toggles + correct tier in the picker.
  const packsStatus = useQuery(api.resourcePacks.getPacksForAdminStatus, showAdminButtons ? {} : 'skip');
  const linkedPackId = category?.publishedToPackId;
  const isDefault = !!(linkedPackId && packsStatus && linkedPackId === packsStatus.starterPackId);
  const linkedLibraryPack = linkedPackId && packsStatus ? packsStatus.libraryPacksById[linkedPackId] : undefined;
  const isInLibrary = !!linkedLibraryPack;
  const libraryTier = linkedLibraryPack?.tier ?? 'free';

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
        propagateToPack: showAdminButtons,
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
    updateCategoryMeta({
      profileCategoryId,
      colour,
      propagateToPack: showAdminButtons,
    }).catch((e) =>
      console.error('[CategoryDetailContent] colour update failed', e)
    );
  }

  function handleCategoryNameChange(nextName: string) {
    if (!category) return;
    // Preserve the existing Hindi label when editing the English one. If
    // the category had no `hin` set, leave it unset.
    const next: { eng: string; hin?: string } = { eng: nextName };
    if (category.name.hin) next.hin = category.name.hin;
    updateCategoryMeta({
      profileCategoryId,
      name: next,
      propagateToPack: showAdminButtons,
    }).catch((e) =>
      console.error('[CategoryDetailContent] name update failed', e)
    );
  }

  function handleDeleteRequest(id: Id<'profileSymbols'>, name: string) {
    setPendingDelete({ id, name });
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      // Route through /api/delete-profile-symbol so the server can also
      // sweep personal R2 media (uploads, image-search picks, recorded
      // audio) tied to this symbol. Shared caches (ai-cache/, tts/) are
      // preserved — same policy as Reload Defaults.
      const res = await fetch('/api/delete-profile-symbol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileSymbolId: pendingDelete.id,
          propagateToPack: showAdminButtons,
        }),
      });
      if (!res.ok) {
        console.error('[CategoryDetailContent] delete failed', await res.text());
      }
    } catch (e) {
      console.error('[CategoryDetailContent] delete request errored', e);
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
    updateCategoryMeta({
      profileCategoryId,
      imagePath,
      propagateToPack: showAdminButtons,
    }).catch((e) =>
      console.error('[CategoryDetailContent] folder image update failed', e)
    );
    setFolderImageModalOpen(false);
  }

  async function handleToggleDefault() {
    try {
      await setCategoryDefault({ profileCategoryId, on: !isDefault });
      showToast({
        tone: 'info',
        title: !isDefault ? t('toastDefaultOn') : t('toastDefaultOff'),
      });
    } catch (e) {
      console.error('[CategoryDetailContent] toggle default failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
  }

  async function handleToggleLibrary() {
    if (isInLibrary) {
      try {
        await setCategoryInLibrary({ profileCategoryId, on: false });
        showToast({ tone: 'info', title: t('toastLibraryOff') });
      } catch (e) {
        console.error('[CategoryDetailContent] toggle library off failed', e);
        showToast({ tone: 'warning', title: t('toastAdminError') });
      }
      return;
    }
    // ON path is async + needs admin to choose target — defer to the modal.
    setPackPickerOpen(true);
  }

  async function handlePackPickerConfirm(target: PackPickerTarget) {
    try {
      await setCategoryInLibrary({
        profileCategoryId,
        on: true,
        target,
      });
      showToast({ tone: 'info', title: t('toastLibraryOn') });
    } catch (e) {
      console.error('[CategoryDetailContent] save to library failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
      throw e; // let the modal stay open on failure
    }
  }

  async function handleSetTier(tier: 'free' | 'pro' | 'max') {
    if (!linkedPackId) return;
    try {
      await setLibraryPackTier({ packId: linkedPackId, tier });
      showToast({ tone: 'info', title: t('toastTierUpdated') });
    } catch (e) {
      console.error('[CategoryDetailContent] set tier failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
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

  if (!accountId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-body" style={{ color: 'var(--theme-secondary-text)' }}>{t('noProfile')}</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-theme-mobile-general py-theme-mobile-general md:px-theme-general md:py-theme-general gap-theme-mobile-gap md:gap-theme-gap">

      {/* Admin disclaimer — visible only when admin in admin viewMode is
          editing content that's published to a pack. Reminds the admin
          that their edits will reach every new sign-up loading this pack. */}
      <AdminPackEditingBanner
        visible={showAdminButtons && (isDefault || isInLibrary)}
        packLabel={
          isDefault
            ? 'Default'
            : (linkedLibraryPack?.name.eng ?? undefined)
        }
      />

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          {/* Admin pack-status label rendered above the title inside the
              banner card — visible only in admin view, both edit and
              view modes. */}
          {(() => {
            const packLabel = showAdminButtons && packsStatus ? (
              <PackStatusLabel
                publishedToPackId={category?.publishedToPackId}
                packs={packsStatus}
                language={language}
              />
            ) : null;
            return isEditing ? (
              <div
                className="relative rounded-theme p-3 min-h-[200px] flex flex-col justify-center"
                style={{ background: getCategoryColour(draftColour).c700 }}
              >
                {packLabel && (
                  <div className="mb-2 self-start">{packLabel}</div>
                )}
                <BannerEdit
                  categoryName={categoryName}
                  onCategoryNameChange={handleCategoryNameChange}
                  imagePath={draftImagePath}
                  draftColour={draftColour}
                  onColourChange={handleColourChange}
                  onExit={handleEditExit}
                  onAddSymbol={handleAddSymbol}
                  onEditFolderImage={handleEditFolderImage}
                  showAdminButtons={showAdminButtons}
                  isDefault={isDefault}
                  isInLibrary={isInLibrary}
                  libraryTier={libraryTier}
                  onToggleDefault={handleToggleDefault}
                  onToggleLibrary={handleToggleLibrary}
                  onSetTier={handleSetTier}
                  librarySourceId={category?.librarySourceId}
                  onReloadDefaults={() => setReloadDialogOpen(true)}
                />
              </div>
            ) : (
              <CategoryPageHeader
                categoryName={categoryName}
                imagePath={category?.imagePath}
                colour={category?.colour}
                onEdit={handleEditStart}
                onModel={handleModelClick}
                modelDisabledReason={modelDisabledReason}
                librarySourceId={category?.librarySourceId}
                topSlot={packLabel}
              />
            );
          })()}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-auto" data-modelling-content>
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
          isEditing && !modellingActive ? (
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
                  <ModellingOverlayWrapper
                    key={sym._id}
                    componentKey={`symbol-${sym._id}`}
                    className="rounded-xl"
                  >
                    <SymbolCard
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
                  </ModellingOverlayWrapper>
                );
              })}
            </CategoryBoardGrid>
          )
        )}
      </div>

      {/* Symbol editor modal */}
      {symbolEditorState.isOpen && accountId && (
        <SymbolEditorModal
          isOpen={true}
          profileSymbolId={symbolEditorState.profileSymbolId}
          profileCategoryId={profileCategoryId}
          accountId={accountId}
          language={language}
          onClose={() => setSymbolEditorState({ isOpen: false })}
          onSave={() => setSymbolEditorState({ isOpen: false })}
        />
      )}

      {/* Folder image picker modal — opens on the SymbolStix tab with the
          category name pre-filled in the search bar so the user lands on
          a relevant symbol grid immediately. */}
      {folderImageModalOpen && accountId && (
        <SymbolEditorModal
          isOpen={true}
          accountId={accountId}
          language={language}
          folderImageMode={true}
          initialImagePath={draftImagePath}
          initialLabel={categoryName}
          onClose={() => setFolderImageModalOpen(false)}
          onSave={() => {}}
          onFolderImageSave={handleFolderImageSave}
        />
      )}

      {/* Modelling picker */}
      {studentProfile && (
        <Dialog
          open={pickerOpen}
          onOpenChange={(open) => { if (!open) setPickerOpen(false); }}
        >
          <DialogContent className="max-w-2xl">
            <ModellingPickerModal
              profileId={studentProfile._id}
              profileCategoryId={profileCategoryId}
              language={language}
              onClose={() => setPickerOpen(false)}
            />
          </DialogContent>
        </Dialog>
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

      {/* Make Default + Library are now toggle buttons in the admin row of
          BannerEdit — no confirmation dialog needed. The toggle action is
          reversible via the same toggle. */}

      {/* Reload Defaults — destructive confirmation modal. Only mountable
          when the category was loaded from a library pack (button hidden
          otherwise via BannerEdit's librarySourceId guard). */}
      {category?.librarySourceId && profileCategoryId && (
        <ReloadDefaultsDialog
          open={reloadDialogOpen}
          onOpenChange={setReloadDialogOpen}
          profileCategoryId={profileCategoryId}
          categoryName={categoryName}
          onSuccess={(result: ReloadDefaultsResult) => {
            const successMsg =
              result.symbolsSkipped > 0
                ? t('reloadDefaultsSuccessWithSkipped', {
                    count: result.symbolsAdded,
                    skipped: result.symbolsSkipped,
                  })
                : t('reloadDefaultsSuccess', { count: result.symbolsAdded });
            showToast({ tone: 'info', title: successMsg });
            if (result.filesFailed > 0) {
              showToast({
                tone: 'warning',
                title: t('reloadDefaultsMediaCleanupWarning'),
              });
            }
          }}
        />
      )}

      {/* Library save dialogue — admin-only. Opens when toggling Library ON;
          lets admin create a new pack or append to one they already own. */}
      {showAdminButtons && (
        <LibraryPackPickerModal
          isOpen={packPickerOpen}
          onClose={() => setPackPickerOpen(false)}
          itemKind="category"
          defaultName={categoryName}
          onConfirm={handlePackPickerConfirm}
        />
      )}
    </div>
  );
}
