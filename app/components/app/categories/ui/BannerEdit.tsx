"use client";

import { useState } from 'react';
import { LogOut, PlusSquare, FolderOpen, ImageIcon, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CATEGORY_COLOURS, getCategoryColour } from '@/app/lib/categoryColours';

// ─── Colour picker ────────────────────────────────────────────────────────────

function ColourPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const t = useTranslations('categoryDetail');
  const [open, setOpen] = useState(false);
  const current = getCategoryColour(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
      >
        <span
          className="w-4 h-4 rounded-theme-sm shrink-0 border border-black/10"
          style={{ backgroundColor: current.c500 }}
        />
        {t('bannerColourPicker')}
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 p-2 rounded-xl shadow-xl z-50 grid grid-cols-6 gap-1.5"
          style={{ background: 'var(--theme-card)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '180px' }}
        >
          {Object.entries(CATEGORY_COLOURS).map(([name, pair]) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => { onChange(name); setOpen(false); }}
              className="w-7 h-7 rounded-md transition-transform hover:scale-110 active:scale-95"
              style={{
                backgroundColor: pair.c500,
                outline: getCategoryColour(value).c500 === pair.c500
                  ? '2px solid white'
                  : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Image card with edit overlay ────────────────────────────────────────────

function EditableImageCard({
  imagePath,
  colour,
  categoryName,
  onClick,
}: {
  imagePath?: string;
  colour: string;
  categoryName: string;
  onClick: () => void;
}) {
  const colourPair = getCategoryColour(colour);
  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div className="relative w-[136px] h-[136px] shrink-0 cursor-pointer" onClick={onClick}>
      {/* Orange dashed border */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <rect
          x="2" y="2" rx="16" ry="16"
          style={{
            width: 'calc(100% - 4px)',
            height: 'calc(100% - 4px)',
            fill: 'none',
            stroke: 'var(--theme-enter-mode)',
            strokeWidth: 4,
            strokeDasharray: '12 6',
          }}
        />
      </svg>

      {/* Card body */}
      <div
        className="w-full h-full p-2 rounded-2xl overflow-hidden relative flex items-center justify-center"
        style={{ backgroundColor: colourPair.c100 }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={categoryName}
            className="w-full h-full object-contain p-2"
            draggable={false}
          />
        ) : (
          <ImageIcon className="w-12 h-12" style={{ color: colourPair.c500 }} />
        )}

      </div>
    </div>
  );
}

// ─── BannerEdit ───────────────────────────────────────────────────────────────

export type BannerEditProps = {
  categoryName: string;
  imagePath?: string;
  draftColour: string;
  onColourChange: (colour: string) => void;
  onExit: () => void;
  onAddSymbol: () => void;
  onEditFolderImage: () => void;
};

export function BannerEdit({
  categoryName,
  imagePath,
  draftColour,
  onColourChange,
  onExit,
  onAddSymbol,
  onEditFolderImage,
}: BannerEditProps) {
  const t = useTranslations('categoryDetail');

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: name + edit controls */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h1
          className="text-theme-h3 font-bold leading-tight truncate"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          {categoryName}
        </h1>

        <div className="flex flex-wrap items-center gap-2 mt-3">

          {/* Exit Edit */}
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('bannerExitEdit')}
          </button>

          {/* Add Symbol */}
          <button
            type="button"
            onClick={onAddSymbol}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
          >
            <PlusSquare className="w-3.5 h-3.5" />
            {t('bannerAddSymbol')}
          </button>

          {/* Colour picker */}
          <ColourPicker value={draftColour} onChange={onColourChange} />

          {/* Edit folder image */}
          <button
            type="button"
            onClick={onEditFolderImage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {t('bannerEditFolderImage')}
          </button>
        </div>
      </div>

      {/* Right: editable image card */}
      <EditableImageCard
        imagePath={imagePath}
        colour={draftColour}
        categoryName={categoryName}
        onClick={onEditFolderImage}
      />
    </div>
  );
}
