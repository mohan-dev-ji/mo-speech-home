"use client";

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { DEFAULT_VOICE_ID } from '@/lib/r2-paths';
import { SymbolPreview } from './SymbolPreview';
import { PropertiesPanel } from './PropertiesPanel';
import { SymbolStixTab } from './SymbolStixTab';
import { UploadTab } from './UploadTab';
import { INITIAL_DRAFT, type Draft, type ImageSourceTab } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListItemSaveResult = {
  imagePath?: string;
  description?: string;
  audioPath?: string;
};

export type SymbolEditorModalProps = {
  isOpen: boolean;
  profileSymbolId?: Id<'profileSymbols'>;        // edit mode (categoryBoard)
  profileCategoryId?: Id<'profileCategories'>;    // create mode default category
  profileId: Id<'studentProfiles'>;
  language: string;
  voiceId?: string;                               // defaults to DEFAULT_VOICE_ID
  editorMode?: 'categoryBoard' | 'listItem';      // defaults to 'categoryBoard'
  initialLabel?: string;                          // pre-populate label / description field
  onClose: () => void;
  onSave: (id: Id<'profileSymbols'>) => void;
  onListItemSave?: (result: ListItemSaveResult) => void;
  // Folder image mode — picks an image for the category folder, skips label/audio/display
  folderImageMode?: boolean;
  initialImagePath?: string;
  onFolderImageSave?: (imagePath: string) => void;
  // Override the modal header title
  modalTitle?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadBlobToR2(blob: Blob, key: string): Promise<void> {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('key', key);
  const res = await fetch('/api/upload-asset', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SymbolEditorModal({
  isOpen,
  profileSymbolId,
  profileCategoryId: initCategoryId,
  profileId,
  language,
  voiceId = DEFAULT_VOICE_ID,
  editorMode = 'categoryBoard',
  initialLabel,
  onClose,
  onSave,
  onListItemSave,
  folderImageMode = false,
  initialImagePath,
  onFolderImageSave,
  modalTitle,
}: SymbolEditorModalProps) {
  const t = useTranslations('symbolEditor');
  const isEditMode = !!profileSymbolId;

  // ── State ──────────────────────────────────────────────────────────────────

  const initialAudioMode = 'default';

  const [draft, setDraft] = useState<Draft>({
    ...INITIAL_DRAFT,
    audioMode: initialAudioMode,
    profileCategoryId: initCategoryId ?? '',
    ...(initialLabel ? { labelEng: initialLabel } : {}),
    ...(folderImageMode && initialImagePath
      ? { resolvedImagePath: initialImagePath, imageSourceTab: 'upload' as const }
      : {}),
  });

  const [pendingImageBlob, setPendingImageBlob] = useState<Blob | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [pendingAudioBlobUrl, setPendingAudioBlobUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const imagePreviewUrlRef = useRef<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Convex ─────────────────────────────────────────────────────────────────

  const existingSymbol = useQuery(
    api.profileSymbols.getProfileSymbol,
    profileSymbolId ? { profileSymbolId } : 'skip'
  );

  const categories = useQuery(
    api.profileCategories.getProfileCategories,
    editorMode === 'categoryBoard' ? { profileId } : 'skip'
  );

  const createProfileSymbol = useMutation(api.profileSymbols.createProfileSymbol);
  const updateProfileSymbol = useMutation(api.profileSymbols.updateProfileSymbol);

  // ── Pre-populate draft in edit mode ────────────────────────────────────────

  useEffect(() => {
    if (!existingSymbol) return;
    const ps = existingSymbol;
    setDraft({
      imageSourceTab:
        ps.imageSource.type === 'symbolstix' ? 'symbolstix' :
        ps.imageSource.type === 'userUpload' ? 'upload' :
        ps.imageSource.type === 'googleImages' ? 'google-images' : 'ai-generate',
      symbolstixId: ps.imageSource.type === 'symbolstix' ? ps.imageSource.symbolId : undefined,
      symbolstixImagePath: ps.symbolRecord?.imagePath,
      symbolstixAudioEng: ps.symbolRecord?.audio.eng.default,
      symbolstixAudioHin: ps.symbolRecord?.audio.hin?.default,
      resolvedImagePath:
        ps.imageSource.type !== 'symbolstix'
          ? (ps.imageSource as { imagePath: string }).imagePath
          : undefined,
      labelEng: ps.label.eng,
      labelHin: ps.label.hin ?? '',
      audioMode:
        !ps.audio?.eng ? 'default' :
        ps.audio.eng.type === 'recorded' ? 'record' :
        ps.audio.eng.type === 'tts' ? 'generate' : 'default',
      resolvedAudioPath: ps.audio?.eng?.path,
      bgColour: ps.display?.bgColour ?? INITIAL_DRAFT.bgColour,
      textColour: ps.display?.textColour ?? INITIAL_DRAFT.textColour,
      borderColour: ps.display?.borderColour ?? INITIAL_DRAFT.borderColour,
      borderWidth: ps.display?.borderWidth ?? INITIAL_DRAFT.borderWidth,
      showLabel: ps.display?.showLabel ?? true,
      showImage: ps.display?.showImage ?? true,
      textSize: ps.display?.textSize ?? 'sm',
      shape: ps.display?.shape ?? 'rounded',
      profileCategoryId: ps.profileCategoryId,
    });
  }, [existingSymbol]);

  // Revoke image preview URL on unmount only
  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
      previewAudioRef.current?.pause();
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function patch(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function handleImageSelected(blob: Blob, previewUrl: string) {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = previewUrl;
    setPendingImageBlob(blob);
    setPendingImagePreviewUrl(previewUrl);
  }

  function handleAudioBlobChange(blob: Blob | null, blobUrl: string | null) {
    setPendingAudioBlob(blob);
    setPendingAudioBlobUrl(blobUrl);
  }

  // ── Preview play overlay ───────────────────────────────────────────────────

  function handlePreviewPlay() {
    let audioUrl: string | null = null;

    if (draft.audioMode === 'default' && draft.symbolstixAudioEng) {
      audioUrl = `/api/assets?key=${draft.symbolstixAudioEng}`;
    } else if (draft.audioMode === 'generate' && draft.ttsR2Key) {
      audioUrl = `/api/assets?key=${draft.ttsR2Key}`;
    } else if (draft.audioMode === 'record' && pendingAudioBlobUrl) {
      audioUrl = pendingAudioBlobUrl;
    }

    if (!audioUrl) return;

    previewAudioRef.current?.pause();
    const audio = new Audio(audioUrl);
    previewAudioRef.current = audio;

    const done = () => setIsPreviewPlaying(false);
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);

    setIsPreviewPlaying(true);
    audio.play().catch(done);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaveError(null);

    // ── Folder image mode (category folder image) ─────────────────────────
    if (folderImageMode) {
      const hasImage =
        draft.imageSourceTab === 'symbolstix'
          ? !!draft.symbolstixImagePath
          : !!(pendingImageBlob || draft.resolvedImagePath);
      if (!hasImage) { setSaveError(t('errorNoImage')); return; }
      setIsSaving(true);
      try {
        let imagePath = draft.resolvedImagePath;
        if (pendingImageBlob && draft.imageSourceTab === 'upload') {
          const key = `profiles/${profileId}/symbols/${crypto.randomUUID()}.webp`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
        }
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
        }
        onFolderImageSave?.(imagePath!);
        onClose();
      } catch {
        setSaveError(t('errorSave'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── List item mode ────────────────────────────────────────────────────
    if (editorMode === 'listItem') {
      setIsSaving(true);
      try {
        // Resolve image
        let imagePath: string | undefined = draft.resolvedImagePath;
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
        } else if (pendingImageBlob) {
          const key = `profiles/${profileId}/images/${crypto.randomUUID()}.webp`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
        }

        // Resolve audio
        let audioPath: string | undefined;
        if (draft.audioMode === 'record' && pendingAudioBlob) {
          const ext = pendingAudioBlob.type.includes('ogg') ? 'ogg' : 'webm';
          const key = `profiles/${profileId}/audio/${crypto.randomUUID()}.${ext}`;
          await uploadBlobToR2(pendingAudioBlob, key);
          audioPath = key;
        } else if (draft.audioMode === 'generate' && draft.ttsR2Key) {
          audioPath = draft.ttsR2Key;
        } else if (draft.audioMode === 'default' && draft.symbolstixAudioEng) {
          audioPath = draft.symbolstixAudioEng;
        }

        onListItemSave?.({
          imagePath,
          description: draft.labelEng.trim() || undefined,
          audioPath,
        });
        onClose();
      } catch {
        setSaveError(t('errorSave'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── Category board mode ───────────────────────────────────────────────
    if (!draft.labelEng.trim()) { setSaveError(t('errorNoLabel')); return; }
    if (!draft.profileCategoryId) { setSaveError(t('errorNoCategory')); return; }

    const hasImage =
      draft.imageSourceTab === 'symbolstix'
        ? !!draft.symbolstixId
        : !!(pendingImageBlob || draft.resolvedImagePath);
    if (!hasImage) { setSaveError(t('errorNoImage')); return; }

    setIsSaving(true);
    try {
      // 1. Upload pending image
      let resolvedImagePath = draft.resolvedImagePath;
      if (pendingImageBlob && draft.imageSourceTab === 'upload') {
        const key = `profiles/${profileId}/symbols/${crypto.randomUUID()}.webp`;
        await uploadBlobToR2(pendingImageBlob, key);
        resolvedImagePath = key;
      }

      // 2. Upload pending audio recording
      let resolvedAudioPath = draft.resolvedAudioPath;
      if (pendingAudioBlob && draft.audioMode === 'record') {
        const ext = pendingAudioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const key = `profiles/${profileId}/audio/${crypto.randomUUID()}.${ext}`;
        await uploadBlobToR2(pendingAudioBlob, key);
        resolvedAudioPath = key;
      } else if (draft.audioMode === 'generate' && draft.ttsR2Key) {
        resolvedAudioPath = draft.ttsR2Key;
      }

      // 3. Build imageSource
      type IS =
        | { type: 'symbolstix'; symbolId: Id<'symbols'> }
        | { type: 'userUpload'; imagePath: string }
        | { type: 'googleImages'; imagePath: string; imageSourceUrl?: string }
        | { type: 'aiGenerated'; imagePath: string; aiPrompt?: string };

      const imageSource: IS =
        draft.imageSourceTab === 'symbolstix'
          ? { type: 'symbolstix', symbolId: draft.symbolstixId! }
          : { type: 'userUpload', imagePath: resolvedImagePath! };

      // 4. Build audio override
      type AR = { type: 'r2' | 'tts' | 'recorded'; path: string; ttsText?: string; language?: string };
      let audio: { eng?: AR; hin?: AR } | undefined;
      if (draft.audioMode === 'record' && resolvedAudioPath) {
        audio = { eng: { type: 'recorded', path: resolvedAudioPath, language: 'eng' } };
      } else if (draft.audioMode === 'generate' && resolvedAudioPath) {
        audio = { eng: { type: 'tts', path: resolvedAudioPath, language: 'eng' } };
      }

      const display = {
        bgColour: draft.bgColour,
        textColour: draft.textColour,
        borderColour: draft.borderColour,
        borderWidth: draft.borderWidth,
        showLabel: draft.showLabel,
        showImage: draft.showImage,
        textSize: draft.textSize,
        shape: draft.shape,
      };

      const label = {
        eng: draft.labelEng.trim(),
        ...(draft.labelHin.trim() ? { hin: draft.labelHin.trim() } : {}),
      };

      const catId = draft.profileCategoryId as Id<'profileCategories'>;

      let savedId: Id<'profileSymbols'>;
      if (isEditMode) {
        savedId = (await updateProfileSymbol({
          profileSymbolId: profileSymbolId!,
          profileCategoryId: catId,
          imageSource,
          label,
          audio,
          display,
        })) as Id<'profileSymbols'>;
      } else {
        savedId = await createProfileSymbol({
          profileId,
          profileCategoryId: catId,
          imageSource,
          label,
          audio,
          display,
        });
      }

      onSave(savedId);
      onClose();
    } catch {
      setSaveError(t('errorSave'));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Early return ───────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ── Tab config ─────────────────────────────────────────────────────────────

  const imageTabConfig: { value: ImageSourceTab; label: string }[] = [
    { value: 'symbolstix', label: t('tabSymbolstix') },
    { value: 'upload', label: t('tabUpload') },
    { value: 'google-images', label: t('tabGoogleImages') },
    { value: 'ai-generate', label: t('tabAiGenerate') },
  ];

  // ── Derived ────────────────────────────────────────────────────────────────

  const previewImageSrc =
    draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath
      ? `/api/assets?key=${draft.symbolstixImagePath}`
      : pendingImagePreviewUrl
      ?? (draft.resolvedImagePath ? `/api/assets?key=${draft.resolvedImagePath}` : undefined);

  const previewLabel =
    language === 'hin' && draft.labelHin ? draft.labelHin : draft.labelEng;

  const defaultTitle =
    editorMode === 'listItem'
      ? t('titleListItem')
      : isEditMode ? t('titleEdit') : t('titleCreate');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col md:flex-row w-full md:max-w-5xl h-[92dvh] md:h-[85vh] rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--theme-alt-card)' }}
      >

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div
          className="flex flex-col md:w-[340px] shrink-0 border-b md:border-b-0 md:border-r h-[46%] md:h-full"
          style={{ borderColor: 'var(--theme-button-highlight)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'var(--theme-symbol-bg)', borderBottom: '1px solid var(--theme-button-highlight)' }}
          >
            <h2 className="text-theme-s font-bold" style={{ color: 'var(--theme-text)' }}>
              {modalTitle ?? defaultTitle}
            </h2>
          </div>

          {/* Live preview card */}
          <div className={`px-6 pt-3 pb-2 ${folderImageMode ? 'flex-1 flex items-center justify-center' : 'shrink-0'}`}>
            <div className="w-1/2 mx-auto">
              <SymbolPreview
                imageSrc={previewImageSrc}
                label={folderImageMode ? '' : previewLabel}
                draft={draft}
                onPlay={handlePreviewPlay}
                isPlaying={isPreviewPlaying}
              />
            </div>
          </div>

          {/* Properties — hidden in folder image mode */}
          {!folderImageMode && (
            <PropertiesPanel
              draft={draft}
              patch={patch}
              language={language}
              categories={categories}
              pendingAudioBlobUrl={pendingAudioBlobUrl}
              onAudioBlobChange={handleAudioBlobChange}
              editorMode={editorMode}
              voiceId={voiceId}
            />
          )}

          {/* Action buttons */}
          <div
            className="shrink-0 px-4 py-4 flex flex-col gap-2"
            style={{ borderTop: '1px solid var(--theme-button-highlight)' }}
          >
            {saveError && (
              <div className="flex items-center gap-1.5 text-theme-xs" style={{ color: 'var(--theme-warning)' }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
                style={{
                  background: 'var(--theme-symbol-bg)',
                  color: 'var(--theme-secondary-text)',
                  border: '1px solid var(--theme-button-highlight)',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
                style={{
                  background: 'var(--theme-brand-primary)',
                  color: 'var(--theme-alt-text)',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: image source tabs ──────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0 h-[54%] md:h-full">

          {/* Tab bar */}
          <div
            className="flex shrink-0 border-b overflow-x-auto"
            style={{ borderColor: 'var(--theme-button-highlight)' }}
          >
            {imageTabConfig.map(({ value, label }) => {
              const isActive = draft.imageSourceTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ imageSourceTab: value })}
                  className="px-4 py-3 text-theme-s font-medium shrink-0 relative whitespace-nowrap"
                  style={{ color: isActive ? 'var(--theme-brand-primary)' : 'var(--theme-secondary-text)' }}
                >
                  {label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                      style={{ background: 'var(--theme-brand-primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {draft.imageSourceTab === 'symbolstix' && (
              <SymbolStixTab language={language} draft={draft} patch={patch} />
            )}
            {draft.imageSourceTab === 'upload' && (
              <UploadTab
                draft={draft}
                patch={patch}
                pendingImagePreviewUrl={pendingImagePreviewUrl}
                onImageSelected={handleImageSelected}
              />
            )}
            {draft.imageSourceTab === 'google-images' && (
              <div className="flex items-center justify-center h-full p-6">
                <p className="text-theme-s text-center" style={{ color: 'var(--theme-secondary-text)' }}>
                  {t('googleComingSoon')}
                </p>
              </div>
            )}
            {draft.imageSourceTab === 'ai-generate' && (
              <div className="flex items-center justify-center h-full p-6">
                <p className="text-theme-s text-center" style={{ color: 'var(--theme-secondary-text)' }}>
                  {t('aiComingSoon')}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
