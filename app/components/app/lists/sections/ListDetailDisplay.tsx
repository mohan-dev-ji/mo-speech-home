"use client";

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SymbolThumb, CheckboxBtn } from '../ui/ListItemAtoms';
import type { ListItem } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayItemProps = {
  item: ListItem;
  index: number;
  showNumbers: boolean;
  showChecklist: boolean;
  showFirstThen: boolean;
  checked: boolean;
  onToggle: () => void;
  onPlay: () => void;
};

export type DisplayContainerProps = {
  items: ListItem[];
  showNumbers: boolean;
  showChecklist: boolean;
  showFirstThen: boolean;
  checkedIds: Set<string>;
  onToggle: (localId: string) => void;
  onItemClick: (index: number) => void;
};

export type PlayModalState = {
  item: ListItem;
  index: number;
} | null;

// ─── First/Then pill ──────────────────────────────────────────────────────────

function FirstThenPill({ index }: { index: number }) {
  const t = useTranslations('lists');
  return (
    <span
      className="text-theme-l font-bold shrink-0 w-14 text-center py-1 rounded-theme-sm"
      style={{
        background: index === 0 ? 'var(--theme-brand-primary)' : 'rgba(255,255,255,0.12)',
        color: index === 0 ? 'var(--theme-alt-text)' : 'var(--theme-text-primary)',
      }}
    >
      {index === 0 ? t('firstLabel') : t('thenLabel')}
    </span>
  );
}

// ─── Play modal ───────────────────────────────────────────────────────────────

type ListItemPlayModalProps = {
  state: PlayModalState;
  showNumbers: boolean;
  showChecklist: boolean;
  showFirstThen: boolean;
  checkedIds: Set<string>;
  onToggle: (localId: string) => void;
  onClose: () => void;
};

export function ListItemPlayModal({
  state,
  showNumbers,
  showChecklist,
  showFirstThen,
  checkedIds,
  onToggle,
  onClose,
}: ListItemPlayModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current?.pause();
    if (state?.item.audioPath) {
      const audio = new Audio(`/api/assets?key=${state.item.audioPath}`);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }
    return () => { audioRef.current?.pause(); };
  }, [state]);

  if (!state) return null;
  const { item, index } = state;
  const checked = checkedIds.has(item.localId);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: 'var(--theme-overlay)' }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full"
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="flex flex-col items-center gap-5 rounded-2xl p-8 w-full max-w-xs transition-colors"
        style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {showFirstThen && <FirstThenPill index={index} />}
        {showNumbers && (
          <span className="text-theme-h2 font-bold" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>
            {index + 1}
          </span>
        )}
        <div
          className="w-full aspect-square rounded-theme overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--theme-symbol-bg)' }}
        >
          {item.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/assets?key=${item.imagePath}`}
              alt={item.description ?? ''}
              className="w-[90%] h-[90%] object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-3/4 aspect-square rounded-xl" style={{ background: 'rgba(0,0,0,0.08)' }} />
          )}
        </div>
        {item.description && (
          <p className="text-theme-h4 font-semibold text-center" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>
            {item.description}
          </p>
        )}
        {showChecklist && (
          <CheckboxBtn checked={checked} onToggle={() => onToggle(item.localId)} />
        )}
      </div>
    </div>
  );
}

// ─── Row item ─────────────────────────────────────────────────────────────────

function DisplayItemRow({ item, index, showNumbers, showChecklist, showFirstThen, checked, onToggle, onPlay }: DisplayItemProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-theme p-4 transition-colors cursor-pointer"
      style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}
      onClick={onPlay}
    >
      {showFirstThen && <FirstThenPill index={index} />}
      {showNumbers && (
        <span className="text-theme-h3 font-bold shrink-0 w-8 text-center" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>
          {index + 1}
        </span>
      )}
      <SymbolThumb imagePath={item.imagePath} size="lg" />
      {item.description && (
        <p className="flex-1 text-theme-p" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{item.description}</p>
      )}
      {showChecklist && (
        <div onClick={(e) => e.stopPropagation()}>
          <CheckboxBtn checked={checked} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

// ─── Column item ──────────────────────────────────────────────────────────────

function DisplayItemColumn({ item, index, showNumbers, showChecklist, showFirstThen, checked, onToggle, onPlay }: DisplayItemProps) {
  return (
    <div
      className="flex flex-1 min-w-0 min-h-0 flex-col items-center justify-center gap-3 rounded-theme p-4 transition-colors h-full cursor-pointer"
      style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}
      onClick={onPlay}
    >
      {showFirstThen && <FirstThenPill index={index} />}
      {showNumbers && (
        <span className="text-theme-h2 font-bold" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>
          {index + 1}
        </span>
      )}

      {/* Symbol card */}
      <div
        className="w-full aspect-square rounded-theme overflow-hidden flex items-center justify-center"
        style={{ background: 'var(--theme-symbol-bg)' }}
      >
        {item.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/assets?key=${item.imagePath}`}
            alt={item.description ?? ''}
            className="w-[90%] h-[90%] object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-3/4 aspect-square rounded-xl" style={{ background: 'rgba(0,0,0,0.08)' }} />
        )}
      </div>

      {item.description && (
        <p className="text-theme-s text-center" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>
          {item.description}
        </p>
      )}
      {showChecklist && (
        <div onClick={(e) => e.stopPropagation()}>
          <CheckboxBtn checked={checked} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

// ─── Grid item ────────────────────────────────────────────────────────────────

function DisplayItemGrid({ item, index, showNumbers, showChecklist, showFirstThen, checked, onToggle, onPlay }: DisplayItemProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-theme p-4 transition-colors cursor-pointer"
      style={{ background: checked ? 'var(--theme-success, #22c55e)' : 'var(--theme-card)' }}
      onClick={onPlay}
    >
      {showFirstThen && <FirstThenPill index={index} />}
      {showNumbers && (
        <span className="text-theme-h3 font-bold shrink-0 w-8 text-center" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>
          {index + 1}
        </span>
      )}
      <SymbolThumb imagePath={item.imagePath} size="md" />
      {item.description && (
        <p className="flex-1 text-theme-s" style={{ color: checked ? '#fff' : 'var(--theme-text-primary)' }}>{item.description}</p>
      )}
      {showChecklist && (
        <div onClick={(e) => e.stopPropagation()}>
          <CheckboxBtn checked={checked} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

// ─── Display containers ───────────────────────────────────────────────────────

export function DisplayRows({ items, showNumbers, showChecklist, showFirstThen, checkedIds, onToggle, onItemClick }: DisplayContainerProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => (
        <DisplayItemRow
          key={item.localId}
          item={item}
          index={idx}
          showNumbers={showNumbers}
          showChecklist={showChecklist}
          showFirstThen={showFirstThen}
          checked={checkedIds.has(item.localId)}
          onToggle={() => onToggle(item.localId)}
          onPlay={() => onItemClick(idx)}
        />
      ))}
    </div>
  );
}

export function DisplayColumns({ items, showNumbers, showChecklist, showFirstThen, checkedIds, onToggle, onItemClick }: DisplayContainerProps) {
  return (
    <div className="flex flex-1 min-h-0 gap-3">
      {items.map((item, idx) => (
        <DisplayItemColumn
          key={item.localId}
          item={item}
          index={idx}
          showNumbers={showNumbers}
          showChecklist={showChecklist}
          showFirstThen={showFirstThen}
          checked={checkedIds.has(item.localId)}
          onToggle={() => onToggle(item.localId)}
          onPlay={() => onItemClick(idx)}
        />
      ))}
    </div>
  );
}

export function DisplayGrid({ items, showNumbers, showChecklist, showFirstThen, checkedIds, onToggle, onItemClick }: DisplayContainerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, idx) => (
        <DisplayItemGrid
          key={item.localId}
          item={item}
          index={idx}
          showNumbers={showNumbers}
          showChecklist={showChecklist}
          showFirstThen={showFirstThen}
          checked={checkedIds.has(item.localId)}
          onToggle={() => onToggle(item.localId)}
          onPlay={() => onItemClick(idx)}
        />
      ))}
    </div>
  );
}
