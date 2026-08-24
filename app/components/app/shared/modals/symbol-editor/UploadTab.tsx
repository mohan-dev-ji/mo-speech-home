"use client";

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';
import type { Draft } from './types';
import { toResizedWebp } from './resizeImage';

type Props = {
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
  pendingImagePreviewUrl: string | null;
  onImageSelected: (blob: Blob, previewUrl: string) => void;
};

export function UploadTab({ draft, patch, pendingImagePreviewUrl, onImageSelected }: Props) {
  const t = useTranslations('symbolEditor');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const blob = await toResizedWebp(file);
      const preview = URL.createObjectURL(blob);
      onImageSelected(blob, preview);
      patch({
        imageSourceTab: 'upload',
        resolvedImagePath: undefined,
        aiPrompt: undefined,
        // Clear any prior image-search credit — it belongs to the picture the
        // user just replaced, not to this upload (phase-30 §2). Mirrors
        // AiGenerateTab.
        imageSourceUrl: undefined,
        imageAttribution: undefined,
        imageLicense: undefined,
        imageProvider: undefined,
      });
    } catch {
      // Resize failed (corrupt/unsupported image) — silently no-op, matching
      // the previous behaviour of the inline blob===null check.
    }
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
