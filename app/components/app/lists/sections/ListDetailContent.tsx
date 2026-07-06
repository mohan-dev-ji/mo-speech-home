"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { useBreadcrumb } from '@/app/contexts/BreadcrumbContext';
import { useAppState } from '@/app/contexts/AppStateProvider';
import { UpgradeNudge } from '@/app/components/app/shared/ui/UpgradeNudge';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowLeft, ListOrdered, CheckSquare } from 'lucide-react';
import { PageBanner } from '@/app/components/app/shared/ui/PageBanner';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { AdminPackEditingBanner } from '@/app/components/app/shared/ui/AdminPackEditingBanner';
import { useIsSmallScreen } from '@/app/hooks/useIsSmallScreen';
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
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string | undefined) ?? 'en';
  const { setBreadcrumbExtra } = useBreadcrumb();
  const { language, viewMode, accountId, stateFlags, voiceId } = useProfile();
  const { subscription } = useAppState();
  const isFree = subscription.tier === 'free';
  const isAdmin = useIsAdmin();
  const showAdminButtons = viewMode === 'admin' && isAdmin;
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // Free-tier intercept on entering edit mode. Cascades — once edit is
  // gated, Add Item / Reorder / Delete / Rename are all locked since
  // they only render inside edit mode.
  const handleEditToggle = () => {
    if (isFree) { setUpgradeNudgeOpen(true); return; }
    setIsEditing(!isEditing);
  };

  // Honour `?edit=1` on first mount — set by ListsModeContent's create flow
  // so brand-new lists land in edit mode and the user is nudged to pick
  // symbols for the descriptions they just typed.
  const [isEditing, setIsEditing] = useState(
    () => searchParams.get('edit') === '1'
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [localItems, setLocalItems] = useState<ListItem[]>([]);
  const localItemsRef = useRef<ListItem[]>([]);
  const [symbolPickerForIndex, setSymbolPickerForIndex] = useState<number | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [playModal, setPlayModal] = useState<PlayModalState>(null);
  // Draft for the editable banner title. Synced from the server name on
  // load + on every server change so a remote rename (or an Escape revert)
  // restores the canonical value.
  const [nameDraft, setNameDraft] = useState('');

  const list = useQuery(api.profileLists.getProfileListWithItems, { profileListId: listId });
  // Group this list belongs to (ADR-014) — drives the Lists › <group> › <list>
  // breadcrumb + the banner back chevron.
  const folder = useQuery(
    api.profileFolders.getProfileFolder,
    list?.folderId ? { folderId: list.folderId } : 'skip',
  );
  const updateItems = useMutation(api.profileLists.updateProfileListItems);
  const updateDisplay = useMutation(api.profileLists.updateProfileListDisplay);
  const renameList = useMutation(api.profileLists.updateProfileListName);

  // Pack-origin status still drives the AdminPackEditingBanner disclaimer.
  // Backend query is dormant/kept; the pack *controls* moved to the folder
  // publish flow (GroupsView → PublishModuleModal).
  const packsStatus = useQuery(api.resourcePacks.getPacksForAdminStatusV2, showAdminButtons ? {} : 'skip');
  const linkedSlug = list?.librarySourceId;
  const isDefault = linkedSlug === '_starter';
  const linkedLibraryPack = linkedSlug && linkedSlug !== '_starter' && packsStatus
    ? packsStatus.libraryPacksBySlug[linkedSlug]
    : undefined;
  const isInLibrary = !!linkedLibraryPack;

  useEffect(() => {
    if (!list) return;
    // Hydrate UI items from Convex rows. `description` lives in the schema as
    // a localised record; collapse to a current-locale string for the editor.
    const mapped: ListItem[] = list.items.map((item, i) => ({
      ...item,
      description:
        typeof item.description === 'string'
          ? item.description
          : displayString(item.description, language, DEFAULT_LOCALE),
      localId: `item-${i}-${item.imagePath ?? 'empty'}`,
    }));
    setLocalItems(mapped);
    localItemsRef.current = mapped;
  }, [list, language]);

  useEffect(() => { localItemsRef.current = localItems; }, [localItems]);

  useEffect(() => {
    if (!list) return;
    const label = displayString(list.name, language, DEFAULT_LOCALE);
    const listCrumb = { label };
    // Lists › <group|Ungrouped> › <list>.
    const groupLabel = list.folderId
      ? folder
        ? displayString(folder.name, language, DEFAULT_LOCALE)
        : null
      : t('ungrouped');
    if (groupLabel) {
      setBreadcrumbExtra([{ label: groupLabel }, listCrumb]);
    } else {
      setBreadcrumbExtra(listCrumb);
    }
    return () => setBreadcrumbExtra(null);
  }, [list, folder, language, t, setBreadcrumbExtra]);

  // Keep the editable-title draft in sync with the server name. Runs on
  // load and on any remote rename / locale switch; also restores the
  // canonical value if the user reverts an in-progress edit via Escape.
  useEffect(() => {
    if (!list) return;
    const next = displayString(list.name, language, DEFAULT_LOCALE);
    setNameDraft(next);
  }, [list, language]);

  async function persistItems(items: ListItem[]) {
    await updateItems({
      profileListId: listId,
      propagateToPack: showAdminButtons,
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
    (updateDisplay as any)({ profileListId: listId, displayFormat: list.displayFormat, showNumbers: !list.showNumbers, showChecklist: list.showChecklist, showFirstThen, propagateToPack: showAdminButtons });
  }
  function toggleChecklist() {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: list.displayFormat, showNumbers: list.showNumbers, showChecklist: !list.showChecklist, showFirstThen, propagateToPack: showAdminButtons });
  }
  function toggleFirstThen() {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: list.displayFormat, showNumbers: list.showNumbers, showChecklist: list.showChecklist, showFirstThen: !showFirstThen, propagateToPack: showAdminButtons });
  }
  function handleFormatChange(fmt: 'rows' | 'columns' | 'grid') {
    if (!list) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updateDisplay as any)({ profileListId: listId, displayFormat: fmt, showNumbers: list.showNumbers, showChecklist: list.showChecklist, showFirstThen, propagateToPack: showAdminButtons });
  }

  // Small screens force a 'rows' layout regardless of saved displayFormat —
  // columns/grid don't fit comfortably on mobile and the dropdown is hidden
  // there too. The saved value is preserved so the user's choice returns
  // when they're back on desktop. Called before the early return below to
  // keep hook order stable across renders.
  const isSmallScreen = useIsSmallScreen();

  if (!list) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const listName = displayString(list.name, language, DEFAULT_LOCALE);
  const effectiveDisplayFormat = isSmallScreen ? 'rows' : list.displayFormat;
  const isColumns = effectiveDisplayFormat === 'columns';

  // Commit the editable banner title. Mirrors BannerEdit's category
  // pattern: ignore empty/unchanged values, preserve every other locale's
  // label, propagate to the pack snapshot only when admin in admin view.
  async function commitName() {
    if (!list) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === listName) {
      setNameDraft(listName);
      return;
    }
    const nextName: Record<string, string> = {
      ...list.name,
      [language]: trimmed,
    };
    try {
      await renameList({
        profileListId: listId,
        name: nextName,
        propagateToPack: showAdminButtons,
      });
    } catch (e) {
      console.error('[ListDetailContent] rename failed', e);
      setNameDraft(listName);
    }
  }

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

  // Group colour tint (ADR-014) — colour-codes this list's banner + item cards
  // with its group's colour (via `--group-card`). Unset when the list has no
  // group / no colour.
  const groupTint = folder?.colour
    ? `color-mix(in srgb, ${getCategoryColour(folder.colour).c500} 30%, transparent)`
    : undefined;

  return (
    <div
      className={`p-theme-mobile-general md:p-theme-general flex flex-col gap-theme-mobile-gap md:gap-theme-gap${isColumns ? ' h-full overflow-hidden' : ''}`}
      style={groupTint ? ({ '--group-card': groupTint } as React.CSSProperties) : undefined}
    >

      {/* Admin disclaimer — visible only when admin in admin viewMode is
          editing a list that's published to a pack. */}
      <AdminPackEditingBanner
        visible={showAdminButtons && (isDefault || isInLibrary)}
        packLabel={
          isDefault
            ? 'Default'
            : (linkedLibraryPack ? displayString(linkedLibraryPack.name, language, DEFAULT_LOCALE) : undefined)
        }
      />

      {/* Header — permanent banner: the talker never replaces it on a list
          detail page, so it shows regardless of talker/banner mode. */}
      {stateFlags.talker_visible && (
        <div className="shrink-0 relative">
          <PageBanner
            title={listName}
            backHref={`/${locale}/lists/folder/${list.folderId ?? 'ungrouped'}`}
            backLabel={t('groupBack', {
              name: folder
                ? displayString(folder.name, language, DEFAULT_LOCALE)
                : t('ungrouped'),
            })}
            titleSlot={isEditing ? (
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setNameDraft(listName);
                    e.currentTarget.blur();
                  }
                }}
                aria-label={t('editNameLabel')}
                className="text-theme-h3 font-bold leading-tight truncate min-w-0 w-full bg-transparent outline-none rounded-theme-sm px-1.5 -mx-1.5 transition-colors focus:bg-white/8"
                style={{
                  color: 'var(--theme-text-primary)',
                  // Persistent dashed border whenever the editable input is
                  // mounted (i.e. edit mode is on) — signals "this is editable"
                  // before the user clicks. Matches BannerEdit on categories.
                  border: '1px dashed var(--theme-enter-mode)',
                }}
              />
            ) : undefined}
          >
            {/* Row 1 — list-mode toggles. `w-full` forces the next group
                onto its own row inside the PageBanner's flex-wrap container. */}
            <div className="w-full flex items-center flex-wrap gap-2">
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
            </div>

            {/* Row 2 — edit affordance + display-format dropdown. */}
            <div className="w-full flex items-center flex-wrap gap-2">
              <EditButton
                isEditing={isEditing}
                onClick={handleEditToggle}
                editLabel={t('editList')}
                exitLabel={t('exitEdit')}
              />
              {/* Format dropdown is desktop-only — small screens force rows. */}
              {!isSmallScreen && (
                <FormatDropdown value={list.displayFormat} onChange={handleFormatChange} />
              )}
            </div>
          </PageBanner>
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

      {/* Edit mode — layout matches effective display format (forced to
          rows on small screens). */}
      {isEditing && (
        effectiveDisplayFormat === 'columns' ? <EditColumns {...editProps} /> :
        effectiveDisplayFormat === 'grid'    ? <EditGrid    {...editProps} /> :
                                               <EditRows    {...editProps} />
      )}

      {/* Display mode */}
      {!isEditing && localItems.length > 0 && (
        effectiveDisplayFormat === 'columns' ? <DisplayColumns {...displayProps} /> :
        effectiveDisplayFormat === 'grid'    ? <DisplayGrid    {...displayProps} /> :
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
        voiceId={voiceId}
      />

      {symbolPickerForIndex !== null && accountId && (
        <SymbolEditorModal
          isOpen={true}
          accountId={accountId}
          language={language}
          editorMode="listItem"
          voiceId={voiceId}
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

      {/* Free-tier upgrade nudge — fires from handleEditToggle when the
          user is on the free tier. */}
      <UpgradeNudge
        open={upgradeNudgeOpen}
        onOpenChange={setUpgradeNudgeOpen}
        locale={locale}
      />
    </div>
  );
}
