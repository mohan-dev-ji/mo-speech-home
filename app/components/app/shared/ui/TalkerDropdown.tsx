"use client";

// Quick-access dropdown — the bottom section of the Talker rectangle (ADR-015).
//
// Tab 1 "Core words": tiles for the core-word categories (+ Numbers, Letters).
//   Tapping a tile drills into its symbols. Core words are the structural layer
//   (zinc), pinned for motor planning.
// Tabs 2+ : phrase banks — reusable chunks; tapping inserts a phrase-unit.
//
// Closed: a chevron bar clipped into the rectangle's bottom edge. Open: a portal
// overlay that slides down from the chevron and overlays the page.

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, Hash, Type, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from 'convex/react';
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
import { SymbolCard, type SymbolDisplay } from './SymbolCard';
import { GroupTile } from './GroupTile';
import { TabBar } from '@/app/components/app/settings/ui/TabBar';
import { CategoryBoardGrid } from './CategoryBoardGrid';
import { SymbolCardEditable } from '@/app/components/app/categories/ui/SymbolCardEditable';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import { CreateCategoryModal } from '@/app/components/app/categories/modals/CreateCategoryModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/app/components/app/shared/ui/Dialog';
import type { QuickSymbolItem } from './TalkerBar';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';
import { useProfile } from '@/app/contexts/ProfileContext';
import { getCategoryColour } from '@/app/lib/categoryColours';

const ZINC = getCategoryColour('zinc');

// ─── Static data ──────────────────────────────────────────────────────────────

// These match the exact words.en values in the symbols table.
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '20'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

// ─── Types ────────────────────────────────────────────────────────────────────

// 'core' = the Core-words tab; `bank-<folderId>` = a phrase bank.
type TabId = 'core' | string;

// Drill-in state inside the Core-words tab. null = the tile grid.
type CoreSel =
  | null
  | { kind: 'category'; id: Id<'profileCategories'>; name: string }
  | { kind: 'numbers' }
  | { kind: 'letters' };

type TalkerDropdownProps = {
  language: string;
  onSymbolTap: (item: QuickSymbolItem) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TalkerDropdown({ language, onSymbolTap }: TalkerDropdownProps) {
  const t = useTranslations('talker');
  const { voiceId, accountId } = useProfile();
  const [isOpen, setIsOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('core');
  const [coreSel, setCoreSel]     = useState<CoreSel>(null);
  // Instructor edit mode — turns the core tiles / phrase cards authorable in
  // place (ADR-015 dropdown edit modes). Off = talker/tap mode.
  const [editing, setEditing]     = useState(false);
  const [panelPos, setPanelPos]   = useState({ top: 0, left: 0, width: 0 });
  // Entry animation: the panel slides down from the chevron so it reads as a
  // surface layer settling on top of the navigated category. `entered` flips on
  // the frame after open so the CSS transition runs; `motion-reduce:` snaps it
  // open under OS reduced-motion.
  const [entered, setEntered]     = useState(false);
  // `mounted` keeps the panel in the DOM through the slide-out so close animates
  // too; `entered` drives the transform (in = translateY(0), out = -100%).
  const [mounted, setMounted]     = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  // Core edit-mode state (Step 2). Symbol editor + delete confirms + local
  // drag order for both the category tiles and a category's symbol board.
  const [symbolEditor, setSymbolEditor] = useState<
    | { open: false }
    | { open: true; categoryId: Id<'profileCategories'>; profileSymbolId?: Id<'profileSymbols'> }
  >({ open: false });
  const [pendingCatDelete, setPendingCatDelete] = useState<
    { id: Id<'profileCategories'>; name: string } | null
  >(null);
  const [pendingSymDelete, setPendingSymDelete] = useState<
    { id: Id<'profileSymbols'>; name: string } | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [coreOrder, setCoreOrder] = useState<string[]>([]);
  const [symOrder, setSymOrder]   = useState<string[]>([]);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const barRef                    = useRef<HTMLButtonElement>(null);
  const panelRef                  = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Core-word edit mutations (Step 2).
  const createProfileCategory  = useMutation(api.profileCategories.createProfileCategory);
  const updateCategoryMeta     = useMutation(api.profileCategories.updateCategoryMeta);
  const deleteCategory         = useMutation(api.profileCategories.deleteCategory);
  const reorderCategories      = useMutation(api.profileCategories.reorderCategories);
  const reorderProfileSymbols  = useMutation(api.profileSymbols.reorderProfileSymbols);

  // One-tap backfill of the Phase-14 defaults (core-word categories + phrase
  // banks) into the caller's account — for accounts created before these
  // defaults shipped (seedDefaultAccount only fires at creation). Idempotent;
  // the core/bank queries refresh reactively once it resolves.
  const installDefaults = useMutation(api.profilePhrases.installDefaultBanksAndCore);
  async function handleLoadDefaults() {
    setLoadingDefaults(true);
    try {
      await installDefaults({});
    } finally {
      setLoadingDefaults(false);
    }
  }

  function openPanel() {
    const r = barRef.current?.getBoundingClientRect();
    // Anchor at the bar's BOTTOM: the chevron bar stays put (part of the talker)
    // and the contents slide down from behind it to cover the grid area below.
    if (r) setPanelPos({ top: r.bottom, left: r.left, width: r.width });
    setIsOpen(true);
  }

  // Mount on open; on close, slide out first then unmount after the transition.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    setEntered(false);
    const id = setTimeout(() => setMounted(false), 380);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Once mounted (portal painted at translateY(-100%)), flip `entered` on the
  // next-but-one frame so the slide-in transition actually runs. A single rAF
  // can set the entered state before the initial frame paints, which "pops" the
  // panel open with no animation — the double rAF guarantees a painted start.
  useEffect(() => {
    if (!mounted) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [mounted]);

  // ── Queries — all 'skip' unless the dropdown is open on the matching view.
  //    Convex caches per args so re-visiting a view costs nothing.
  const coreCategories = useQuery(
    api.profileCategories.getCoreWordCategories,
    isOpen ? {} : 'skip'
  );
  const coreSymbols = useQuery(
    api.profileCategories.getProfileSymbolsWithImages,
    isOpen && coreSel?.kind === 'category'
      ? { profileCategoryId: coreSel.id, voiceId }
      : 'skip'
  );
  const numberSymbols = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && coreSel?.kind === 'numbers' ? { words: NUMBERS } : 'skip'
  );
  const letterSymbols = useQuery(
    api.symbols.getSymbolsByWords,
    isOpen && coreSel?.kind === 'letters' ? { words: LETTERS } : 'skip'
  );
  // Phrase banks (ADR-015) — the reusable-chunk tabs. One query returns each
  // phrases-tree folder with its phrases nested.
  const phraseBanks = useQuery(
    api.profilePhrases.getPhraseBanks,
    isOpen ? {} : 'skip'
  );
  const banks = phraseBanks ?? [];
  const coreCats = coreCategories ?? [];

  // ── Local drag order (Step 2) — keep new server rows, drop removed ones,
  //    preserve the instructor's in-flight ordering.
  useEffect(() => {
    if (coreCategories === undefined) return;
    const ids = coreCats.map((c) => c._id as string);
    setCoreOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [coreCategories]);

  useEffect(() => {
    if (coreSymbols === undefined) return;
    const ids = coreSymbols.map((s) => s._id as string);
    setSymOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [coreSymbols]);

  const coreCatMap = new Map(coreCats.map((c) => [c._id as string, c]));
  const orderedCoreCats = coreOrder.map((id) => coreCatMap.get(id)).filter(Boolean) as typeof coreCats;
  const coreSymMap = new Map((coreSymbols ?? []).map((s) => [s._id as string, s]));
  const orderedCoreSymbols = symOrder.map((id) => coreSymMap.get(id)).filter(Boolean) as NonNullable<typeof coreSymbols>;

  // ── Core-word edit handlers (Step 2) ────────────────────────────────────────
  function handleCatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCoreOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
      reorderCategories({ orderedIds: next as Id<'profileCategories'>[] }).catch((e) =>
        console.error('[TalkerDropdown] reorder categories failed', e)
      );
      return next;
    });
  }

  function handleSymDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || coreSel?.kind !== 'category') return;
    const categoryId = coreSel.id;
    setSymOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
      reorderProfileSymbols({ profileCategoryId: categoryId, orderedIds: next as Id<'profileSymbols'>[] }).catch((e) =>
        console.error('[TalkerDropdown] reorder symbols failed', e)
      );
      return next;
    });
  }

  function handleRenameCategory(id: Id<'profileCategories'>, current: Record<string, string>, next: string) {
    updateCategoryMeta({
      profileCategoryId: id,
      name: { ...current, [language]: next },
    }).catch((e) => console.error('[TalkerDropdown] rename category failed', e));
  }

  async function handleCatDeleteConfirm() {
    if (!pendingCatDelete) return;
    setIsDeleting(true);
    try {
      await deleteCategory({ profileCategoryId: pendingCatDelete.id });
    } catch (e) {
      console.error('[TalkerDropdown] delete category failed', e);
    } finally {
      setIsDeleting(false);
      setPendingCatDelete(null);
    }
  }

  async function handleSymDeleteConfirm() {
    if (!pendingSymDelete) return;
    setIsDeleting(true);
    try {
      // Route through the API so personal R2 media is swept too — same policy
      // as the category board's delete.
      const res = await fetch('/api/delete-profile-symbol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileSymbolId: pendingSymDelete.id }),
      });
      if (!res.ok) console.error('[TalkerDropdown] delete symbol failed', await res.text());
    } catch (e) {
      console.error('[TalkerDropdown] delete symbol errored', e);
    } finally {
      setIsDeleting(false);
      setPendingSymDelete(null);
    }
  }

  // O(1) word → symbol lookup — built from a getSymbolsByWords result.
  function buildMap(symbols: typeof numberSymbols) {
    return new Map((symbols ?? []).map((s) => [s.words.en ?? '', s]));
  }

  function getTabLabel(id: TabId): string {
    if (id === 'core') return t('tabCoreWords');
    const bank = banks.find((b) => `bank-${b.folderId}` === id);
    return bank ? displayString(bank.name, language, DEFAULT_LOCALE) : id;
  }

  const allTabs: TabId[] = ['core', ...banks.map((b) => `bank-${b.folderId}`)];

  function selectTab(id: TabId) {
    setActiveTab(id);
    if (id !== 'core') setCoreSel(null);
  }

  // "Create Group" (core tab) / "Create Phrase" (bank tab).
  function handleCreateClick() {
    if (activeTab === 'core') setCreateGroupOpen(true);
    // Bank tab (Create Phrase) wired in Step 5.
  }

  // Create a core group (surface:"core") + optional placeholder symbols from the
  // typed words, then drop straight into its edit board so the instructor can
  // bind each placeholder to a symbol.
  async function handleCreateGroup(name: string, symbolLabels: string[]) {
    const id = await createProfileCategory({
      name: { [language]: name },
      symbolLabels,
      surface: 'core',
    });
    setCoreSel({ kind: 'category', id, name });
  }

  function handleTap(item: QuickSymbolItem) {
    onSymbolTap(item);
  }

  // ── Renderers ───────────────────────────────────────────────────────────────

  function spinner() {
    return (
      <div className="col-span-full flex items-center justify-center py-8">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--theme-nav-text)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // Numbers / Letters drill-in — symbols resolved by word (getSymbolsByWords).
  function renderWordList(words: string[], symbols: typeof numberSymbols) {
    if (symbols === undefined) return spinner();
    const map = buildMap(symbols);
    return words.map((word) => {
      const sym       = map.get(word);
      const label     = sym ? displayString(sym.words, language, DEFAULT_LOCALE) : word;
      const imagePath = sym ? `/api/assets?key=${sym.imagePath}` : undefined;
      const audioMap  = (sym?.audio as Record<string, boolean> | undefined) ?? {};
      const seeded    = audioMap[voiceId] === true;
      const audioPath = sym
        ? resolveSymbolAudioPath(voiceId, sym.words.en ?? word, seeded, sym.audioBasename) ?? undefined
        : undefined;
      return (
        <SymbolCard
          key={word}
          symbolId={sym?._id ?? `quick-${word}`}
          imagePath={imagePath}
          label={label}
          language={language}
          onTap={() => handleTap({ symbolId: sym?._id ?? `quick-${word}`, label, imagePath, audioPath })}
        />
      );
    });
  }

  // Core-category drill-in — the installed profileSymbols of a core category.
  function renderCoreSymbols(symbols: typeof coreSymbols) {
    if (symbols === undefined) return spinner();
    return symbols.map((row) => {
      const label     = displayString(row.label, language, DEFAULT_LOCALE);
      const imagePath = row.imagePath ? `/api/assets?key=${row.imagePath}` : undefined;
      const audioPath = row.audio[language] ?? row.audio[DEFAULT_LOCALE] ?? row.audio.en;
      return (
        <SymbolCard
          key={row._id}
          symbolId={row._id}
          imagePath={imagePath}
          label={label}
          language={language}
          onTap={() => handleTap({ symbolId: row._id, label, imagePath, audioPath })}
        />
      );
    });
  }

  // Core tile grid — category tiles + the fixed Numbers / Letters tiles.
  function renderCoreTiles() {
    return (
      <div className="flex flex-wrap gap-3 py-2">
        {coreCats.map((c) => (
          <CoreTile
            key={c._id}
            label={displayString(c.name, language, DEFAULT_LOCALE)}
            onClick={() =>
              setCoreSel({ kind: 'category', id: c._id, name: displayString(c.name, language, DEFAULT_LOCALE) })
            }
          />
        ))}
        <CoreTile label={t('tabNumbers')} icon={<Hash className="w-6 h-6" />} onClick={() => setCoreSel({ kind: 'numbers' })} />
        <CoreTile label={t('tabLetters')} icon={<Type className="w-6 h-6" />} onClick={() => setCoreSel({ kind: 'letters' })} />
        {coreCats.length === 0 && coreCategories !== undefined && (
          <div className="flex flex-col items-start gap-2 self-center">
            <span className="text-caption opacity-60" style={{ color: 'var(--theme-nav-text)' }}>
              {t('emptyCore')}
            </span>
            <button
              type="button"
              onClick={handleLoadDefaults}
              disabled={loadingDefaults}
              className="rounded-theme-sm px-4 py-2 text-body font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--theme-brand-primary)', color: '#fff' }}
            >
              {loadingDefaults ? t('loadingDefaults') : t('loadDefaults')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Editable core-tile grid (Step 2) — dashed cards with inline rename, delete
  // and drag-reorder. Numbers / Letters stay structural (non-authorable).
  function renderEditableCoreTiles() {
    return (
      <div className="py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCatDragEnd}>
          <SortableContext items={coreOrder} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-3">
              {orderedCoreCats.map((c) => {
                const label = displayString(c.name, language, DEFAULT_LOCALE);
                return (
                  <div key={c._id} className="w-32">
                    <GroupTile
                      id={c._id}
                      name={label}
                      colour="zinc"
                      imagePath={c.imagePath}
                      isEditing
                      gridSize="small"
                      onOpen={() => setCoreSel({ kind: 'category', id: c._id, name: label })}
                      onRename={(v) => handleRenameCategory(c._id, c.name, v)}
                      onDeleteRequest={() => setPendingCatDelete({ id: c._id, name: label })}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        <div className="flex flex-wrap gap-3 mt-3 opacity-60">
          <CoreTile label={t('tabNumbers')} icon={<Hash className="w-6 h-6" />} onClick={() => {}} />
          <CoreTile label={t('tabLetters')} icon={<Type className="w-6 h-6" />} onClick={() => {}} />
        </div>
      </div>
    );
  }

  // Editable symbol board for a core category drill-in (Step 2) — reuses the
  // category board's editable card + add-symbol placeholder → SymbolEditorModal.
  function renderEditableSymbolBoard() {
    if (coreSel?.kind !== 'category') return null;
    if (coreSymbols === undefined) return spinner();
    const categoryId = coreSel.id;
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSymDragEnd}>
        <SortableContext items={symOrder} strategy={rectSortingStrategy}>
          <CategoryBoardGrid>
            {orderedCoreSymbols.map((sym) => (
              <SortableCoreSymbol
                key={sym._id}
                id={sym._id}
                imagePath={sym.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined}
                label={displayString(sym.label, language, DEFAULT_LOCALE)}
                display={sym.display as SymbolDisplay | undefined}
                onEdit={() => setSymbolEditor({ open: true, categoryId, profileSymbolId: sym._id })}
                onDelete={() =>
                  setPendingSymDelete({ id: sym._id, name: displayString(sym.label, language, DEFAULT_LOCALE) })
                }
              />
            ))}
            <AddTile label={t('symbolAdd')} onClick={() => setSymbolEditor({ open: true, categoryId })} />
          </CategoryBoardGrid>
        </SortableContext>
      </DndContext>
    );
  }

  function renderCoreContent() {
    if (coreSel === null) return editing ? renderEditableCoreTiles() : renderCoreTiles();

    const backLabel =
      coreSel.kind === 'category' ? coreSel.name
        : coreSel.kind === 'numbers' ? t('tabNumbers')
        : t('tabLetters');

    let body: ReactNode;
    if (coreSel.kind === 'category') {
      body = editing
        ? renderEditableSymbolBoard()
        : <CategoryBoardGrid>{renderCoreSymbols(coreSymbols)}</CategoryBoardGrid>;
    } else if (coreSel.kind === 'numbers') {
      body = <CategoryBoardGrid>{renderWordList(NUMBERS, numberSymbols)}</CategoryBoardGrid>;
    } else {
      body = <CategoryBoardGrid>{renderWordList(LETTERS, letterSymbols)}</CategoryBoardGrid>;
    }

    return (
      <>
        <button
          type="button"
          onClick={() => setCoreSel(null)}
          className="flex items-center gap-1 mb-2 text-caption font-medium hover:opacity-70 transition-opacity"
          style={{ color: 'var(--theme-nav-text)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          {t('tabCoreWords')} · {backLabel}
        </button>
        {body}
      </>
    );
  }

  // Phrase-bank tab: zinc phrase cards. Tapping inserts a phrase-unit (its
  // decomposition + clip) into the talker bar (ADR-015).
  function renderPhraseBank() {
    const bank = banks.find((b) => `bank-${b.folderId}` === activeTab);
    if (!bank) return null;
    if (bank.phrases.length === 0) {
      return (
        <span className="text-caption opacity-60 self-center" style={{ color: 'var(--theme-nav-text)' }}>
          {t('emptyBank')}
        </span>
      );
    }
    return bank.phrases.map((p) => {
      const name = displayString(p.name, language, DEFAULT_LOCALE);
      const audioPath = p.recordedAudioPath ?? p.audioPath ?? undefined;
      // RAW imagePath keys (the bar/card build the /api/assets URL themselves).
      const words = p.words.map((w) => ({
        imagePath: w.imagePath,
        audioPath: w.audioPath,
        label: displayString(w.label ?? {}, language, DEFAULT_LOCALE),
      }));
      return (
        <PhraseDropdownCard
          key={p._id}
          name={name}
          words={words}
          onTap={() =>
            handleTap({ symbolId: `phrase-${p._id}`, label: name, kind: 'phrase', phraseName: name, audioPath, words })
          }
        />
      );
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <button
        ref={barRef}
        type="button"
        onClick={isOpen ? () => setIsOpen(false) : openPanel}
        className="flex items-center justify-center w-full h-[50px] border-t border-theme-line hover:opacity-70 transition-opacity"
        style={{ background: 'var(--theme-primary-25)', color: 'var(--theme-nav-text)' }}
        aria-label={isOpen ? t('closeDropdown') : t('openDropdown')}
      >
        {/* Bar stays put; only the chevron rotates on open/close. */}
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {mounted &&
        createPortal(
          <>
            {/* No backdrop — the dropdown opens/closes only from the chevron bar.
                Clip window over the grid area. The inner panel starts fully
                translated up (hidden behind the talker) and slides DOWN to cover
                the grid — slower than the chevron, reading as content pulled out
                from behind the talker. */}
            <div
              style={{
                position: 'fixed',
                top: panelPos.top,
                left: panelPos.left,
                width: panelPos.width,
                bottom: 0,
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              <div
                ref={panelRef}
                className="flex flex-col h-full glass-surface transition-transform duration-[380ms] ease-out motion-reduce:transition-none"
                style={{
                  background: 'var(--theme-background)',
                  borderRadius: '0 0 var(--theme-card-roundness) var(--theme-card-roundness)',
                  transform: entered ? 'translateY(0)' : 'translateY(-100%)',
                }}
              >
                {/* Tab bar — Core words + phrase banks. */}
                <div className="px-4 pt-3 shrink-0 bg-theme-background">
                  <TabBar
                    tabs={allTabs.map((id) => ({ id, label: getTabLabel(id) }))}
                    activeId={activeTab}
                    onSelect={(id) => selectTab(id)}
                  />
                </div>

                {/* Edit / Create chrome — enters instructor edit mode; Create is
                    contextual (Group on the core tab, Phrase on a bank tab). */}
                <div className="flex items-center gap-2 px-4 py-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditing((e) => !e)}
                    className="flex items-center gap-1.5 rounded-theme-sm px-3 py-1.5 text-caption font-medium transition-opacity hover:opacity-90"
                    style={
                      editing
                        ? { background: 'var(--theme-brand-primary)', color: '#fff' }
                        : { border: '1px solid var(--theme-line)', color: 'var(--theme-nav-text)' }
                    }
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {editing ? t('doneLabel') : t('editLabel')}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={handleCreateClick}
                      className="flex items-center gap-1.5 rounded-theme-sm px-3 py-1.5 text-caption font-medium transition-opacity hover:opacity-90"
                      style={{ border: '1px solid var(--theme-line)', color: 'var(--theme-nav-text)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {activeTab === 'core' ? t('createGroup') : t('createPhrase')}
                    </button>
                  )}
                </div>

                {/* Content. */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {activeTab === 'core' ? (
                    renderCoreContent()
                  ) : (
                    <div className="flex flex-wrap gap-3 py-2">{renderPhraseBank()}</div>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* Create Group — reuses the New-category modal; stamps surface:"core". */}
      <CreateCategoryModal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreate={handleCreateGroup}
      />

      {/* Symbol editor — create / edit a core symbol (categoryBoard mode). Its
          own portal, so it layers above the dropdown panel. */}
      {symbolEditor.open && accountId && (
        <SymbolEditorModal
          isOpen
          profileSymbolId={symbolEditor.profileSymbolId}
          profileCategoryId={symbolEditor.categoryId}
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="categoryBoard"
          onClose={() => setSymbolEditor({ open: false })}
          onSave={() => setSymbolEditor({ open: false })}
        />
      )}

      {/* Delete confirmations — core group + core symbol. */}
      <Dialog open={pendingCatDelete !== null} onOpenChange={(o) => { if (!o) setPendingCatDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('groupDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('groupDeleteConfirm', { name: pendingCatDelete?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('deleteCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleCatDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            >
              {isDeleting ? t('deleting') : t('deleteConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingSymDelete !== null} onOpenChange={(o) => { if (!o) setPendingSymDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('symbolDelete')}</DialogTitle>
            <DialogDescription>{t('groupDeleteConfirm', { name: pendingSymDelete?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('deleteCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleSymDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            >
              {isDeleting ? t('deleting') : t('deleteConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Sortable core symbol (edit board) ──────────────────────────────────────────

function SortableCoreSymbol({
  id,
  imagePath,
  label,
  display,
  onEdit,
  onDelete,
}: {
  id: string;
  imagePath?: string;
  label: string;
  display?: SymbolDisplay;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style}>
      <SymbolCardEditable
        imagePath={imagePath}
        label={label}
        display={display}
        categoryColour="zinc"
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

// ─── Add-symbol placeholder tile ─────────────────────────────────────────────────

function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-full aspect-square rounded-theme-card border-2 border-dashed border-theme-enter-mode flex items-center justify-center transition-opacity hover:opacity-80"
    >
      <Plus className="w-8 h-8" style={{ color: 'var(--theme-enter-mode)' }} />
    </button>
  );
}

// ─── Core tile (zinc) ───────────────────────────────────────────────────────────

function CoreTile({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center justify-center gap-2 w-32 h-28 rounded-theme p-3 transition-opacity hover:opacity-90 shrink-0"
      style={{ background: ZINC.c500, color: '#fff' }}
    >
      {icon}
      <span className="text-body font-medium text-center">{label}</span>
    </button>
  );
}

// ─── Phrase card (zinc box) for a phrase-bank tab ───────────────────────────────

function PhraseDropdownCard({
  name,
  words,
  onTap,
}: {
  name: string;
  words: { imagePath?: string; label: string }[];
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={name}
      className="flex flex-col items-center gap-2 rounded-theme p-3 transition-opacity hover:opacity-90 shrink-0"
      style={{ background: ZINC.c500 }}
    >
      <div className="flex items-end gap-2">
        {words.length === 0 ? (
          <div className="w-20 h-20 rounded-theme-sm" style={{ background: ZINC.c100 }} />
        ) : (
          words.map((w, i) => (
            <div
              key={i}
              className="w-20 h-20 rounded-theme-sm overflow-hidden flex items-center justify-center"
              style={{ background: ZINC.c100 }}
            >
              {w.imagePath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/assets?key=${w.imagePath}`}
                  alt={w.label}
                  className="w-full h-full object-contain p-1.5"
                  draggable={false}
                />
              ) : (
                <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>
                  {w.label}
                </span>
              )}
            </div>
          ))
        )}
      </div>
      <span
        className="text-caption font-medium rounded-full px-3 py-0.5"
        style={{ background: ZINC.c700, color: '#fff' }}
      >
        {name}
      </span>
    </button>
  );
}
