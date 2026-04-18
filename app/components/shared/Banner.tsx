"use client";

import { Layers, Pencil, ImageIcon, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { getCategoryColour } from '@/app/lib/categoryColours';

type BannerProps = {
  categoryName: string;
  imagePath?: string;
  colour?: string;
  onEdit?: () => void;
};

export function Banner({ categoryName, imagePath, colour, onEdit }: BannerProps) {
  const t = useTranslations('banner');
  const router = useRouter();

  const colourPair = getCategoryColour(colour ?? 'orange');
  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: name + action buttons */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h1
          className="text-theme-h3 font-bold leading-tight truncate"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          {categoryName}
        </h1>

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--theme-button-highlight)', color: 'var(--theme-text)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('backButton')}
          </button>

          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-small font-medium opacity-50 cursor-not-allowed"
            style={{ background: 'var(--theme-card)', color: 'var(--theme-text-primary)' }}
          >
            <Layers className="w-3.5 h-3.5" />
            {t('modelButton')}
          </button>

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
