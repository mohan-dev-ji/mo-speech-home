"use client";

import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
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
import { displayString, displayValue } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { useModellingSession } from '@/app/contexts/ModellingSessionContext';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { CategoryBoardGrid } from '@/app/components/app/shared/ui/CategoryBoardGrid';
import { SymbolCard } from '@/app/components/app/shared/ui/SymbolCard';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';
import { SymbolCardEditable } from '@/app/components/app/categories/ui/SymbolCardEditable';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { CategoryPageHeader } from '@/app/components/app/categories/ui/CategoryPageHeader';
import { BannerEdit } from '@/app/components/app/categories/ui/BannerEdit';
import { PublishModuleModal } from '@/app/components/app/shared/modals/PublishModuleModal';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import { ModellingPickerModal } from '@/app/components/app/categories/modals/ModellingPickerModal';
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
  label: Record<string, string>;
  pinnedLanguage?: string; // Phase 15 (Thread 1)
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
  // Per-language audio paths keyed by ISO 639-1 code. Empty record means no
  // override exists — the consumer falls back to TTS via the audio resolver.
  audio?: Record<string, string>;
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

  const label = displayString(sym.label, language, DEFAULT_LOCALE);
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

  const { language, viewMode, stateFlags, accountId, studentProfile, voiceId } = useProfile();
  const { talkerMode, addToTalker } = useTalker();
  const { setBreadcrumbExtra } = useBreadcrumb();
  const { isActive: modellingActive } = useModellingSession();
  const { subscription } = useAppState();
  const tBanner = useTranslations('banner');

  // Modelling trigger gate. Two paths:
  //  - Instructor / admin view: Pro+ tier is the only requirement. The
  //    instructor's button is unconditional once subscribed.
  //  - Student view: Pro+ tier AND the per-student `modelling_push` flag is
  //    explicitly true. This lets an independent AAC user self-initiate
  //    modelling sessions when their instructor opts them in via profile
  //    permissions. Default is off — most students participate passively
  //    through instructor-pushed sessions.
  const hasModelling = subscription.tier !== 'free';
  const studentAllowsSelfModel =
    studentProfile?.stateFlags?.modelling_push === true;
  const canModel =
    hasModelling &&
    (viewMode !== 'student-view' || studentAllowsSelfModel);
  const modelDisabledReason = canModel
    ? undefined
    : !hasModelling
      ? tBanner('modelDisabled.upgrade')
      : tBanner('modelDisabled.studentView');
  const [pickerOpen, setPickerOpen] = useState(false);
  const handleModelClick = canModel
    ? () => setPickerOpen(true)
    : undefined;

  // ── Edit state ──────────────────────────────────────────────────────────────
  // Honour `?edit=1` on first mount — set by CategoriesContent's create flow
  // so brand-new categories land in edit mode and the user can tap each
  // placeholder symbol to fill in an image.
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(
    () => searchParams.get('edit') === '1'
  );
  const [draftColour, setDraftColour] = useState('orange');
  const [draftImagePath, setDraftImagePath] = useState<string | undefined>(undefined);
  const [symbolEditorState, setSymbolEditorState] = useState<SymbolEditorState>({ isOpen: false });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  // Last-seen server id-set, so the localOrder sync below can run during render
  // (not in an effect) only when the set actually changes.
  const [seenOrderKey, setSeenOrderKey] = useState<string | null>(null);

  // ── Convex ──────────────────────────────────────────────────────────────────
  const profileCategoryId = categoryId as Id<'profileCategories'>;

  const category = useQuery(
    api.profileCategories.getProfileCategory,
    { profileCategoryId }
  );

  const symbols = useQuery(
    api.profileCategories.getProfileSymbolsWithImages,
    { profileCategoryId, voiceId }
  );

  // Warn-but-allow: how many OTHER items still reference this symbol's
  // personal image/audio keys. Non-blocking — shown as an extra line in the
  // delete confirm below when > 0.
  const pendingDeleteUsageCount = useQuery(
    api.profileSymbols.getProfileSymbolUsageCount,
    pendingDelete ? { profileSymbolId: pendingDelete.id } : 'skip'
  );

  // deleteProfileSymbol now routed through /api/delete-profile-symbol so
  // the server can also clean up R2 personal media on delete. See
  // handleDeleteConfirm below.
  const reorderProfileSymbols = useMutation(api.profileSymbols.reorderProfileSymbols);

  // ── Admin gating + pack status ──────────────────────────────────────────────
  const isAdmin = useIsAdmin();
  const showAdminButtons = viewMode === 'admin' && isAdmin;

  // A starter/default-origin module still drives the AdminPackEditingBanner
  // disclaimer: edits reach every new sign-up that installs this default.
  const isDefault = category?.librarySourceId === '_starter';

  // Publish button label — "Update module" once this category has been
  // published, else "Publish as module". Matches the list/sentence pages.
  const publishModuleLabel = category?.publishedModuleSlug
    ? t('bannerUpdateModule')
    : t('bannerPublishModule');

  // ── dnd-kit sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Sync localOrder from server ─────────────────────────────────────────────
  // Adjust during render (not in an effect) when the server id-set changes:
  // keep still-present ids in their local order, prepend newcomers. Guarded by
  // `seenOrderKey` so it runs only on an actual change (React's "adjust state
  // when inputs change" pattern) — avoids a setState-in-effect cascade.
  if (symbols) {
    const serverIds = symbols.map((s) => s._id as string);
    const orderKey = serverIds.join(',');
    if (orderKey !== seenOrderKey) {
      setSeenOrderKey(orderKey);
      setLocalOrder((prev) => {
        const kept = prev.filter((id) => serverIds.includes(id));
        const added = serverIds.filter((id) => !prev.includes(id));
        return [...added, ...kept];
      });
    }
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

  // Free-tier gate on entering edit mode. Cascades: blocking the toggle
  // means Add Symbol, Reorder, Reload Defaults, and Rename (all only
  // reachable inside BannerEdit) are auto-locked. Folder colour + image are
  // edited on the grid tile a level up, not here.
  const isFree = subscription.tier === 'free';
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);
  const params = useParams();
  const locale = (params?.locale as string | undefined) ?? 'en';

  function handleEditStart() {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setDraftColour(category?.colour ?? 'orange');
    setDraftImagePath(category?.imagePath);
    setIsEditing(true);
  }

  function handleEditExit() {
    setIsEditing(false);
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

  // ── Breadcrumb ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!category) return;
    const name = displayString(category.name, language, DEFAULT_LOCALE);
    setBreadcrumbExtra({ label: name, colour: category.colour });
    return () => setBreadcrumbExtra(null);
  }, [category, language, setBreadcrumbExtra]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const categoryName = category
    ? displayString(category.name, language, DEFAULT_LOCALE)
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
        visible={showAdminButtons && isDefault}
        packLabel={isDefault ? 'Default' : undefined}
      />

      {/* Page header — only in banner mode; talker mode shows PersistentTalker in layout */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0">
          {isEditing ? (
            <div
              className="relative rounded-theme p-3 flex flex-col justify-center"
              style={{ background: `color-mix(in srgb, ${getCategoryColour(draftColour).c500} 30%, transparent)` }}
            >
              <BannerEdit
                categoryName={categoryName}
                imagePath={draftImagePath}
                draftColour={draftColour}
                onExit={handleEditExit}
                onAddSymbol={handleAddSymbol}
                onPublishModule={showAdminButtons ? () => setPublishOpen(true) : undefined}
                publishModuleLabel={publishModuleLabel}
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
              onPublishModule={showAdminButtons ? () => setPublishOpen(true) : undefined}
              publishModuleLabel={publishModuleLabel}
            />
          )}
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
                {/* px/pt gives each card's corner ✕ badge room so the top row
                    and right column aren't clipped by the scroll container. */}
                <div className="px-2 pt-2">
                  <CategoryBoardGrid>
                    {orderedSymbols.map((sym) => (
                      <SortableSymbolCard
                      key={sym._id}
                      sym={sym}
                      // Phase 15 (Thread 1): show the pinned language in edit mode too,
                      // so it matches view mode (was always the board language).
                      language={sym.pinnedLanguage ?? language}
                      categoryColour={category?.colour}
                      onEdit={handleEditSymbol}
                      onDeleteRequest={handleDeleteRequest}
                    />
                  ))}
                  </CategoryBoardGrid>
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="px-2 pt-2">
              <CategoryBoardGrid>
                {symbols.map((sym) => {
                // Phase 15 (Thread 1): a pinned symbol renders + speaks in its
                // pinned language regardless of the board language.
                const resolveLang = sym.pinnedLanguage ?? language;
                const label = displayString(sym.label, resolveLang, DEFAULT_LOCALE);
                const audioPath = displayValue(sym.audio, resolveLang, DEFAULT_LOCALE);
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
                            // Phase 15: carry the full localised record (Task 6); a
                            // pinned symbol carries only its pinned language so the
                            // pin survives into a saved sentence (Thread 1).
                            labelRecord: sym.pinnedLanguage ? { [sym.pinnedLanguage]: label } : sym.label,
                          });
                        }
                      }}
                    />
                  </ModellingOverlayWrapper>
                );
              })}
              </CategoryBoardGrid>
            </div>
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
          voiceId={voiceId}
          onClose={() => setSymbolEditorState({ isOpen: false })}
          onSave={() => setSymbolEditorState({ isOpen: false })}
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
            {!!pendingDeleteUsageCount && pendingDeleteUsageCount > 0 && (
              <p className="text-theme-s text-theme-secondary-text mt-1">
                {t('symbolDeleteInUse', { count: pendingDeleteUsageCount })}
              </p>
            )}
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

      {/* Publish as module — turn this category into its own library module.
          Fires from the module's own page (this banner), not the grid tile. */}
      {publishOpen && category && (
        <PublishModuleModal
          kind="category"
          targetId={category._id}
          defaultName={displayString(category.name, language, DEFAULT_LOCALE)}
          publishedSlug={category.publishedModuleSlug}
          publishedClass={category.publishedModuleClass}
          onClose={() => setPublishOpen(false)}
        />
      )}


      {/* Free-tier upgrade nudge — fires from handleEditStart when the user
          is on the free tier. */}
      <UpgradeNudge
        open={upgradeNudgeOpen}
        onOpenChange={setUpgradeNudgeOpen}
        locale={locale}
      />
    </div>
  );
}
