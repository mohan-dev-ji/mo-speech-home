"use client";

// Talker dropbar — a flat fringe board (2-tab experiment). Two fixed tabs:
//   Tab 1 "Core words"  — a scrollable STABLE-SLOT grid of single symbols. A
//     symbol's `order` IS its slot index (gaps stay); edit mode adds an
//     "add row" bar and lets you place / drag / delete symbols by slot.
//   Tab 2 "Phrases"     — flowing phrase cards (2+ symbols + audio), edited
//     inline (echoes the sentence editor). No stable slots — phrases span.
//
// One tap inserts into the talker bar; open drop → choose → close. The two
// containers are canonical per-account rows addressed by librarySourceId
// sentinels (convex/dropbar.ts).

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Pencil, Plus, Trash2, Move, X, Volume2, Mic } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from 'convex/react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
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
import { TabBar } from '@/app/components/app/settings/ui/TabBar';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import { CreateSentenceModal } from '@/app/components/app/sentences/modals/CreateSentenceModal';
import { SentenceAudioModal } from '@/app/components/app/sentences/modals/SentenceAudioModal';
import { PublishModuleModal } from '@/app/components/app/shared/modals/PublishModuleModal';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import type { SentenceSlotSaveResult } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
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
import { useProfile } from '@/app/contexts/ProfileContext';
import { getCategoryColour } from '@/app/lib/categoryColours';

const ZINC = getCategoryColour('zinc');

// Fixed grid — columns are constant for v1 (wire to grid_size later). MIN_ROWS
// keeps the board a recognisable shape even when nearly empty.
const COLS = 6;
const MIN_ROWS = 3;

type TabId = 'core' | 'phrases';

type TalkerDropdownProps = {
  language: string;
  onSymbolTap: (item: QuickSymbolItem) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TalkerDropdown({ language, onSymbolTap }: TalkerDropdownProps) {
  const t = useTranslations('talker');
  const { voiceId, accountId } = useProfile();
  const isAdmin = useIsAdmin();
  const [isOpen, setIsOpen]       = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('core');
  const [editing, setEditing]     = useState(false);
  const [panelPos, setPanelPos]   = useState({ top: 0, left: 0, width: 0 });
  const [entered, setEntered]     = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [addedRows, setAddedRows] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createPhraseOpen, setCreatePhraseOpen] = useState(false);

  // Tab 1 symbol editor + delete.
  const [symbolEditor, setSymbolEditor] = useState<
    | { open: false }
    | { open: true; slot?: number; profileSymbolId?: Id<'profileSymbols'> }
  >({ open: false });
  const [pendingSymDelete, setPendingSymDelete] = useState<
    { id: Id<'profileSymbols'>; name: string } | null
  >(null);

  // Tab 2 phrase edit state.
  const [phraseOrder, setPhraseOrder] = useState<string[]>([]);
  const [phraseWordEditor, setPhraseWordEditor] = useState<
    | { open: false }
    | { open: true; phraseId: Id<'profilePhrases'>; wordIndex: number }
  >({ open: false });
  const [phraseAudioTarget, setPhraseAudioTarget] = useState<
    { id: Id<'profilePhrases'>; nameRec: Record<string, string> } | null
  >(null);
  const [pendingPhraseDelete, setPendingPhraseDelete] = useState<
    { id: Id<'profilePhrases'>; name: string } | null
  >(null);

  // Admin: publish the current tab's container as the shipped default. Slug is
  // forced to the sentinel so re-seeding converges on the same containers.
  const [publishTarget, setPublishTarget] = useState<
    | { kind: 'category'; targetId: string; slug: string; name: string }
    | { kind: 'phrases'; targetId: string; slug: string; name: string }
    | null
  >(null);

  const barRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Mutations.
  const ensureContainers         = useMutation(api.dropbar.ensureDropbarContainers);
  const moveProfileSymbolToSlot  = useMutation(api.profileSymbols.moveProfileSymbolToSlot);
  const updateProfilePhraseName  = useMutation(api.profilePhrases.updateProfilePhraseName);
  const updateProfilePhraseWords = useMutation(api.profilePhrases.updateProfilePhraseWords);
  const updateProfilePhraseAudio = useMutation(api.profilePhrases.updateProfilePhraseAudio);
  const deleteProfilePhrase      = useMutation(api.profilePhrases.deleteProfilePhrase);
  const reorderProfilePhrases    = useMutation(api.profilePhrases.reorderProfilePhrases);
  const createProfilePhrase      = useMutation(api.profilePhrases.createProfilePhrase);

  function openPanel() {
    const r = barRef.current?.getBoundingClientRect();
    if (r) setPanelPos({ top: r.bottom, left: r.left, width: r.width });
    setIsOpen(true);
  }

  useEffect(() => {
    if (isOpen) { setMounted(true); return; }
    setEntered(false);
    const id = setTimeout(() => setMounted(false), 380);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!mounted) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, [mounted]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const board = useQuery(api.dropbar.getDropbarBoard, isOpen ? {} : 'skip');
  const coreCategoryId = board?.coreCategoryId ?? null;
  const coreSymbols = useQuery(
    api.profileCategories.getProfileSymbolsWithImages,
    isOpen && coreCategoryId ? { profileCategoryId: coreCategoryId, voiceId } : 'skip'
  );
  const phrases = useQuery(api.dropbar.getDropbarPhrases, isOpen ? {} : 'skip');

  // Get-or-create the two containers the first time the board resolves without
  // them (accounts that predate the seeded defaults).
  useEffect(() => {
    if (!isOpen || !board) return;
    if (board.coreCategoryId && board.phrasesFolderId) return;
    ensureContainers({}).catch((e) => console.error('[TalkerDropdown] ensure containers failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, board]);

  // Leaving edit mode / switching tab drops any transient empty rows.
  useEffect(() => { if (!editing) setAddedRows(0); }, [editing]);

  // ── Tab 1 (Core words) — stable-slot grid ───────────────────────────────────
  const slotMap = new Map((coreSymbols ?? []).map((s) => [s.order, s]));
  const occupiedMax = (coreSymbols ?? []).reduce((m, s) => Math.max(m, s.order), -1);
  const contentRows = Math.ceil((occupiedMax + 1) / COLS);
  const rows = Math.max(MIN_ROWS, contentRows) + (editing ? addedRows : 0);
  const totalCells = rows * COLS;

  function handleTapSymbol(sym: NonNullable<typeof coreSymbols>[number]) {
    const label = displayString(sym.label, language, DEFAULT_LOCALE);
    const imagePath = sym.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined;
    const audioPath = sym.audio[language] ?? sym.audio[DEFAULT_LOCALE] ?? sym.audio.en;
    onSymbolTap({ symbolId: sym._id, label, imagePath, audioPath });
  }

  function handleSymbolDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('slot-')) return;
    const slot = Number(overId.slice('slot-'.length));
    moveProfileSymbolToSlot({ profileSymbolId: active.id as Id<'profileSymbols'>, slot }).catch((e) =>
      console.error('[TalkerDropdown] move symbol to slot failed', e)
    );
  }

  async function handleSymDeleteConfirm() {
    if (!pendingSymDelete) return;
    setIsDeleting(true);
    try {
      // Route through the API so personal R2 media is swept too (gap stays —
      // deleteProfileSymbol does not renumber).
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

  // ── Tab 2 (Phrases) ─────────────────────────────────────────────────────────
  const phraseList = phrases ?? [];

  useEffect(() => {
    if (phrases === undefined) return;
    const ids = phraseList.map((p) => p._id as string);
    setPhraseOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases]);

  const phraseMap = new Map(phraseList.map((p) => [p._id as string, p]));
  const orderedPhrases = phraseOrder.map((id) => phraseMap.get(id)).filter(Boolean) as typeof phraseList;

  function findPhrase(id: Id<'profilePhrases'>) {
    return phraseList.find((p) => p._id === id);
  }

  function normaliseWords(words: typeof phraseList[number]['words']) {
    return words.map((w, i) => ({
      order: i,
      imagePath: w.imagePath,
      audioPath: w.audioPath,
      label: w.label,
      displayProps: w.displayProps,
    }));
  }

  function handlePhraseDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPhraseOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string));
      reorderProfilePhrases({ orderedIds: next as Id<'profilePhrases'>[] }).catch((e) =>
        console.error('[TalkerDropdown] reorder phrases failed', e)
      );
      return next;
    });
  }

  function handleRenamePhrase(id: Id<'profilePhrases'>, current: Record<string, string>, next: string) {
    updateProfilePhraseName({ profilePhraseId: id, name: { ...current, [language]: next } }).catch((e) =>
      console.error('[TalkerDropdown] rename phrase failed', e)
    );
  }

  function handleRemovePhraseWord(phraseId: Id<'profilePhrases'>, wordIndex: number) {
    const phrase = findPhrase(phraseId);
    if (!phrase) return;
    const words = normaliseWords(phrase.words.filter((_, i) => i !== wordIndex));
    updateProfilePhraseWords({ profilePhraseId: phraseId, words }).catch((e) =>
      console.error('[TalkerDropdown] remove phrase word failed', e)
    );
  }

  function handlePhraseWordSave(result: SentenceSlotSaveResult) {
    if (!phraseWordEditor.open) return;
    const { phraseId, wordIndex } = phraseWordEditor;
    const phrase = findPhrase(phraseId);
    if (!phrase) { setPhraseWordEditor({ open: false }); return; }
    const current = normaliseWords(phrase.words);
    if (wordIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
    } else if (current[wordIndex]) {
      current[wordIndex] = { ...current[wordIndex], imagePath: result.imagePath, displayProps: result.displayProps };
    }
    const reindexed = current.map((w, i) => ({ ...w, order: i }));
    updateProfilePhraseWords({ profilePhraseId: phraseId, words: reindexed }).catch((e) =>
      console.error('[TalkerDropdown] save phrase word failed', e)
    );
    setPhraseWordEditor({ open: false });
  }

  async function handlePhraseDeleteConfirm() {
    if (!pendingPhraseDelete) return;
    setIsDeleting(true);
    try {
      await deleteProfilePhrase({ profilePhraseId: pendingPhraseDelete.id });
    } catch (e) {
      console.error('[TalkerDropdown] delete phrase failed', e);
    } finally {
      setIsDeleting(false);
      setPendingPhraseDelete(null);
    }
  }

  async function handleCreatePhrase(name: string) {
    const folderId = board?.phrasesFolderId;
    if (!folderId) return;
    await createProfilePhrase({ name: { [language]: name }, folderId });
  }

  function selectTab(id: TabId) {
    setActiveTab(id);
    setAddedRows(0);
  }

  // ── Renderers ───────────────────────────────────────────────────────────────

  function renderCoreGrid() {
    if (coreSymbols === undefined) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--theme-nav-text)', borderTopColor: 'transparent' }} />
        </div>
      );
    }
    return (
      <DndContext key="core-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSymbolDragEnd}>
        <div
          className="grid gap-2 py-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalCells }, (_, slot) => {
            const sym = slotMap.get(slot);
            return (
              <SlotCell
                key={slot}
                slot={slot}
                editing={editing}
                symbolId={sym?._id}
                imageUrl={sym?.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined}
                label={sym ? displayString(sym.label, language, DEFAULT_LOCALE) : ''}
                display={sym?.display as SymbolDisplay | undefined}
                language={language}
                addLabel={t('symbolAdd')}
                removeLabel={t('symbolDelete')}
                onTap={sym ? () => handleTapSymbol(sym) : undefined}
                onAddAt={() => setSymbolEditor({ open: true, slot })}
                onEdit={sym ? () => setSymbolEditor({ open: true, profileSymbolId: sym._id, slot }) : undefined}
                onDelete={sym ? () => setPendingSymDelete({ id: sym._id, name: displayString(sym.label, language, DEFAULT_LOCALE) }) : undefined}
              />
            );
          })}
        </div>
        {editing && (
          <button
            type="button"
            onClick={() => setAddedRows((n) => n + 1)}
            className="w-full mt-2 mb-3 py-2.5 rounded-theme-sm border-2 border-dashed flex items-center justify-center gap-2 text-caption font-medium transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--theme-enter-mode)', color: 'var(--theme-nav-text)' }}
          >
            <Plus className="w-4 h-4" />
            {t('addRow')}
          </button>
        )}
      </DndContext>
    );
  }

  function renderPhrasesTab() {
    if (phrases === undefined) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--theme-nav-text)', borderTopColor: 'transparent' }} />
        </div>
      );
    }

    if (editing) {
      if (orderedPhrases.length === 0) {
        return <span className="text-caption opacity-60 self-center" style={{ color: 'var(--theme-nav-text)' }}>{t('emptyBank')}</span>;
      }
      return (
        <DndContext key="phrase-cards" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePhraseDragEnd}>
          <SortableContext items={phraseOrder} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-4 py-2">
              {orderedPhrases.map((p) => {
                const name = displayString(p.name, language, DEFAULT_LOCALE);
                const words = p.words.map((w) => ({
                  imagePath: w.imagePath,
                  label: displayString(w.label ?? {}, language, DEFAULT_LOCALE),
                }));
                const hasAudio = !!(p.recordedAudioPath ?? p.audioPath);
                const incomplete = p.words.length < 2;
                return (
                  <PhraseEditCard
                    key={p._id}
                    id={p._id}
                    name={name}
                    words={words}
                    hasAudio={hasAudio}
                    incomplete={incomplete}
                    incompleteLabel={t('phraseNeedsTwo')}
                    audioReadyLabel={t('phraseAudioReady')}
                    audioGenerateLabel={t('phraseAudioGenerate')}
                    renameLabel={t('phraseRename')}
                    addLabel={t('phraseAddSymbol')}
                    removeLabel={t('phraseRemoveSymbol')}
                    deleteLabel={t('phraseDelete')}
                    moveLabel={t('phraseMove')}
                    onRename={(v) => handleRenamePhrase(p._id, p.name, v)}
                    onWordAdd={() => setPhraseWordEditor({ open: true, phraseId: p._id, wordIndex: -1 })}
                    onWordEdit={(i) => setPhraseWordEditor({ open: true, phraseId: p._id, wordIndex: i })}
                    onWordDelete={(i) => handleRemovePhraseWord(p._id, i)}
                    onAudio={() => setPhraseAudioTarget({ id: p._id, nameRec: p.name })}
                    onDelete={() => setPendingPhraseDelete({ id: p._id, name })}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      );
    }

    // Normal mode — only ready phrases (2+ symbols) are tappable to insert.
    const ready = phraseList.filter((p) => p.words.length >= 2);
    if (ready.length === 0) {
      return <span className="text-caption opacity-60 self-center" style={{ color: 'var(--theme-nav-text)' }}>{t('emptyBank')}</span>;
    }
    return (
      <div className="flex flex-wrap gap-3 py-2">
        {ready.map((p) => {
          const name = displayString(p.name, language, DEFAULT_LOCALE);
          const audioPath = p.recordedAudioPath ?? p.audioPath ?? undefined;
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
                onSymbolTap({ symbolId: `phrase-${p._id}`, label: name, kind: 'phrase', phraseName: name, audioPath, words })
              }
            />
          );
        })}
      </div>
    );
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
        <ChevronDown
          className={`w-5 h-5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {mounted &&
        createPortal(
          <>
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
                {/* Tab bar — exactly two fixed tabs. */}
                <div className="px-4 pt-3 shrink-0 bg-theme-background">
                  <TabBar
                    tabs={[
                      { id: 'core', label: t('tabCoreWords') },
                      { id: 'phrases', label: t('tabPhrases') },
                    ]}
                    activeId={activeTab}
                    onSelect={(id) => selectTab(id as TabId)}
                  />
                </div>

                {/* Edit chrome. */}
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
                  {editing && activeTab === 'phrases' && (
                    <button
                      type="button"
                      onClick={() => setCreatePhraseOpen(true)}
                      className="flex items-center gap-1.5 rounded-theme-sm px-3 py-1.5 text-caption font-medium transition-opacity hover:opacity-90"
                      style={{ border: '1px solid var(--theme-line)', color: 'var(--theme-nav-text)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('createPhrase')}
                    </button>
                  )}
                  {/* Admin: publish this tab's container as the shipped default. */}
                  {editing && isAdmin && (
                    (activeTab === 'core' ? coreCategoryId : board?.phrasesFolderId) && (
                      <button
                        type="button"
                        onClick={() =>
                          activeTab === 'core'
                            ? setPublishTarget({ kind: 'category', targetId: coreCategoryId!, slug: 'dropbar-core', name: 'Core words' })
                            : setPublishTarget({ kind: 'phrases', targetId: board!.phrasesFolderId!, slug: 'dropbar-phrases', name: 'Phrases' })
                        }
                        className="ml-auto flex items-center gap-1.5 rounded-theme-sm px-3 py-1.5 text-caption font-medium transition-opacity hover:opacity-90"
                        style={{ border: '1px solid var(--theme-primary)', color: 'var(--theme-primary)' }}
                      >
                        {t('publishDefault')}
                      </button>
                    )
                  )}
                </div>

                {/* Content. */}
                <div className="flex-1 overflow-y-auto px-4 pb-2">
                  {activeTab === 'core' ? renderCoreGrid() : renderPhrasesTab()}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* Create Phrase — reuses the New-sentence modal; files into the folder. */}
      <CreateSentenceModal
        isOpen={createPhraseOpen}
        onClose={() => setCreatePhraseOpen(false)}
        onCreate={handleCreatePhrase}
        title={t('createPhraseTitle')}
        nameLabel={t('createPhraseNameLabel')}
        placeholder={t('createPhrasePlaceholder')}
      />

      {/* Admin: publish the current tab's container as the shipped default.
          publishedSlug forces the sentinel slug + opens in default class. */}
      {publishTarget && (
        <PublishModuleModal
          kind={publishTarget.kind}
          targetId={publishTarget.targetId}
          defaultName={publishTarget.name}
          publishedSlug={publishTarget.slug}
          publishedClass="default"
          onClose={() => setPublishTarget(null)}
        />
      )}

      {/* Tab 1 symbol editor — create-at-slot (createSlot) or edit an existing. */}
      {symbolEditor.open && accountId && coreCategoryId && (
        <SymbolEditorModal
          isOpen
          profileSymbolId={symbolEditor.profileSymbolId}
          profileCategoryId={coreCategoryId}
          createSlot={symbolEditor.profileSymbolId ? undefined : symbolEditor.slot}
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="categoryBoard"
          onClose={() => setSymbolEditor({ open: false })}
          onSave={() => setSymbolEditor({ open: false })}
        />
      )}

      {/* Symbol delete confirmation. */}
      <Dialog open={pendingSymDelete !== null} onOpenChange={(o) => { if (!o) setPendingSymDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('symbolDelete')}</DialogTitle>
            <DialogDescription>{t('groupDeleteConfirm', { name: pendingSymDelete?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}>
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

      {/* Phrase word editor — pick/swap the symbol for a phrase word. */}
      {phraseWordEditor.open && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="sentenceSlot"
          initialImagePath={
            phraseWordEditor.wordIndex >= 0
              ? findPhrase(phraseWordEditor.phraseId)?.words[phraseWordEditor.wordIndex]?.imagePath
              : undefined
          }
          onClose={() => setPhraseWordEditor({ open: false })}
          onSave={() => {}}
          onSentenceSlotSave={handlePhraseWordSave}
        />
      )}

      {/* Phrase audio — reuses the sentence audio modal via saveOverride. */}
      {phraseAudioTarget && accountId && (
        <SentenceAudioModal
          isOpen
          sentenceId={null}
          accountId={accountId}
          initialValue={displayString(phraseAudioTarget.nameRec, language, DEFAULT_LOCALE)}
          title={t('phraseEditTitle')}
          fieldLabel={t('phraseFieldLabel')}
          onClose={() => setPhraseAudioTarget(null)}
          saveOverride={async ({ text, recordedAudioPath }) => {
            const target = phraseAudioTarget;
            if (!target) return;
            if (text) {
              await updateProfilePhraseName({ profilePhraseId: target.id, name: { ...target.nameRec, [language]: text } });
            }
            if (recordedAudioPath !== undefined) {
              await updateProfilePhraseAudio({ profilePhraseId: target.id, recordedAudioPath });
            }
          }}
        />
      )}

      {/* Phrase delete confirmation. */}
      <Dialog open={pendingPhraseDelete !== null} onOpenChange={(o) => { if (!o) setPendingPhraseDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('phraseDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('phraseDeleteConfirm', { name: pendingPhraseDelete?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="px-4 py-2 rounded-theme-sm text-theme-s font-medium" style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}>
                {t('deleteCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handlePhraseDeleteConfirm}
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

// ─── Slot cell (Tab 1 stable-slot grid) ─────────────────────────────────────────

function SlotCell({
  slot,
  editing,
  symbolId,
  imageUrl,
  label,
  display,
  language,
  addLabel,
  removeLabel,
  onTap,
  onAddAt,
  onEdit,
  onDelete,
}: {
  slot: number;
  editing: boolean;
  symbolId?: Id<'profileSymbols'>;
  imageUrl?: string;
  label: string;
  display?: SymbolDisplay;
  language: string;
  addLabel: string;
  removeLabel: string;
  onTap?: () => void;
  onAddAt: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `slot-${slot}` });
  const { setNodeRef: setDragRef, listeners, attributes, transform, isDragging } =
    useDraggable({ id: (symbolId as string) ?? `empty-${slot}`, disabled: !symbolId || !editing });

  const dragStyle: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
    height: '100%',
  };

  // Empty cell.
  if (!symbolId) {
    return (
      <div ref={setDropRef} className="aspect-square">
        {editing ? (
          <button
            type="button"
            onClick={onAddAt}
            aria-label={addLabel}
            className="w-full h-full rounded-theme-card border-2 border-dashed flex items-center justify-center transition-opacity hover:opacity-80"
            style={{ borderColor: isOver ? 'var(--theme-brand-primary)' : 'var(--theme-enter-mode)' }}
          >
            <Plus className="w-5 h-5" style={{ color: 'var(--theme-enter-mode)' }} />
          </button>
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
    );
  }

  // Filled cell — square in both modes. In edit: whole card drags, tap opens the
  // editor, an X badge deletes. In normal: tap inserts.
  return (
    <div
      ref={setDropRef}
      className="aspect-square relative"
      style={{ outline: isOver && editing ? '2px solid var(--theme-brand-primary)' : undefined, borderRadius: 'var(--theme-card-roundness)' }}
    >
      <div
        ref={setDragRef}
        style={dragStyle}
        className={editing ? 'cursor-grab active:cursor-grabbing touch-none' : ''}
        {...(editing ? listeners : {})}
        {...(editing ? attributes : {})}
      >
        <SymbolCard
          symbolId={symbolId}
          imagePath={imageUrl}
          label={label}
          language={language}
          display={display}
          categoryColour="zinc"
          onTap={editing ? (onEdit ?? (() => {})) : (onTap ?? (() => {}))}
        />
      </div>
      {editing && onDelete && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={removeLabel}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow z-10"
          style={{ background: 'var(--theme-warning)', color: '#fff' }}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Phrase edit card (stacked, Tab 2) ──────────────────────────────────────────

function WordChip({
  imagePath,
  label,
  removeLabel,
  onEdit,
  onDelete,
}: {
  imagePath?: string;
  label: string;
  removeLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onEdit}
        aria-label={label}
        className="w-16 h-16 rounded-theme-sm overflow-hidden flex items-center justify-center"
        style={{ background: ZINC.c100 }}
      >
        {imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/api/assets?key=${imagePath}`} alt={label} className="w-full h-full object-contain p-1" draggable={false} />
        ) : (
          <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{label}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={removeLabel}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function PhraseEditCard({
  id,
  name,
  words,
  hasAudio,
  incomplete,
  incompleteLabel,
  audioReadyLabel,
  audioGenerateLabel,
  renameLabel,
  addLabel,
  removeLabel,
  deleteLabel,
  moveLabel,
  onRename,
  onWordAdd,
  onWordEdit,
  onWordDelete,
  onAudio,
  onDelete,
}: {
  id: string;
  name: string;
  words: { imagePath?: string; label: string }[];
  hasAudio: boolean;
  incomplete: boolean;
  incompleteLabel: string;
  audioReadyLabel: string;
  audioGenerateLabel: string;
  renameLabel: string;
  addLabel: string;
  removeLabel: string;
  deleteLabel: string;
  moveLabel: string;
  onRename: (value: string) => void;
  onWordAdd: () => void;
  onWordEdit: (index: number) => void;
  onWordDelete: (index: number) => void;
  onAudio: () => void;
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

  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    else setDraft(name);
  }

  return (
    <div ref={setNodeRef} style={style} className="w-[320px] max-w-full flex flex-col gap-2">
      <div
        className="flex flex-col gap-3 p-3 rounded-theme-card border-2 border-dashed"
        style={{ background: ZINC.c500, borderColor: incomplete ? 'var(--theme-warning)' : 'var(--theme-enter-mode)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {words.map((w, i) => (
            <WordChip
              key={i}
              imagePath={w.imagePath}
              label={w.label}
              removeLabel={removeLabel}
              onEdit={() => onWordEdit(i)}
              onDelete={() => onWordDelete(i)}
            />
          ))}
          <button
            type="button"
            onClick={onWordAdd}
            aria-label={addLabel}
            className="w-16 h-16 rounded-theme-sm border-2 border-dashed border-theme-enter-mode flex items-center justify-center transition-opacity hover:opacity-80 shrink-0"
          >
            <Plus className="w-6 h-6" style={{ color: 'var(--theme-enter-mode)' }} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
            }}
            aria-label={renameLabel}
            className="flex-1 min-w-0 text-caption font-medium rounded-full px-3 py-1 outline-none"
            style={{ background: ZINC.c700, color: '#fff', border: '2px dashed var(--theme-enter-mode)' }}
          />
          <button
            type="button"
            onClick={onAudio}
            className="flex items-center gap-1 text-caption font-medium rounded-full px-2.5 py-1 shrink-0"
            style={{ background: ZINC.c700, color: '#fff' }}
          >
            {hasAudio ? <Volume2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {hasAudio ? audioReadyLabel : audioGenerateLabel}
          </button>
        </div>

        {incomplete && (
          <span className="text-caption" style={{ color: 'var(--theme-warning)' }}>{incompleteLabel}</span>
        )}
      </div>

      {/* Below-card controls: delete + drag-reorder. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="w-8 h-8 rounded-theme-sm flex items-center justify-center border border-theme-line"
          style={{ color: 'var(--theme-warning)' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label={moveLabel}
          className="w-8 h-8 rounded-theme-sm flex items-center justify-center border border-theme-line cursor-grab active:cursor-grabbing touch-none"
          style={{ color: 'var(--theme-nav-text)' }}
          {...listeners}
          {...attributes}
        >
          <Move className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Phrase card (zinc box, Tab 2 normal mode) ──────────────────────────────────

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
                <img src={`/api/assets?key=${w.imagePath}`} alt={w.label} className="w-full h-full object-contain p-1.5" draggable={false} />
              ) : (
                <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{w.label}</span>
              )}
            </div>
          ))
        )}
      </div>
      <span className="text-caption font-medium rounded-full px-3 py-0.5" style={{ background: ZINC.c700, color: '#fff' }}>
        {name}
      </span>
    </button>
  );
}
