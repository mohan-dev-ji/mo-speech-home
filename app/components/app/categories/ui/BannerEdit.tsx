"use client";

import { useEffect, useState } from 'react';
import { FolderOpen, ImageIcon, ChevronDown, Bookmark, Library, RotateCcw } from 'lucide-react';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { useTranslations } from 'next-intl';
import { CATEGORY_COLOURS, getCategoryColour } from '@/app/lib/categoryColours';
import { ToggleButton } from '@/app/components/app/shared/ui/ToggleButton';
import { PlanTierPicker, type PlanTier } from '@/app/components/app/shared/ui/PlanTierPicker';
import { LibrarySourceBadge } from '@/app/components/app/categories/ui/LibrarySourceBadge';

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
  /** Called when the user commits a name edit (blur or Enter). Empty
   *  strings are ignored by the caller. Optional — when omitted, the
   *  banner renders the name as plain text instead of an input. */
  onCategoryNameChange?: (name: string) => void;
  imagePath?: string;
  draftColour: string;
  onColourChange: (colour: string) => void;
  onExit: () => void;
  onAddSymbol: () => void;
  onEditFolderImage: () => void;
  // Admin-only affordances. Parent decides visibility via `showAdminButtons`
  // (gated on viewMode === 'admin' && useIsAdmin()). When false, the entire
  // admin row is hidden. See ADR-008.
  showAdminButtons?: boolean;
  isDefault?: boolean;       // Currently in the starter pack
  isInLibrary?: boolean;     // Currently in a non-starter library pack
  libraryTier?: PlanTier;    // Tier of the library pack (only meaningful when isInLibrary)
  onToggleDefault?: () => void;
  onToggleLibrary?: () => void;
  onSetTier?: (tier: PlanTier) => void;
  // Reload Defaults — instructor-facing reset for pack-loaded categories.
  // Visible only when both are set (the parent sets librarySourceId from
  // category.librarySourceId and onReloadDefaults from its dialog opener).
  librarySourceId?: string;
  onReloadDefaults?: () => void;
};

export function BannerEdit({
  categoryName,
  onCategoryNameChange,
  imagePath,
  draftColour,
  onColourChange,
  onExit,
  onAddSymbol,
  onEditFolderImage,
  showAdminButtons = false,
  isDefault = false,
  isInLibrary = false,
  libraryTier = 'free',
  onToggleDefault,
  onToggleLibrary,
  onSetTier,
  librarySourceId,
  onReloadDefaults,
}: BannerEditProps) {
  const t = useTranslations('categoryDetail');

  // Local draft for the name input — committed on blur / Enter via the
  // parent's onCategoryNameChange callback. Re-syncs whenever the parent's
  // categoryName prop changes (e.g. another tab edits the same category).
  const [nameDraft, setNameDraft] = useState(categoryName);
  useEffect(() => {
    setNameDraft(categoryName);
  }, [categoryName]);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === categoryName) {
      setNameDraft(categoryName);
      return;
    }
    onCategoryNameChange?.(trimmed);
  }

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: name + edit controls */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {onCategoryNameChange ? (
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setNameDraft(categoryName);
                  e.currentTarget.blur();
                }
              }}
              aria-label={t('editNameLabel')}
              className="text-theme-h3 font-bold leading-tight truncate min-w-0 flex-1 bg-transparent outline-none rounded-theme-sm px-1.5 -mx-1.5 transition-colors focus:bg-white/8"
              style={{
                color: 'var(--theme-text-primary)',
                // Persistent dashed border whenever the editable input is
                // mounted (i.e. edit mode is on) — signals "this is editable"
                // before the user clicks. The orange `--theme-enter-mode`
                // token matches the rest of the edit-mode visual language.
                border: '1px dashed var(--theme-enter-mode)',
              }}
            />
          ) : (
            <h1
              className="text-theme-h3 font-bold leading-tight truncate"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              {categoryName}
            </h1>
          )}
          {librarySourceId && <LibrarySourceBadge />}
        </div>

        <div className="flex flex-col gap-2 mt-3">

          {/* Row 1: Edit controls — instructor affordances */}
          <div
            className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-theme"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Exit Edit — uses the shared EditButton in its `isEditing`
                state. The "edit" label is unused here since this banner
                is only mounted while editing, but the prop is still
                required by the component shape. */}
            <EditButton
              isEditing={true}
              onClick={onExit}
              editLabel={t('bannerExitEdit')}
              exitLabel={t('bannerExitEdit')}
            />

            {/* Add Symbol — shared green CreateButton */}
            <CreateButton
              onClick={onAddSymbol}
              label={t('bannerAddSymbol')}
            />

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

            {/* Reload Defaults — visible only when this category was loaded
                from a library pack and the parent supplied a handler. Destructive
                styling matches the Delete pattern in other modals. */}
            {librarySourceId && onReloadDefaults && (
              <button
                type="button"
                onClick={onReloadDefaults}
                title={t('bannerReloadDefaultsHint')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--theme-card)',
                  color: 'var(--theme-warning)',
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('bannerReloadDefaults')}
              </button>
            )}
          </div>

          {/* Row 2: Admin controls — only visible to admins in admin viewMode.
              Tinted amber to distinguish from the instructor row visually. */}
          {showAdminButtons && (
            <div
              className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-theme"
              style={{
                background: 'rgba(255,200,0,0.06)',
                border: '1px solid rgba(255,200,0,0.2)',
              }}
            >
              <ToggleButton
                pressed={isDefault}
                disabled={isInLibrary}
                onClick={() => onToggleDefault?.()}
                icon={<Bookmark className="w-3.5 h-3.5" />}
                title={t('bannerToggleDefaultHint')}
              >
                {t('bannerToggleDefault')}
              </ToggleButton>
              <ToggleButton
                pressed={isInLibrary}
                disabled={isDefault}
                onClick={() => onToggleLibrary?.()}
                icon={<Library className="w-3.5 h-3.5" />}
                title={t('bannerToggleLibraryHint')}
              >
                {t('bannerToggleLibrary')}
              </ToggleButton>
              {isInLibrary && onSetTier && (
                <PlanTierPicker
                  value={libraryTier}
                  onChange={onSetTier}
                  translationNamespace="categoryDetail"
                />
              )}
            </div>
          )}
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
