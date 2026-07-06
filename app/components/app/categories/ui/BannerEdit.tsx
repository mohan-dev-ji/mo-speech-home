"use client";

import { useEffect, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { Button } from '@/app/components/app/shared/ui/Button';
import { useTranslations } from 'next-intl';
import { getCategoryColour } from '@/app/lib/categoryColours';

// ─── Folder image (static) ───────────────────────────────────────────────────
//
// Display-only on the detail banner. Folder presentation (colour + image) is
// edited one level up, on the category tile in the grid's edit mode — so the
// detail edit banner just shows the image as context and stays focused on
// symbol editing (owner decision 2026-06-29).

function FolderImageCard({
  imagePath,
  colour,
  categoryName,
}: {
  imagePath?: string;
  colour: string;
  categoryName: string;
}) {
  const colourPair = getCategoryColour(colour);
  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div className="relative w-[136px] h-[136px] shrink-0">
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
  /** The category's colour — display-only here (drives the folder thumbnail
   *  tint). Edited on the grid tile a level up, not in this banner. */
  draftColour: string;
  onExit: () => void;
  onAddSymbol: () => void;
  /** Admin-only: open the tier picker to publish this category as a module.
   *  Rendered inline in the banner button row (matches the list/sentence
   *  module pages). Parent passes it only in admin view, so no separate gate
   *  is needed here. See ADR-008. */
  onPublishModule?: () => void;
  /** Label for the publish button — "Publish as module" or "Update module"
   *  depending on whether this category is already published. */
  publishModuleLabel?: string;
};

export function BannerEdit({
  categoryName,
  onCategoryNameChange,
  imagePath,
  draftColour,
  onExit,
  onAddSymbol,
  onPublishModule,
  publishModuleLabel,
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

            {/* Publish as module — admin-only, opens the tier picker
                (default/free/pro/max). Inline with the other banner actions to
                match the list/sentence module pages. */}
            {onPublishModule && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onPublishModule}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                {publishModuleLabel ?? t('bannerPublishModule')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Right: folder image (display-only — edited on the grid tile a level up) */}
      <FolderImageCard
        imagePath={imagePath}
        colour={draftColour}
        categoryName={categoryName}
      />
    </div>
  );
}
