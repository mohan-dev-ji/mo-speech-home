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

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Pencil, Plus, X } from 'lucide-react';
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
import { Button } from '@/app/components/app/shared/ui/Button';
import { PhraseBuilderBody } from '@/app/components/app/shared/ui/composition/PhraseBuilderBody';
import { BlockEditControls } from '@/app/components/app/shared/ui/composition/BlockEditControls';
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
import { displayString, resolvedLocale } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { collapseVariants, reconcileVariantOrder, needsTranslation, isRevertableVariant } from '@/lib/languages/variants';
import { makeRecordFiller } from '@/lib/languages/translateClient';
import { VariantAuthorModal } from '@/app/components/app/shared/modals/VariantAuthorModal';
import { TranslateRevertControl, type TranslateRevertState } from '@/app/components/app/shared/ui/TranslateRevertControl';
import { MadeInLabel } from '@/app/components/app/shared/ui/MadeInLabel';
import { UseOriginalConfirmDialog } from '@/app/components/app/shared/ui/UseOriginalConfirmDialog';
import { useProfile } from '@/app/contexts/ProfileContext';
import { getCategoryColour } from '@/app/lib/categoryColours';

const ZINC = getCategoryColour('zinc');

// Column count follows the profile's grid-size setting (matches the main
// symbol board's lg tier). Fewer columns → larger cells + text. Changing size
// reflows the slots across rows but each keeps its numbered position (order).
// MIN_ROWS keeps the board a recognisable shape even when nearly empty.
const CORE_GRID_COLS = { large: 4, medium: 8, small: 12 } as const;
const MIN_ROWS = 3;

// Authoring toggle. false = "nudge" mode: symbols pack contiguously and moving
// one shifts the rest across (dense arrayMove) — easier while curating. Flip to
// true once the SLP-confirmed set lands to get true stable slots (a symbol
// holds its numbered cell, deletes leave gaps, moves swap).
const STABLE_SLOTS = false;

type TabId = 'core' | 'phrases';

type TalkerDropdownProps = {
  language: string;
  onSymbolTap: (item: QuickSymbolItem) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TalkerDropdown({ language, onSymbolTap }: TalkerDropdownProps) {
  const t = useTranslations('talker');
  const tTranslate = useTranslations('translate');
  const { voiceId, accountId, stateFlags, viewMode } = useProfile();
  const cols = CORE_GRID_COLS[stateFlags.grid_size ?? 'large'];
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
  // ADR-016 Stage 3 — edit-mode ↩: removes only this board's variant row.
  const [pendingPhraseRevert, setPendingPhraseRevert] = useState<
    { id: Id<'profilePhrases'>; name: string } | null
  >(null);
  // ADR-016 — the source phrase whose "Made in <lang>" badge was tapped, driving
  // the variant author modal (author a native version in the board language).
  const [phraseVariantTarget, setPhraseVariantTarget] = useState<
    { id: Id<'profilePhrases'>; authoredLang: string } | null
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
  const reorderProfileSymbols    = useMutation(api.profileSymbols.reorderProfileSymbols);
  const updateProfilePhraseName  = useMutation(api.profilePhrases.updateProfilePhraseName);
  const updateProfilePhraseWords = useMutation(api.profilePhrases.updateProfilePhraseWords);
  const updateProfilePhraseAudio = useMutation(api.profilePhrases.updateProfilePhraseAudio);
  const reorderProfilePhrases    = useMutation(api.profilePhrases.reorderProfilePhrases);
  const createProfilePhrase      = useMutation(api.profilePhrases.createProfilePhrase);
  const createPhraseVariant      = useMutation(api.profilePhrases.createPhraseVariant);

  // The fixed panel is anchored just under the toggle bar. Snapshotting the bar
  // rect once at open goes stale the moment the talker chip area reflows to more
  // rows (inserting from the open panel pushes the bar DOWN), so the panel ends
  // up covering the bar — and you can't reach the close control. Keep it synced.
  function syncPanelPos() {
    const r = barRef.current?.getBoundingClientRect();
    if (!r) return;
    setPanelPos((prev) =>
      prev.top === r.bottom && prev.left === r.left && prev.width === r.width
        ? prev // no change — avoid re-render churn (scroll/resize fire often)
        : { top: r.bottom, left: r.left, width: r.width }
    );
  }

  function openPanel() {
    syncPanelPos();
    setIsOpen(true);
  }

  // While open, re-sync the panel anchor whenever the talker shell resizes (chip
  // area grows/shrinks as symbols wrap) or the viewport changes. Without this the
  // multi-row talker slides under the stale panel and traps it open.
  useEffect(() => {
    if (!isOpen) return;
    const shell = barRef.current?.closest('[data-talker-shell]') ?? null;
    const ro = new ResizeObserver(() => syncPanelPos());
    if (shell) ro.observe(shell);
    window.addEventListener('resize', syncPanelPos);
    window.addEventListener('scroll', syncPanelPos, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncPanelPos);
      window.removeEventListener('scroll', syncPanelPos, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  // Warn-but-allow: how many OTHER items still reference this symbol's
  // personal image/audio keys. Non-blocking — shown as an extra line in the
  // delete confirm below when > 0.
  const pendingSymDeleteUsageCount = useQuery(
    api.profileSymbols.getProfileSymbolUsageCount,
    pendingSymDelete ? { profileSymbolId: pendingSymDelete.id } : 'skip'
  );

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

  // ── Tab 1 (Core words) grid ─────────────────────────────────────────────────
  // Stable mode renders by fixed slot (order = cell index, gaps allowed); nudge
  // mode renders the symbols packed contiguously in sorted order.
  const slotMap = new Map((coreSymbols ?? []).map((s) => [s.order, s]));
  const sortedSyms = [...(coreSymbols ?? [])].sort((a, b) => a.order - b.order);
  const occupiedMax = (coreSymbols ?? []).reduce((m, s) => Math.max(m, s.order), -1);
  const filledCells = STABLE_SLOTS ? occupiedMax + 1 : sortedSyms.length;
  const contentRows = Math.ceil(filledCells / cols);
  const rows = Math.max(MIN_ROWS, contentRows) + (editing ? addedRows : 0);
  const totalCells = rows * cols;

  function handleTapSymbol(sym: NonNullable<typeof coreSymbols>[number]) {
    const label = displayString(sym.label, language, DEFAULT_LOCALE);
    const imagePath = sym.imagePath ? `/api/assets?key=${sym.imagePath}` : undefined;
    const audioPath = sym.audio[language] ?? sym.audio[DEFAULT_LOCALE] ?? sym.audio.en;
    // Phase 15 (Task 6): carry the full localised record, not just the resolved string.
    onSymbolTap({ symbolId: sym._id, label, labelRecord: sym.label, imagePath, audioPath });
  }

  function handleSymbolDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('slot-')) return;
    const targetCell = Number(overId.slice('slot-'.length));

    if (STABLE_SLOTS) {
      // Stable: the dragged symbol takes the target cell (swap on collision).
      moveProfileSymbolToSlot({ profileSymbolId: active.id as Id<'profileSymbols'>, slot: targetCell }).catch((e) =>
        console.error('[TalkerDropdown] move symbol to slot failed', e)
      );
      return;
    }

    // Nudge: insert at the target position and shift the rest across (dense
    // arrayMove, renumbered). Dropping onto a trailing empty cell moves to end.
    if (!coreCategoryId) return;
    const ids = sortedSyms.map((s) => s._id as string);
    const from = ids.indexOf(String(active.id));
    if (from === -1) return;
    const to = Math.min(targetCell, ids.length - 1);
    if (from === to) return;
    const next = arrayMove(ids, from, to);
    reorderProfileSymbols({ profileCategoryId: coreCategoryId, orderedIds: next as Id<'profileSymbols'>[] }).catch((e) =>
      console.error('[TalkerDropdown] reorder symbols failed', e)
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
  // ADR-016 — collapse sibling variants to one card per group: the board-language
  // variant if authored, else the source (which then shows a "Made in <lang>"
  // badge). A phrase resolves its name + words against ITS authoredLanguage
  // (structure-bound), not the board language.
  const phraseList = phrases ? collapseVariants(phrases, language) : [];
  const phraseLangOf = (p: { authoredLanguage?: string }) => p.authoredLanguage ?? DEFAULT_LOCALE;

  useEffect(() => {
    if (phrases === undefined) return;
    // Hold each group's card position when its representative swaps on variant
    // authoring; append only new groups (shared; see variants.ts).
    setPhraseOrder((prev) => reconcileVariantOrder(prev, phrases, phraseList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases]);

  const phraseMap = new Map(phraseList.map((p) => [p._id as string, p]));
  const orderedPhrases = phraseOrder.map((id) => phraseMap.get(id)).filter(Boolean) as typeof phraseList;

  // Phrase audio-ready mirrors the sentence InlinePhraseEditor: a phrase reads as
  // "audio ready" when it has a human recording OR a TTS clip for its current
  // name+voice is already cached. Phrase TTS lives in the global cache, not on the
  // row, so a stored-path check alone leaves the indicator stuck on "add audio".
  // One batched cache lookup covers every phrase name in the bank.
  const phraseNameKeys = orderedPhrases.map((p) =>
    displayString(p.name, phraseLangOf(p), DEFAULT_LOCALE).toLowerCase().trim(),
  );
  const phraseAudioAvailList = useQuery(
    api.ttsCache.checkMany,
    isOpen && phraseNameKeys.length > 0
      ? { texts: phraseNameKeys, voiceId }
      : 'skip',
  );
  // checkMany returns an array (Convex forbids non-ASCII object keys like Hindi
  // text). Rebuild the by-text lookup client-side.
  const phraseAudioAvail = useMemo(
    () => Object.fromEntries((phraseAudioAvailList ?? []).map((e) => [e.text, e])),
    [phraseAudioAvailList],
  );

  function findPhrase(id: Id<'profilePhrases'>) {
    return phraseList.find((p) => p._id === id);
  }

  // Fork-on-edit (Stage 2): editing a phrase whose collapsed row isn't a board-language
  // variant creates/reuses the board variant (idempotent) and returns its id, so a direct
  // edit of a fallback never mutates the source across boards.
  async function resolvePhraseTargetId(phrase: { _id: Id<'profilePhrases'>; authoredLanguage?: string }) {
    return (phrase.authoredLanguage ?? DEFAULT_LOCALE) !== language
      ? await createPhraseVariant({ sourcePhraseId: phrase._id, authoredLanguage: language })
      : phrase._id;
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

  async function handleRenamePhrase(id: Id<'profilePhrases'>, current: Record<string, string>, next: string) {
    const phrase = findPhrase(id);
    if (!phrase) return;
    const targetId = await resolvePhraseTargetId(phrase);
    updateProfilePhraseName({ profilePhraseId: targetId, name: { ...current, [language]: next } }).catch((e) =>
      console.error('[TalkerDropdown] rename phrase failed', e)
    );
  }

  async function handleRemovePhraseWord(phraseId: Id<'profilePhrases'>, wordIndex: number) {
    const phrase = findPhrase(phraseId);
    if (!phrase) return;
    const targetId = await resolvePhraseTargetId(phrase);
    const words = normaliseWords(phrase.words.filter((_, i) => i !== wordIndex));
    updateProfilePhraseWords({ profilePhraseId: targetId, words }).catch((e) =>
      console.error('[TalkerDropdown] remove phrase word failed', e)
    );
  }

  async function handleReorderPhraseWord(phraseId: Id<'profilePhrases'>, from: number, to: number) {
    const phrase = findPhrase(phraseId);
    if (!phrase) return;
    const targetId = await resolvePhraseTargetId(phrase);
    const words = normaliseWords(arrayMove(phrase.words, from, to));
    updateProfilePhraseWords({ profilePhraseId: targetId, words }).catch((e) =>
      console.error('[TalkerDropdown] reorder phrase word failed', e)
    );
  }

  async function handlePhraseWordSave(result: SentenceSlotSaveResult) {
    if (!phraseWordEditor.open) return;
    const { phraseId, wordIndex } = phraseWordEditor;
    const phrase = findPhrase(phraseId);
    if (!phrase) { setPhraseWordEditor({ open: false }); return; }
    const targetId = await resolvePhraseTargetId(phrase);
    const current = normaliseWords(phrase.words);
    if (wordIndex === -1) {
      current.push({ order: current.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
    } else if (current[wordIndex]) {
      current[wordIndex] = { ...current[wordIndex], imagePath: result.imagePath, displayProps: result.displayProps };
    }
    const reindexed = current.map((w, i) => ({ ...w, order: i }));
    updateProfilePhraseWords({ profilePhraseId: targetId, words: reindexed }).catch((e) =>
      console.error('[TalkerDropdown] save phrase word failed', e)
    );
    setPhraseWordEditor({ open: false });
  }

  async function handlePhraseDeleteConfirm() {
    if (!pendingPhraseDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-composed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'phrase', id: pendingPhraseDelete.id, scope: 'group' }),
      });
      if (!res.ok) throw new Error('delete failed');
    } catch (e) {
      console.error('[TalkerDropdown] delete phrase failed', e);
    } finally {
      setIsDeleting(false);
      setPendingPhraseDelete(null);
    }
  }

  // ADR-016 Stage 3 — Revert: remove only this board's variant row, so the
  // board falls back to showing the surviving origin (+ "Made in" badge).
  async function handlePhraseRevertConfirm() {
    if (!pendingPhraseRevert) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-composed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'phrase', id: pendingPhraseRevert.id, scope: 'variant' }),
      });
      if (!res.ok) throw new Error('revert failed');
    } catch (e) {
      console.error('[TalkerDropdown] revert phrase failed', e);
    } finally {
      setIsDeleting(false);
      setPendingPhraseRevert(null);
    }
  }

  async function handleCreatePhrase(name: string) {
    const folderId = board?.phrasesFolderId;
    if (!folderId) return;
    await createProfilePhrase({ name: { [language]: name }, authoredLanguage: language, folderId });
  }

  // ADR-016 — author a board-language variant of the badge-tapped phrase, then
  // enter phrase edit mode to re-order / re-word. Translate MT-fills the name +
  // each word label lacking the target language (fill-the-gaps); manual copies.
  // Translation runs before any write, so a failed MT leaves no orphan variant.
  async function handlePhraseAuthorVariant(mode: 'manual' | 'translate') {
    const target = phraseVariantTarget;
    if (!target) return;
    const source = phraseList.find((p) => p._id === target.id);
    if (!source) return;

    if (mode === 'translate') {
      const built = await buildTranslatedPhrase(source, target.authoredLang, language);
      const variantId = await createPhraseVariant({ sourcePhraseId: source._id, authoredLanguage: language });
      await updateProfilePhraseName({ profilePhraseId: variantId, name: built.name });
      await updateProfilePhraseWords({ profilePhraseId: variantId, words: built.words });
    } else {
      await createPhraseVariant({ sourcePhraseId: source._id, authoredLanguage: language });
    }
    setPhraseVariantTarget(null);
    // Manual → straight into edit mode to arrange + type. Translate produced
    // complete content, so it just applies (refine later via edit if wanted).
    if (mode === 'manual') setEditing(true);
  }

  // Fill the phrase name + each word label that lacks `targetLang` from one
  // batched translation of their source-language values (existing target labels
  // from a translated symbol are kept).
  async function buildTranslatedPhrase(
    source: typeof phraseList[number],
    srcLang: string,
    targetLang: string,
  ) {
    // Batch-translate the name + word labels lacking the target language (shared
    // gap-fill; see makeRecordFiller), then apply per field.
    const fill = await makeRecordFiller(
      [source.name, ...source.words.map((w) => w.label)],
      srcLang,
      targetLang,
    );
    const name = fill(source.name) ?? source.name;
    const words = source.words.map((w) => ({ ...w, label: fill(w.label) }));
    return { name, words };
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
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: totalCells }, (_, slot) => {
            const sym = STABLE_SLOTS ? slotMap.get(slot) : sortedSyms[slot];
            // Nudge mode packs contiguously, so a new symbol appends after the
            // last one (occupiedMax + 1) rather than into this exact cell.
            const addSlot = STABLE_SLOTS ? slot : occupiedMax + 1;
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
                onAddAt={() => setSymbolEditor({ open: true, slot: addSlot })}
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
                const name = displayString(p.name, phraseLangOf(p), DEFAULT_LOCALE);
                const words = p.words.map((w) => ({
                  imagePath: w.imagePath,
                  label: displayString(w.label ?? {}, phraseLangOf(p), DEFAULT_LOCALE),
                }));
                const hasAudio =
                  !!p.recordedAudioPath ||
                  phraseAudioAvail?.[name.toLowerCase().trim()]?.available === true;
                const incomplete = p.words.length < 1;
                // Stage D (Figma 3025-2324) — one control, two meanings. Phrases are
                // COMPOSED content (ADR-016): "translate" opens variant AUTHORING,
                // never machine translation. Precedence (owner decision 2026-07-21):
                // untranslated FIRST — a variant row can exist while its name is
                // still the source language (half-finished), and that state must
                // keep the route back into authoring.
                const phraseState: TranslateRevertState =
                  needsTranslation(p.name, language) ? 'untranslated'
                  : isRevertableVariant(p) ? 'translated'
                  : 'none';
                return (
                  <PhraseEditCard
                    key={p._id}
                    id={p._id}
                    name={name}
                    words={words}
                    hasAudio={hasAudio}
                    incomplete={incomplete}
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
                    onWordReorder={(from, to) => handleReorderPhraseWord(p._id, from, to)}
                    onAudio={() => setPhraseAudioTarget({ id: p._id, nameRec: p.name })}
                    onDelete={() => setPendingPhraseDelete({ id: p._id, name })}
                    translateRevert={
                      <TranslateRevertControl
                        state={phraseState}
                        onTranslate={() => setPhraseVariantTarget({ id: p._id, authoredLang: phraseLangOf(p) })}
                        onRevert={() => setPendingPhraseRevert({ id: p._id, name })}
                        translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
                        revertLabel={tTranslate('controlRevertLabel')}
                      />
                    }
                    madeInLabel={
                      phraseState === 'untranslated'
                        ? <MadeInLabel lang={resolvedLocale(p.name, language, DEFAULT_LOCALE) ?? DEFAULT_LOCALE} />
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      );
    }

    // Normal mode — only ready phrases (1+ symbols) are tappable to insert — a variant may legitimately be a single word.
    const ready = phraseList.filter((p) => p.words.length >= 1);
    if (ready.length === 0) {
      return <span className="text-caption opacity-60 self-center" style={{ color: 'var(--theme-nav-text)' }}>{t('emptyBank')}</span>;
    }
    return (
      <div className="flex flex-wrap gap-3 py-2">
        {ready.map((p) => {
          const pLang = phraseLangOf(p);
          const name = displayString(p.name, pLang, DEFAULT_LOCALE);
          const audioPath = p.recordedAudioPath ?? p.audioPath ?? undefined;
          // Phase 15 (Task 6): keep each word's full localised record alongside the
          // resolved string, so the saved sentence keys text by its true language.
          const words = p.words.map((w) => ({
            imagePath: w.imagePath,
            audioPath: w.audioPath,
            label: displayString(w.label ?? {}, pLang, DEFAULT_LOCALE),
            ...(w.label ? { labelRecord: w.label } : {}),
          }));
          return (
            <PhraseDropdownCard
              key={p._id}
              name={name}
              words={words}
              onTap={() =>
                onSymbolTap({ symbolId: `phrase-${p._id}`, label: name, kind: 'phrase', phraseName: name, phraseNameRecord: p.name, audioPath, words })
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
                  <Button
                    type="button"
                    variant={editing ? 'edit-mode' : 'primary'}
                    size="sm"
                    onClick={() => setEditing((e) => !e)}
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    className="px-3 py-1.5"
                  >
                    {editing ? t('exitEditLabel') : t('editLabel')}
                  </Button>
                  {editing && activeTab === 'core' && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setSymbolEditor({ open: true, slot: occupiedMax + 1 })}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      className="px-3 py-1.5"
                    >
                      {t('createWord')}
                    </Button>
                  )}
                  {editing && activeTab === 'phrases' && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setCreatePhraseOpen(true)}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      className="px-3 py-1.5"
                    >
                      {t('createPhrase')}
                    </Button>
                  )}
                  {/* Admin view only: publish this tab's container as the shipped default. */}
                  {editing && isAdmin && viewMode === 'admin' && (
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
            {!!pendingSymDeleteUsageCount && pendingSymDeleteUsageCount > 0 && (
              <p className="text-theme-s text-theme-secondary-text mt-1">
                {t('symbolDeleteInUse', { count: pendingSymDeleteUsageCount })}
              </p>
            )}
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
            const phrase = findPhrase(target.id);
            if (!phrase) return;
            // Fork-on-edit: a direct audio/name edit of a fallback forks the board variant.
            const targetId = await resolvePhraseTargetId(phrase);
            if (text) {
              await updateProfilePhraseName({ profilePhraseId: targetId, name: { ...target.nameRec, [language]: text } });
            }
            if (recordedAudioPath !== undefined) {
              await updateProfilePhraseAudio({ profilePhraseId: targetId, recordedAudioPath });
            }
          }}
        />
      )}

      {/* Phrase delete confirmation. */}
      <Dialog open={pendingPhraseDelete !== null} onOpenChange={(o) => { if (!o) setPendingPhraseDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('phraseDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('phraseDeleteConfirmAllLanguages', { name: pendingPhraseDelete?.name ?? '' })}</DialogDescription>
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

      {/* Phrase revert confirmation — shared "Use original" confirm (Stage D):
          reverting only removes this board's variant row, the origin stays intact. */}
      <UseOriginalConfirmDialog
        open={pendingPhraseRevert !== null}
        onOpenChange={(o) => { if (!o) setPendingPhraseRevert(null); }}
        name={pendingPhraseRevert?.name ?? ''}
        onConfirm={handlePhraseRevertConfirm}
        isPending={isDeleting}
      />

      {/* ADR-016 — phrase variant authoring (badge → manual | translate-assist). */}
      {phraseVariantTarget && (
        <VariantAuthorModal
          isOpen
          onClose={() => setPhraseVariantTarget(null)}
          targetLang={language}
          authoredLang={phraseVariantTarget.authoredLang}
          onAuthor={handlePhraseAuthorVariant}
        />
      )}
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
      style={{
        // Dashed edit-mode border signals the symbol is authorable (delete via
        // the X badge, tap to open the editor) — no edit panel, so the symbol
        // keeps its full surface.
        border: editing ? '2px dashed var(--theme-enter-mode)' : undefined,
        outline: isOver && editing ? '2px solid var(--theme-brand-primary)' : undefined,
        borderRadius: 'var(--theme-card-roundness)',
      }}
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

function PhraseEditCard({
  id,
  name,
  words,
  hasAudio,
  incomplete,
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
  onWordReorder,
  onAudio,
  onDelete,
  translateRevert,
  madeInLabel,
}: {
  id: string;
  name: string;
  words: { imagePath?: string; label: string }[];
  hasAudio: boolean;
  incomplete: boolean;
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
  onWordReorder: (from: number, to: number) => void;
  onAudio: () => void;
  onDelete: () => void;
  // Stage D (Figma 3025-2324) — the shared TranslateRevertControl, rendered
  // inside BlockEditControls' slot (replaces the old bespoke ↩ button).
  translateRevert?: React.ReactNode;
  // "Made in <lang>" — rendered below the card, right-aligned, only while
  // `translateRevert`'s state is `untranslated` (a fallback origin to name).
  madeInLabel?: React.ReactNode;
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
    <div ref={setNodeRef} style={style} className="w-fit min-w-0 sm:min-w-[320px] max-w-full">
      <PhraseBuilderBody
        name={name}
        words={words}
        hasAudio={hasAudio}
        incomplete={incomplete}
        audioReadyLabel={audioReadyLabel}
        audioGenerateLabel={audioGenerateLabel}
        renameLabel={renameLabel}
        addLabel={addLabel}
        removeLabel={removeLabel}
        onRename={onRename}
        onWordAdd={onWordAdd}
        onWordEdit={onWordEdit}
        onWordDelete={onWordDelete}
        onWordReorder={onWordReorder}
        onAudio={onAudio}
        controls={
          <BlockEditControls
            onDelete={onDelete}
            deleteLabel={deleteLabel}
            translateRevert={translateRevert}
            moveLabel={moveLabel}
            dragProps={{ ...listeners, ...attributes }}
          />
        }
      />
      {madeInLabel && (
        <div className="flex justify-end mt-theme-gap">
          {madeInLabel}
        </div>
      )}
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
      className="relative flex flex-col items-center gap-2 rounded-theme p-3 transition-opacity hover:opacity-90 shrink-0"
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
