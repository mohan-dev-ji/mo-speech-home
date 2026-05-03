"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowLeft, ListOrdered, CheckSquare, Pencil, LogOut, Bookmark, Library } from 'lucide-react';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker } from '@/app/contexts/TalkerContext';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { useToast } from '@/app/components/app/shared/ui/Toast';
import { ToggleButton } from '@/app/components/app/shared/ui/ToggleButton';
import { PlanTierPicker } from '@/app/components/app/shared/ui/PlanTierPicker';
import { AdminPackBadge } from '@/app/components/app/shared/ui/packStatusBadge';
import { SymbolEditorModal, type ListItemSaveResult } from '@/app/components/app/shared/modals/symbol-editor';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '@/app/components/app/shared/ui/Dialog';
import { FormatDropdown } from '@/app/components/app/lists/ui/ListItemAtoms';
import { DisplayRows, DisplayColumns, DisplayGrid, ListItemPlayModal, type PlayModalState } from '@/app/components/app/lists/sections/ListDetailDisplay';
import { EditRows, EditColumns, EditGrid } from '@/app/components/app/lists/sections/ListDetailEdit';
import type { ListItem } from '@/app/components/app/lists/types';

type Props = { listId: Id<'profileLists'> };

export function ListDetailContent({ listId }: Props) {
  const t = useTranslations('lists');
  const router = useRouter();
  const { setBreadcrumbExtra } = useBreadcrumb();
  const { language, viewMode, accountId, stateFlags, studentProfile } = useProfile();
  const { talkerMode } = useTalker();
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const showAdminButtons = viewMode === 'admin' && isAdmin;

  const [isEditing, setIsEditing] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [localItems, setLocalItems] = useState<ListItem[]>([]);
  const localItemsRef = useRef<ListItem[]>([]);
  const [symbolPickerForIndex, setSymbolPickerForIndex] = useState<number | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [playModal, setPlayModal] = useState<PlayModalState>(null);

  const list = useQuery(api.profileLists.getProfileListWithItems, { profileListId: listId });
  const updateItems = useMutation(api.profileLists.updateProfileListItems);
  const updateDisplay = useMutation(api.profileLists.updateProfileListDisplay);
  const setListDefault = useMutation(api.resourcePacks.setListDefault);
  const setListInLibrary = useMutation(api.resourcePacks.setListInLibrary);
  const setLibraryPackTier = useMutation(api.resourcePacks.setLibraryPackTier);

  // Pack status — drives Default/Library toggle pressed states + tier picker.
  const packsStatus = useQuery(api.resourcePacks.getPacksForAdminStatus, showAdminButtons ? {} : 'skip');
  const linkedPackId = list?.publishedToPackId;
  const isDefault = !!(linkedPackId && packsStatus && linkedPackId === packsStatus.starterPackId);
  const linkedLibraryPack = linkedPackId && packsStatus ? packsStatus.libraryPacksById[linkedPackId] : undefined;
  const isInLibrary = !!linkedLibraryPack;
  const libraryTier = linkedLibraryPack?.tier ?? 'free';

  useEffect(() => {
    if (!list) return;
    const mapped = list.items.map((item, i) => ({
      ...item,
      localId: `item-${i}-${item.imagePath ?? 'empty'}`,
    }));
    setLocalItems(mapped);
    localItemsRef.current = mapped;
  }, [list]);

  useEffect(() => { localItemsRef.current = localItems; }, [localItems]);

  useEffect(() => {
    if (!list) return;
    const label = language === 'hin' && list.name.hin ? list.name.hin : list.name.eng;
    setBreadcrumbExtra({ label });
    return () => setBreadcrumbExtra(null);
  }, [list, language, setBreadcrumbExtra]);

  async function persistItems(items: ListItem[]) {
    await updateItems({
      profileListId: listId,
      items: items.map((item, i) => ({
        imagePath: item.imagePath,
        order: i,
        description: item.description,
        audioPath: item.audioPath,
        activeAudioSource: item.activeAudioSource,
        defaultAudioPath: item.defaultAudioPath,
        generatedAudioPath: item.generatedAudioPath,
        recordedAudioPath: item.recordedAudioPath,
        imageSourceType: item.imageSourceType,
      })),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.localId === active.id);
      const newIdx = prev.findIndex((i) => i.localId === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);
      persistItems(next);
      return next;
    });
  }

  function handleDescriptionChange(index: number, value: string) {
    setLocalItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], description: value };
      return next;
    });
  }

  function handleDescriptionBlur() {
    persistItems(localItemsRef.current);
  }

  async function handleListItemSaved(result: ListItemSaveResult) {
    if (symbolPickerForIndex === null) return;
    const idx = symbolPickerForIndex;
    const prev = localItemsRef.current;
    const merge = (item: ListItem): ListItem => ({
      ...item,
      imagePath:          result.imagePath,
      description:        result.description ?? item.description,
      audioPath:          result.audioPath,
      activeAudioSource:  result.activeAudioSource,
      defaultAudioPath:   result.defaultAudioPath,
      generatedAudioPath: result.generatedAudioPath,
      recordedAudioPath:  result.recordedAudioPath,
      imageSourceType:    result.imageSourceType,
    });
    const next =
      idx < prev.length
        ? prev.map((item, i) => (i === idx ? merge(item) : item))
        : [
            ...prev,
            merge({
              localId: `item-${prev.length}-${Date.now()}`,
              order: prev.length,
            }),
          ];
    setLocalItems(next);
    setSymbolPickerForIndex(null);
    await persistItems(next);
  }

  async function handleDeleteItemConfirm() {
    if (pendingDeleteIndex === null) return;
    setIsDeletingItem(true);
    try {
      const next = localItems.filter((_, i) => i !== pendingDeleteIndex);
      setLocalItems(next);
      await persistItems(next);
    } finally {
      setIsDeletingItem(false);
      setPendingDeleteIndex(null);
    }
  }

  function handleRemoveSymbol(index: number) {
    const next = localItems.map((item, i) => i === index ? { ...item, imagePath: undefined } : item);
    setLocalItems(next);
    persistItems(next);
  }

  async function handleToggleDefault() {
    try {
      await setListDefault({ profileListId: listId, on: !isDefault });
      showToast({
        tone: 'info',
        title: !isDefault ? t('toastDefaultOn') : t('toastDefaultOff'),
      });
    } catch (e) {
      console.error('[ListDetailContent] toggle default failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
  }

  async function handleToggleLibrary() {
    try {
      if (isInLibrary) {
        await setListInLibrary({ profileListId: listId, on: false });
        showToast({ tone: 'info', title: t('toastLibraryOff') });
      } else {
        await setListInLibrary({ profileListId: listId, on: true, tier: 'free' });
        showToast({ tone: 'info', title: t('toastLibraryOn') });
      }
    } catch (e) {
      console.error('[ListDetailContent] toggle library failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
  }

  async function handleSetTier(tier: 'free' | 'pro' | 'max') {
    if (!linkedPackId) return;
    try {
      await setLibraryPackTier({ packId: linkedPackId, tier });
      showToast({ tone: 'info', title: t('toastTierUpdated') });
    } catch (e) {
      console.error('[ListDetailContent] set tier failed', e);
      showToast({ tone: 'warning', title: t('toastAdminError') });
    }
  }

  function toggleChecked(localId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId); else next.add(localId);
      return next;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const showFirstThen: boolean = (list as any)?.showFirstThen ?? false;

  function toggleNumbers() {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: list.displayFormat, showNumbers: !list.showNumbers, showChecklist: list.showChecklist, showFirstThen });
  }
  function toggleChecklist() {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: list.displayFormat, showNumbers: list.showNumbers, showChecklist: !list.showChecklist, showFirstThen });
  }
  function toggleFirstThen() {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: list.displayFormat, showNumbers: list.showNumbers, showChecklist: list.showChecklist, showFirstThen: !showFirstThen });
  }
  function handleFormatChange(fmt: 'rows' | 'columns' | 'grid') {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: fmt, showNumbers: list.showNumbers, showChecklist: list.showChecklist, showFirstThen });
  }

  if (!list) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const listName = language === 'hin' && list.name.hin ? list.name.hin : list.name.eng;
  const isColumns = list.displayFormat === 'columns';

  const editProps = {
    items: localItems,
    showNumbers: list.showNumbers,
    showChecklist: list.showChecklist,
    onDragEnd: handleDragEnd,
    onDeleteRequest: (index: number) => setPendingDeleteIndex(index),
    onDescriptionChange: handleDescriptionChange,
    onDescriptionBlur: handleDescriptionBlur,
    onAddSymbol: (index: number) => setSymbolPickerForIndex(index),
    onRemoveSymbol: handleRemoveSymbol,
    onAddItem: () => setSymbolPickerForIndex(localItems.length),
  };

  const displayProps = {
    items: localItems,
    showNumbers: list.showNumbers,
    showChecklist: list.showChecklist,
    showFirstThen,
    checkedIds,
    onToggle: toggleChecked,
    onItemClick: (index: number) => setPlayModal({ item: localItems[index], index }),
  };

  return (
    <div className={`p-theme-mobile-general md:p-theme-general flex flex-col gap-theme-mobile-gap md:gap-theme-gap${isColumns ? ' h-full overflow-hidden' : ''}`}>

      {/* Header — banner mode only; talker mode renders nothing so no empty div creates phantom gap */}
      {stateFlags.talker_visible && talkerMode === 'banner' && (
        <div className="shrink-0 relative">
          {/* Admin status badge — top-right of the banner */}
          {showAdminButtons && packsStatus && (
            <div className="absolute top-2 right-2 z-30 pointer-events-none">
              <AdminPackBadge
                publishedToPackId={list.publishedToPackId}
                packs={packsStatus}
              />
            </div>
          )}
          <PageBanner title={listName}>
            <button type="button" onClick={() => router.back()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-semibold transition-opacity hover:opacity-90" style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}>
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('back')}
            </button>
            <button type="button" onClick={toggleNumbers} className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80" style={{ background: list.showNumbers ? 'var(--theme-button-highlight)' : 'var(--theme-card)', color: list.showNumbers ? 'var(--theme-text)' : 'var(--theme-text-primary)' }}>
              <ListOrdered className="w-3.5 h-3.5" />
              {t('numberedList')}
            </button>
            <button type="button" onClick={toggleChecklist} className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80" style={{ background: list.showChecklist ? 'var(--theme-button-highlight)' : 'var(--theme-card)', color: list.showChecklist ? 'var(--theme-text)' : 'var(--theme-text-primary)' }}>
              <CheckSquare className="w-3.5 h-3.5" />
              {t('checklist')}
            </button>
            <button type="button" onClick={toggleFirstThen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80" style={{ background: showFirstThen ? 'var(--theme-button-highlight)' : 'var(--theme-card)', color: showFirstThen ? 'var(--theme-text)' : 'var(--theme-text-primary)' }}>
              {t('firstThen')}
            </button>
            {isEditing ? (
              <button type="button" onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-semibold transition-opacity hover:opacity-90" style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}>
                <LogOut className="w-3.5 h-3.5" />
                {t('exitEdit')}
              </button>
            ) : (
              <button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80" style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}>
                <Pencil className="w-3.5 h-3.5" />
                {t('editList')}
              </button>
            )}
            <FormatDropdown value={list.displayFormat} onChange={handleFormatChange} />
          </PageBanner>

          {/* Admin row — separate bounding box below the PageBanner so the
              instructor toolbar stays visually distinct. Only rendered for
              admins in admin viewMode. See ADR-008. */}
          {showAdminButtons && (
            <div
              className="mt-2 flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-theme"
              style={{
                background: 'rgba(255,200,0,0.06)',
                border: '1px solid rgba(255,200,0,0.2)',
              }}
            >
              <ToggleButton
                pressed={isDefault}
                disabled={isInLibrary}
                onClick={handleToggleDefault}
                icon={<Bookmark className="w-3.5 h-3.5" />}
              >
                {t('toggleDefault')}
              </ToggleButton>
              <ToggleButton
                pressed={isInLibrary}
                disabled={isDefault}
                onClick={handleToggleLibrary}
                icon={<Library className="w-3.5 h-3.5" />}
              >
                {t('toggleLibrary')}
              </ToggleButton>
              {isInLibrary && (
                <PlanTierPicker
                  value={libraryTier}
                  onChange={handleSetTier}
                  translationNamespace="lists"
                />
              )}
            </div>
          )}
        </div>
      )}
      {!stateFlags.talker_visible && (
        <button type="button" onClick={() => router.back()} className="flex items-center gap-1 text-theme-s font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--theme-text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" />
          {t('back')}
        </button>
      )}

      {localItems.length === 0 && !isEditing && (
        <div className="flex items-center justify-center py-16">
          <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>{t('itemEmpty')}</p>
        </div>
      )}

      {/* Edit mode — layout matches display format */}
      {isEditing && (
        list.displayFormat === 'columns' ? <EditColumns {...editProps} /> :
        list.displayFormat === 'grid'    ? <EditGrid    {...editProps} /> :
                                           <EditRows    {...editProps} />
      )}

      {/* Display mode */}
      {!isEditing && localItems.length > 0 && (
        list.displayFormat === 'columns' ? <DisplayColumns {...displayProps} /> :
        list.displayFormat === 'grid'    ? <DisplayGrid    {...displayProps} /> :
                                           <DisplayRows    {...displayProps} />
      )}

      <ListItemPlayModal
        state={playModal}
        showNumbers={list.showNumbers}
        showChecklist={list.showChecklist}
        showFirstThen={showFirstThen}
        checkedIds={checkedIds}
        onToggle={toggleChecked}
        onClose={() => setPlayModal(null)}
      />

      {symbolPickerForIndex !== null && accountId && (
        <SymbolEditorModal
          isOpen={true}
          accountId={accountId}
          language={language}
          editorMode="listItem"
          voiceId={studentProfile?.voiceId ?? 'en-GB-News-M'}
          initialLabel={localItems[symbolPickerForIndex]?.description}
          initialImagePath={localItems[symbolPickerForIndex]?.imagePath}
          initialAudioPath={localItems[symbolPickerForIndex]?.audioPath}
          initialActiveAudioSource={localItems[symbolPickerForIndex]?.activeAudioSource}
          initialDefaultAudioPath={localItems[symbolPickerForIndex]?.defaultAudioPath}
          initialGeneratedAudioPath={localItems[symbolPickerForIndex]?.generatedAudioPath}
          initialRecordedAudioPath={localItems[symbolPickerForIndex]?.recordedAudioPath}
          initialImageSourceType={localItems[symbolPickerForIndex]?.imageSourceType}
          onClose={() => setSymbolPickerForIndex(null)}
          onSave={() => {}}
          onListItemSave={handleListItemSaved}
        />
      )}

      <Dialog open={pendingDeleteIndex !== null} onOpenChange={(open) => { if (!open) setPendingDeleteIndex(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteItemTitle')}</DialogTitle>
            <DialogDescription>{t('deleteItemConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}>
                {t('deleteItemCancel')}
              </button>
            </DialogClose>
            <button type="button" onClick={handleDeleteItemConfirm} disabled={isDeletingItem} className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50" style={{ background: 'var(--theme-warning)', color: '#fff' }}>
              {isDeletingItem ? t('deletingItem') : t('deleteItemButton')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Make Default + Library are now toggle buttons in the admin row above
          the PageBanner — no confirmation dialog needed. */}
    </div>
  );
}
