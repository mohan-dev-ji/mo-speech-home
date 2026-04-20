"use client";

import { useState, useEffect, useRef } from 'react';
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
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ListOrdered, CheckSquare, Pencil, LogOut, Plus, Trash2, Move, ChevronDown } from 'lucide-react';
import { PageBanner } from '@/app/components/shared/PageBanner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
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

type DisplayFormat = 'rows' | 'columns' | 'grid';

type ListItem = {
  localId: string;
  imagePath?: string;
  order: number;
  description?: string;
};

// ─── Format dropdown ──────────────────────────────────────────────────────────

function FormatDropdown({ value, onChange }: { value: DisplayFormat; onChange: (f: DisplayFormat) => void }) {
  const t = useTranslations('lists');
  const [open, setOpen] = useState(false);
  const options: { id: DisplayFormat; label: string }[] = [
    { id: 'rows',    label: t('formatRows') },
    { id: 'columns', label: t('formatColumns') },
    { id: 'grid',    label: t('formatGrid') },
  ];
  const current = options.find((o) => o.id === value)?.label ?? value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)', border: '1px solid rgba(255,255,255,0.15)', minWidth: '100px' }}
      >
        <span className="flex-1 text-left">{current}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-xl shadow-xl z-50 overflow-hidden"
          style={{ background: 'var(--theme-card)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '120px' }}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-theme-s transition-colors hover:bg-white/5"
              style={{
                color: opt.id === value ? 'var(--theme-brand-primary, var(--theme-primary))' : 'var(--theme-text-primary)',
                fontWeight: opt.id === value ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Symbol thumbnail ─────────────────────────────────────────────────────────

function SymbolThumb({ imagePath, size = 'md' }: { imagePath?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-14 h-14' : size === 'lg' ? 'w-24 h-24' : 'w-16 h-16';
  return (
    <div
      className={`${dim} rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0`}
      style={{ background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))' }}
    >
      {imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/assets?key=${imagePath}`} alt="" className="w-full h-full object-contain p-1" draggable={false} />
      ) : (
        <div className="w-10 h-10 rounded bg-black/10" />
      )}
    </div>
  );
}

// ─── Edit symbol slot ─────────────────────────────────────────────────────────

function EditSymbolSlot({ imagePath, onAdd, onDelete }: { imagePath?: string; onAdd: () => void; onDelete: () => void }) {
  return (
    <div
      className="relative w-20 h-20 rounded-theme-sm overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
      style={{ background: 'var(--theme-symbol-card-bg, rgba(255,255,255,0.12))', outline: '2px dashed var(--theme-enter-mode)', outlineOffset: '2px' }}
      onClick={onAdd}
    >
      {imagePath ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/assets?key=${imagePath}`} alt="" className="w-full h-full object-contain p-1" draggable={false} />
          <div className="absolute bottom-0 inset-x-0 flex justify-center gap-2 py-0.5" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onDelete} className="text-white/80 hover:text-white"><Trash2 className="w-3 h-3" /></button>
            <button type="button" onClick={onAdd} className="text-white/80 hover:text-white"><Pencil className="w-3 h-3" /></button>
          </div>
        </>
      ) : (
        <Plus className="w-6 h-6" style={{ color: 'var(--theme-text-secondary, rgba(255,255,255,0.4))' }} />
      )}
    </div>
  );
}

// ─── Sortable edit row ────────────────────────────────────────────────────────

type SortableEditRowProps = {
  item: ListItem;
  index: number;
  showNumbers: boolean;
  showChecklist: boolean;
  onDeleteRequest: () => void;
  onDescriptionChange: (v: string) => void;
  onDescriptionBlur: () => void;
  onAddSymbol: () => void;
  onRemoveSymbol: () => void;
};

function SortableEditRow({ item, index, showNumbers, showChecklist, onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol }: SortableEditRowProps) {
  const t = useTranslations('lists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId });

  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative' };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-3 rounded-theme px-4 py-3" style={{ background: 'var(--theme-card)', outline: '2px dashed var(--theme-enter-mode)', outlineOffset: '2px' }}>
        {showNumbers && (
          <div className="w-8 h-8 rounded-theme-sm flex items-center justify-center shrink-0 text-theme-s font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--theme-text-primary)' }}>
            {index + 1}
          </div>
        )}
        <EditSymbolSlot imagePath={item.imagePath} onAdd={onAddSymbol} onDelete={onRemoveSymbol} />
        <input
          type="text"
          value={item.description ?? ''}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onBlur={onDescriptionBlur}
          placeholder={t('itemDescriptionPlaceholder')}
          className="flex-1 px-3 py-2 rounded-theme-sm text-theme-s outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--theme-text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
        {showChecklist && <div className="w-5 h-5 rounded shrink-0" style={{ border: '2px solid rgba(255,255,255,0.3)' }} />}
        <button type="button" onClick={onDeleteRequest} className="p-1.5 rounded shrink-0 hover:bg-red-100/10" style={{ color: 'var(--theme-warning)' }} aria-label={t('itemDelete')}>
          <Trash2 className="w-4 h-4" />
        </button>
        <button type="button" className="p-1.5 rounded shrink-0 cursor-grab active:cursor-grabbing touch-none" style={{ color: 'var(--theme-alt-text)' }} aria-label={t('itemMove')} {...listeners} {...attributes}>
          <Move className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Display item variants ────────────────────────────────────────────────────

type DisplayItemProps = { item: ListItem; index: number; showNumbers: boolean; showChecklist: boolean; showFirstThen: boolean; checked: boolean; onToggle: () => void };

function CheckboxBtn({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-6 h-6 rounded shrink-0 flex items-center justify-center transition-colors"
      style={{ background: checked ? '#fff' : 'transparent', border: `2px solid ${checked ? '#fff' : 'rgba(255,255,255,0.4)'}` }}
    >
      {checked && <span style={{ color: 'var(--theme-success, #22c55e)', fontSize: 12, fontWeight: 700 }}>✓</span>}
    </button>
  );
}

function DisplayItemRow({ item, index, showNumbers, showChecklist, showFirstThen, checked, onToggle }: DisplayItemProps) {
  const t = useTranslations('lists');
  return (
    <div className="flex items-center gap-4 rounded-theme p-4 transition-colors" style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}>
      {showFirstThen && (
        <span
          className="text-theme-l font-bold shrink-0 w-14 text-center py-1 rounded-theme-sm"
          style={{ background: index === 0 ? 'var(--theme-brand-primary)' : 'rgba(255,255,255,0.12)', color: index === 0 ? 'var(--theme-alt-text)' : 'var(--theme-text-primary)' }}
        >
          {index === 0 ? t('firstLabel') : t('thenLabel')}
        </span>
      )}
      {showNumbers && <span className="text-theme-h3 font-bold shrink-0 w-8 text-center" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{index + 1}</span>}
      <SymbolThumb imagePath={item.imagePath} size="lg" />
      {item.description && <p className="flex-1 text-theme-p" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{item.description}</p>}
      {showChecklist && <CheckboxBtn checked={checked} onToggle={onToggle} />}
    </div>
  );
}

function DisplayItemColumn({ item, index, showNumbers, showChecklist, showFirstThen, checked, onToggle }: DisplayItemProps) {
  const t = useTranslations('lists');
  return (
    <div className="flex flex-col rounded-theme overflow-hidden transition-colors h-full" style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}>
      {showFirstThen && (
        <div
          className="w-full text-center py-2 text-theme-h4 font-bold"
          style={{ background: index === 0 ? 'var(--theme-brand-primary)' : 'rgba(255,255,255,0.12)', color: index === 0 ? 'var(--theme-alt-text)' : 'var(--theme-text-primary)' }}
        >
          {index === 0 ? t('firstLabel') : t('thenLabel')}
        </div>
      )}
      <div className="flex flex-col items-center justify-center gap-theme-mobile-gap p-theme-mobile-general flex-1">
        {showNumbers && <span className="text-theme-h2 font-bold" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{index + 1}</span>}
        <SymbolThumb imagePath={item.imagePath} size="lg" />
        {item.description && <p className="text-theme-s text-center" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{item.description}</p>}
        {showChecklist && <CheckboxBtn checked={checked} onToggle={onToggle} />}
      </div>
    </div>
  );
}

function DisplayItemGrid({ item, index, showNumbers, showChecklist, showFirstThen, checked, onToggle }: DisplayItemProps) {
  const t = useTranslations('lists');
  return (
    <div className="flex flex-col gap-2 rounded-theme p-4 transition-colors" style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}>
      {showFirstThen && (
        <div
          className="w-full text-center py-1.5 rounded-theme-sm text-theme-l font-bold"
          style={{ background: index === 0 ? 'var(--theme-brand-primary)' : 'rgba(255,255,255,0.12)', color: index === 0 ? 'var(--theme-alt-text)' : 'var(--theme-text-primary)' }}
        >
          {index === 0 ? t('firstLabel') : t('thenLabel')}
        </div>
      )}
      <div className="flex items-center gap-3">
        {showNumbers && <span className="text-theme-h3 font-bold shrink-0" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{index + 1}</span>}
        <SymbolThumb imagePath={item.imagePath} size="md" />
        {item.description && <p className="flex-1 text-theme-s" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{item.description}</p>}
        {showChecklist && <CheckboxBtn checked={checked} onToggle={onToggle} />}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = { listId: Id<'profileLists'>; onBack: () => void };

// ─── Component ────────────────────────────────────────────────────────────────

export function ListDetailContent({ listId, onBack }: Props) {
  const t = useTranslations('lists');
  const { language, activeProfileId, stateFlags } = useProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [localItems, setLocalItems] = useState<ListItem[]>([]);
  const localItemsRef = useRef<ListItem[]>([]);
  const [symbolPickerForIndex, setSymbolPickerForIndex] = useState<number | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const list = useQuery(api.profileLists.getProfileListWithItems, { profileListId: listId });
  const updateItems = useMutation(api.profileLists.updateProfileListItems);
  const updateDisplay = useMutation(api.profileLists.updateProfileListDisplay);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  async function persistItems(items: ListItem[]) {
    await updateItems({
      profileListId: listId,
      items: items.map((item, i) => ({
        imagePath: item.imagePath,
        order: i,
        description: item.description,
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

  async function handleListImageSaved(imagePath: string) {
    if (symbolPickerForIndex === null) return;
    const idx = symbolPickerForIndex;
    const prev = localItemsRef.current;
    const next =
      idx < prev.length
        ? prev.map((item, i) => (i === idx ? { ...item, imagePath } : item))
        : [...prev, { localId: `item-${prev.length}-${Date.now()}`, imagePath, order: prev.length }];
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

  function toggleChecked(localId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
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

  function handleFormatChange(fmt: DisplayFormat) {
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

  return (
    <div className="p-theme-mobile-general md:p-theme-general flex flex-col gap-theme-mobile-gap md:gap-theme-gap">

      {/* Header */}
      <div className="shrink-0">
        {stateFlags.talker_visible ? (
          <PageBanner title={listName}>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('back')}
            </button>
            <button
              type="button"
              onClick={toggleNumbers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{
                background: list.showNumbers ? 'var(--theme-button-highlight)' : 'var(--theme-card)',
                color: list.showNumbers ? 'var(--theme-text)' : 'var(--theme-text-primary)',
              }}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              {t('numberedList')}
            </button>
            <button
              type="button"
              onClick={toggleChecklist}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{
                background: list.showChecklist ? 'var(--theme-button-highlight)' : 'var(--theme-card)',
                color: list.showChecklist ? 'var(--theme-text)' : 'var(--theme-text-primary)',
              }}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {t('checklist')}
            </button>
            <button
              type="button"
              onClick={toggleFirstThen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{
                background: showFirstThen ? 'var(--theme-button-highlight)' : 'var(--theme-card)',
                color: showFirstThen ? 'var(--theme-text)' : 'var(--theme-text-primary)',
              }}
            >
              {t('firstThen')}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('exitEdit')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                {t('editList')}
              </button>
            )}
            <FormatDropdown value={list.displayFormat} onChange={handleFormatChange} />
          </PageBanner>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-theme-s font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('back')}
          </button>
        )}
      </div>

      {localItems.length === 0 && !isEditing && (
        <div className="flex items-center justify-center py-16">
          <p className="text-theme-p opacity-50" style={{ color: 'var(--theme-text)' }}>{t('itemEmpty')}</p>
        </div>
      )}

      {/* ── Edit mode ─────────────────────────────────────────────────────────── */}
      {isEditing && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localItems.map((i) => i.localId)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {localItems.map((item, idx) => (
                <SortableEditRow
                  key={item.localId}
                  item={item}
                  index={idx}
                  showNumbers={list.showNumbers}
                  showChecklist={list.showChecklist}
                  onDeleteRequest={() => setPendingDeleteIndex(idx)}
                  onDescriptionChange={(v) => handleDescriptionChange(idx, v)}
                  onDescriptionBlur={handleDescriptionBlur}
                  onAddSymbol={() => setSymbolPickerForIndex(idx)}
                  onRemoveSymbol={() => {
                    const next = localItems.map((item, i) =>
                      i === idx ? { ...item, imagePath: undefined } : item
                    );
                    setLocalItems(next);
                    persistItems(next);
                  }}
                />
              ))}

              <button
                type="button"
                onClick={() => setSymbolPickerForIndex(localItems.length)}
                className="flex items-center gap-2 px-4 py-3 rounded-theme transition-colors"
                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--theme-brand-primary, var(--theme-primary))', border: '1.5px dashed var(--theme-brand-primary, var(--theme-primary))' }}
              >
                <Plus className="w-4 h-4" />
                <span className="text-theme-s font-medium">{t('addItem')}</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Display: Rows ─────────────────────────────────────────────────────── */}
      {!isEditing && list.displayFormat === 'rows' && localItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {localItems.map((item, idx) => (
            <DisplayItemRow key={item.localId} item={item} index={idx} showNumbers={list.showNumbers} showChecklist={list.showChecklist} showFirstThen={showFirstThen} checked={checkedIds.has(item.localId)} onToggle={() => toggleChecked(item.localId)} />
          ))}
        </div>
      )}

      {/* ── Display: Columns ──────────────────────────────────────────────────── */}
      {!isEditing && list.displayFormat === 'columns' && localItems.length > 0 && (
        <div className="overflow-x-auto -mx-theme-mobile-general px-theme-mobile-general md:-mx-theme-general md:px-theme-general">
          <div className="grid gap-theme-mobile-gap md:gap-theme-gap" style={{ gridTemplateColumns: `repeat(${Math.max(localItems.length, 2)}, minmax(0, 1fr))`, minWidth: `${Math.max(localItems.length, 2) * 140}px` }}>
            {localItems.map((item, idx) => (
              <DisplayItemColumn key={item.localId} item={item} index={idx} showNumbers={list.showNumbers} showChecklist={list.showChecklist} showFirstThen={showFirstThen} checked={checkedIds.has(item.localId)} onToggle={() => toggleChecked(item.localId)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Display: Grid ─────────────────────────────────────────────────────── */}
      {!isEditing && list.displayFormat === 'grid' && localItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {localItems.map((item, idx) => (
            <DisplayItemGrid key={item.localId} item={item} index={idx} showNumbers={list.showNumbers} showChecklist={list.showChecklist} showFirstThen={showFirstThen} checked={checkedIds.has(item.localId)} onToggle={() => toggleChecked(item.localId)} />
          ))}
        </div>
      )}

      {/* Image picker for list items — folder image mode: returns imagePath directly, no category needed */}
      {symbolPickerForIndex !== null && activeProfileId && (
        <SymbolEditorModal
          isOpen={true}
          profileId={activeProfileId as Id<'studentProfiles'>}
          language={language}
          folderImageMode={true}
          modalTitle={t('imagePickerTitle')}
          onClose={() => setSymbolPickerForIndex(null)}
          onSave={() => {}}
          onFolderImageSave={handleListImageSaved}
        />
      )}

      {/* Delete item confirmation */}
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
    </div>
  );
}
