"use client";

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import type { Draft } from './types';

type Props = {
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
  pendingImagePreviewUrl: string | null;
  onImageSelected: (blob: Blob, previewUrl: string) => void;
};

export function UploadTab({ draft, patch, pendingImagePreviewUrl, onImageSelected }: Props) {
  const t = useTranslations('symbolEditor');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const MAX = 512;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else { w = Math.round(w * MAX / h); h = MAX; }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const preview = URL.createObjectURL(blob);
        onImageSelected(blob, preview);
        patch({ imageSourceTab: 'upload', resolvedImagePath: undefined });
      }, 'image/webp', 0.85);
    };

    img.src = objectUrl;
    e.target.value = '';
  }

  const displaySrc = pendingImagePreviewUrl
    ?? (draft.resolvedImagePath ? `/api/assets?key=${draft.resolvedImagePath}` : null);

  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full p-6">
      {displaySrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt="Selected"
            className="max-w-[180px] max-h-[180px] object-contain rounded-theme-sm"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-theme-sm text-theme-s font-semibold"
            style={{
              background: 'var(--theme-symbol-bg)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-button-highlight)',
            }}
          >
            <Upload className="w-4 h-4" />
            {t('uploadChangeImage')}
          </button>
        </>
      ) : (
        <>
          <div
            className="w-28 h-28 rounded-theme-sm flex items-center justify-center"
            style={{ background: 'var(--theme-symbol-bg)', border: '2px dashed var(--theme-button-highlight)' }}
          >
            <Upload className="w-8 h-8" style={{ color: 'var(--theme-secondary-text)' }} />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-theme-sm text-theme-s font-semibold"
            style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-alt-text)' }}
          >
            <Upload className="w-4 h-4" />
            {t('uploadFromDevice')}
          </button>
          <p className="text-theme-xs text-center max-w-xs" style={{ color: 'var(--theme-secondary-text)' }}>
            {t('uploadHint')}
          </p>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
