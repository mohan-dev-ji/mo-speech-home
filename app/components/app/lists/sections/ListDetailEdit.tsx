"use client";

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
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, Move } from 'lucide-react';
import { EditSymbolSlot } from '../ui/ListItemAtoms';
import type { ListItem } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditItemProps = {
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

export type EditContainerProps = {
  items: ListItem[];
  showNumbers: boolean;
  showChecklist: boolean;
  onDragEnd: (event: DragEndEvent) => void;
  onDeleteRequest: (index: number) => void;
  onDescriptionChange: (index: number, value: string) => void;
  onDescriptionBlur: () => void;
  onAddSymbol: (index: number) => void;
  onRemoveSymbol: (index: number) => void;
  onAddItem: () => void;
};

const SENSOR_OPTIONS = { activationConstraint: { distance: 8 } };

// ─── Row edit item ────────────────────────────────────────────────────────────

function SortableEditRow({
  item, index, showNumbers, showChecklist,
  onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol,
}: EditItemProps) {
  const t = useTranslations('lists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative' };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-3 rounded-theme px-4 py-3"
        style={{ background: 'var(--theme-card)', outline: '2px dashed var(--theme-enter-mode)', outlineOffset: '2px' }}
      >
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

// ─── Column edit item ─────────────────────────────────────────────────────────

function SortableEditColumn({
  item, index, showNumbers, showChecklist,
  onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol,
}: EditItemProps) {
  const t = useTranslations('lists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative' };

  return (
    <div ref={setNodeRef} style={style} className="flex-1 min-w-0 flex flex-col">
      <div
        className="flex flex-1 flex-col items-center gap-3 rounded-theme p-4"
        style={{ background: 'var(--theme-card)', outline: '2px dashed var(--theme-enter-mode)', outlineOffset: '2px' }}
      >
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
          className="w-full px-3 py-2 rounded-theme-sm text-theme-s outline-none text-center"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--theme-text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
        {showChecklist && <div className="w-5 h-5 rounded shrink-0" style={{ border: '2px solid rgba(255,255,255,0.3)' }} />}
        <div className="flex gap-1 mt-auto shrink-0">
          <button type="button" onClick={onDeleteRequest} className="p-1.5 rounded hover:bg-red-100/10" style={{ color: 'var(--theme-warning)' }} aria-label={t('itemDelete')}>
            <Trash2 className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 rounded cursor-grab active:cursor-grabbing touch-none" style={{ color: 'var(--theme-alt-text)' }} aria-label={t('itemMove')} {...listeners} {...attributes}>
            <Move className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Grid edit item ───────────────────────────────────────────────────────────

function SortableEditGrid({
  item, index, showNumbers, showChecklist,
  onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol,
}: EditItemProps) {
  const t = useTranslations('lists');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: 'relative' };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-2 rounded-theme px-3 py-3"
        style={{ background: 'var(--theme-card)', outline: '2px dashed var(--theme-enter-mode)', outlineOffset: '2px' }}
      >
        {showNumbers && (
          <div className="w-7 h-7 rounded-theme-sm flex items-center justify-center shrink-0 text-theme-s font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--theme-text-primary)' }}>
            {index + 1}
          </div>
        )}
        <EditSymbolSlot imagePath={item.imagePath} onAdd={onAddSymbol} onDelete={onRemoveSymbol} size="sm" />
        <input
          type="text"
          value={item.description ?? ''}
          onChange={(e) => onDescriptionChange(e.target.value)}
          onBlur={onDescriptionBlur}
          placeholder={t('itemDescriptionPlaceholder')}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-theme-sm text-theme-s outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--theme-text-primary)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
        {showChecklist && <div className="w-4 h-4 rounded shrink-0" style={{ border: '2px solid rgba(255,255,255,0.3)' }} />}
        <button type="button" onClick={onDeleteRequest} className="p-1 rounded shrink-0 hover:bg-red-100/10" style={{ color: 'var(--theme-warning)' }} aria-label={t('itemDelete')}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1 rounded shrink-0 cursor-grab active:cursor-grabbing touch-none" style={{ color: 'var(--theme-alt-text)' }} aria-label={t('itemMove')} {...listeners} {...attributes}>
          <Move className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Add item button ──────────────────────────────────────────────────────────

function AddItemButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const t = useTranslations('lists');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-theme transition-colors ${className}`}
      style={{
        background: 'rgba(0,0,0,0.05)',
        color: 'var(--theme-brand-primary, var(--theme-primary))',
        border: '1.5px dashed var(--theme-brand-primary, var(--theme-primary))',
      }}
    >
      <Plus className="w-4 h-4" />
      <span className="text-theme-s font-medium">{t('addItem')}</span>
    </button>
  );
}

// ─── Edit containers ──────────────────────────────────────────────────────────

export function EditRows({ items, showNumbers, showChecklist, onDragEnd, onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol, onAddItem }: EditContainerProps) {
  const sensors = useSensors(useSensor(PointerSensor, SENSOR_OPTIONS));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.localId)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <SortableEditRow
              key={item.localId}
              item={item}
              index={idx}
              showNumbers={showNumbers}
              showChecklist={showChecklist}
              onDeleteRequest={() => onDeleteRequest(idx)}
              onDescriptionChange={(v) => onDescriptionChange(idx, v)}
              onDescriptionBlur={onDescriptionBlur}
              onAddSymbol={() => onAddSymbol(idx)}
              onRemoveSymbol={() => onRemoveSymbol(idx)}
            />
          ))}
          <AddItemButton onClick={onAddItem} />
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function EditColumns({ items, showNumbers, showChecklist, onDragEnd, onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol, onAddItem }: EditContainerProps) {
  const t = useTranslations('lists');
  const sensors = useSensors(useSensor(PointerSensor, SENSOR_OPTIONS));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.localId)} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-1 min-h-0 gap-3">
          {items.map((item, idx) => (
            <SortableEditColumn
              key={item.localId}
              item={item}
              index={idx}
              showNumbers={showNumbers}
              showChecklist={showChecklist}
              onDeleteRequest={() => onDeleteRequest(idx)}
              onDescriptionChange={(v) => onDescriptionChange(idx, v)}
              onDescriptionBlur={onDescriptionBlur}
              onAddSymbol={() => onAddSymbol(idx)}
              onRemoveSymbol={() => onRemoveSymbol(idx)}
            />
          ))}
          <button
            type="button"
            onClick={onAddItem}
            className="flex-1 flex flex-col items-center justify-center gap-2 rounded-theme transition-colors h-full"
            style={{
              color: 'var(--theme-brand-primary, var(--theme-primary))',
              border: '1.5px dashed var(--theme-brand-primary, var(--theme-primary))',
              background: 'rgba(0,0,0,0.05)',
            }}
          >
            <Plus className="w-5 h-5" />
            <span className="text-theme-s font-medium">{t('addItem')}</span>
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function EditGrid({ items, showNumbers, showChecklist, onDragEnd, onDeleteRequest, onDescriptionChange, onDescriptionBlur, onAddSymbol, onRemoveSymbol, onAddItem }: EditContainerProps) {
  const sensors = useSensors(useSensor(PointerSensor, SENSOR_OPTIONS));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.localId)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3">
          {items.map((item, idx) => (
            <SortableEditGrid
              key={item.localId}
              item={item}
              index={idx}
              showNumbers={showNumbers}
              showChecklist={showChecklist}
              onDeleteRequest={() => onDeleteRequest(idx)}
              onDescriptionChange={(v) => onDescriptionChange(idx, v)}
              onDescriptionBlur={onDescriptionBlur}
              onAddSymbol={() => onAddSymbol(idx)}
              onRemoveSymbol={() => onRemoveSymbol(idx)}
            />
          ))}
          <AddItemButton onClick={onAddItem} className="w-full h-full" />
        </div>
      </SortableContext>
    </DndContext>
  );
}
