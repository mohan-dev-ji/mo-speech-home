"use client";

import { Layers, Pencil, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { LibrarySourceBadge } from '@/app/components/app/categories/ui/LibrarySourceBadge';

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
};

export function Banner({
  categoryName,
  imagePath,
  colour,
  onEdit,
  onModel,
  modelDisabledReason,
  librarySourceId,
}: BannerProps) {
  const t = useTranslations('banner');

  const colourPair = getCategoryColour(colour ?? 'orange');
  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: name + action buttons */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
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
          <button
            type="button"
            onClick={onEdit}
            disabled={!onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('editButton')}
          </button>

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
