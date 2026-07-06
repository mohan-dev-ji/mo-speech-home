"use client";

import { ImageIcon, Upload } from 'lucide-react';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { CreateButton } from '@/app/components/app/shared/ui/CreateButton';
import { Button } from '@/app/components/app/shared/ui/Button';
import { useTranslations } from 'next-intl';
import { getCategoryColour } from '@/app/lib/categoryColours';

// ─── Folder image (static) ───────────────────────────────────────────────────
//
// Display-only on the detail banner. Folder presentation (colour + image) is
// edited one level up, on the category tile in the grid's edit mode. Matches the
// view Banner's image card exactly (single `object-contain p-3`) so the image
// doesn't change size when toggling edit mode.

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
    <div
      className="w-[136px] h-[136px] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
      style={{ backgroundColor: colourPair.c100 }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={categoryName}
          className="w-full h-full object-contain p-3"
          draggable={false}
        />
      ) : (
        <ImageIcon className="w-12 h-12" style={{ color: colourPair.c500 }} />
      )}
    </div>
  );
}

// ─── BannerEdit ───────────────────────────────────────────────────────────────
//
// The edit-mode detail banner. Structurally identical to the shared view Banner —
// static title, same image card, loose button row — the only difference is which
// buttons show (Exit Edit / Add Symbol / Publish). The title is read-only here;
// a category is renamed on its tile in the grid, like list/sentence folders.

export type BannerEditProps = {
  categoryName: string;
  imagePath?: string;
  /** The category's colour — display-only here (drives the folder thumbnail
   *  tint). Edited on the grid tile a level up, not in this banner. */
  draftColour: string;
  onExit: () => void;
  onAddSymbol: () => void;
  /** Admin-only: open the tier picker to publish this category as a module.
   *  Rendered inline in the banner button row (matches the list/sentence
   *  module pages). Parent passes it only in admin view. See ADR-008. */
  onPublishModule?: () => void;
  /** Label for the publish button — "Publish as module" or "Update module"
   *  depending on whether this category is already published. */
  publishModuleLabel?: string;
};

export function BannerEdit({
  categoryName,
  imagePath,
  draftColour,
  onExit,
  onAddSymbol,
  onPublishModule,
  publishModuleLabel,
}: BannerEditProps) {
  const t = useTranslations('categoryDetail');

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: static title + edit controls */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className="text-theme-h3 font-bold leading-tight truncate"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {categoryName}
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-2 mt-3">
          {/* Exit Edit — shared EditButton in its `isEditing` state (this banner
              is only mounted while editing). */}
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

          {/* Publish as module — admin-only, opens the tier picker. */}
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

      {/* Right: folder image (display-only — edited on the grid tile a level up) */}
      <FolderImageCard
        imagePath={imagePath}
        colour={draftColour}
        categoryName={categoryName}
      />
    </div>
  );
}
