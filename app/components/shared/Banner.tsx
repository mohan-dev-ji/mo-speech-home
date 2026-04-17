"use client";

import { Layers, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

type BannerProps = {
  categoryName: string;
};

export function Banner({ categoryName }: BannerProps) {
  const t = useTranslations('banner');

  return (
    <div className="flex flex-col justify-center min-h-[160px] p-1">
      <h1
        className="text-theme-h3 font-bold leading-tight"
        style={{ color: 'var(--theme-alt-text)' }}
      >
        {categoryName}
      </h1>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-small font-medium opacity-50 cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--theme-alt-text)' }}
        >
          <Layers className="w-3.5 h-3.5" />
          {t('modelButton')}
        </button>

        <button
          type="button"
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-small font-medium opacity-50 cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--theme-alt-text)' }}
        >
          <Pencil className="w-3.5 h-3.5" />
          {t('editButton')}
        </button>
      </div>
    </div>
  );
}
