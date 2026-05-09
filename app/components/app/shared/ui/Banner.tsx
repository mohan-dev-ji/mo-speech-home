"use client";

import { Layers, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { LibrarySourceBadge } from '@/app/components/app/categories/ui/LibrarySourceBadge';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';

type BannerProps = {
  categoryName: string;
  imagePath?: string;
  colour?: string;
  onEdit?: () => void;
  onModel?: () => void;
  modelDisabledReason?: string;
  // When set, renders a "From pack" badge next to the category name.
  // Used to signal pack-loaded categories so instructors discover the
  // Reload Defaults action available in edit mode.
  librarySourceId?: string;
  /** Optional slot rendered above the title inside the left column.
   *  Sits tight to the title (small mb) so the right-column image stays
   *  vertically centered against the [slot + title + buttons] group as
   *  a whole. Used to surface the admin pack-status label. */
  topSlot?: React.ReactNode;
};

export function Banner({
  categoryName,
  imagePath,
  colour,
  onEdit,
  onModel,
  modelDisabledReason,
  librarySourceId,
  topSlot,
}: BannerProps) {
  const t = useTranslations('banner');

  const colourPair = getCategoryColour(colour ?? 'orange');
  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: name + action buttons */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {topSlot && <div className="mb-1.5 self-start">{topSlot}</div>}
        <div className="flex items-center gap-2 min-w-0">
          <h1
            className="text-theme-h3 font-bold leading-tight truncate"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {categoryName}
          </h1>
          {librarySourceId && <LibrarySourceBadge />}
        </div>

        <div className="flex items-center gap-2 mt-3">
          {/* Edit — shared EditButton (always isEditing=false here since
              Banner is the view-mode header; clicking flips into edit
              mode via the parent's onEdit handler). The exitLabel is
              unused but required by the component shape. */}
          <EditButton
            isEditing={false}
            onClick={() => onEdit?.()}
            editLabel={t('editButton')}
            exitLabel={t('editButton')}
          />

          <button
            type="button"
            onClick={onModel}
            disabled={!onModel}
            title={modelDisabledReason}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
          >
            <Layers className="w-3.5 h-3.5" />
            {t('modelButton')}
          </button>
        </div>
      </div>

      {/* Right: category folder image card */}
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
    </div>
  );
}
