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
import { ImagesTab } from './ImagesTab';
import { AiGenerateTab } from './AiGenerateTab';
import { INITIAL_DRAFT, type Draft, type ImageSourceTab } from './types';
import { getCategoryColour } from '@/app/lib/categoryColours';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListItemSaveResult = {
  imagePath?: string;
  description?: string;
  audioPath?: string;
  activeAudioSource?: 'default' | 'generate' | 'record';
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
  imageSourceType?: 'symbolstix' | 'upload' | 'imageSearch' | 'aiGenerated';
};

export type SentenceSlotSaveResult = {
  imagePath?: string;
  displayProps?: {
    bgColour?: string;
    textColour?: string;
    textSize?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showImage?: boolean;
    cardShape?: 'square' | 'rounded' | 'circle';
  };
};

export type SymbolEditorModalProps = {
  isOpen: boolean;
  profileSymbolId?: Id<'profileSymbols'>;        // edit mode (categoryBoard)
  profileCategoryId?: Id<'profileCategories'>;    // create mode default category
  accountId: Id<'users'>;                         // R2 key prefix + ownership context
  language: string;
  voiceId?: string;                               // defaults to DEFAULT_VOICE_ID
  editorMode?: 'categoryBoard' | 'listItem' | 'sentenceSlot';  // defaults to 'categoryBoard'
  initialLabel?: string;                          // pre-populate label / description field
  onClose: () => void;
  onSave: (id: Id<'profileSymbols'>) => void;
  onListItemSave?: (result: ListItemSaveResult) => void;
  onSentenceSlotSave?: (result: SentenceSlotSaveResult) => void;
  // Folder image mode — picks an image for the category folder, skips label/audio/display
  folderImageMode?: boolean;
  initialImagePath?: string;
  initialAudioPath?: string;
  onFolderImageSave?: (imagePath: string) => void;
  // Override the modal header title
  modalTitle?: string;
  // List-item rehydration — restores active-source audio + image-source-tab on re-edit
  initialActiveAudioSource?: 'default' | 'generate' | 'record';
  initialDefaultAudioPath?: string;
  initialGeneratedAudioPath?: string;
  initialRecordedAudioPath?: string;
  initialImageSourceType?: 'symbolstix' | 'upload' | 'imageSearch' | 'aiGenerated';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadBlobToR2(blob: Blob, key: string): Promise<void> {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('key', key);
  const res = await fetch('/api/upload-asset', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
}

// Pick an R2 extension from a blob mime type. UploadTab encodes to webp; the
// Wikimedia proxy returns whatever Wikimedia served (typically jpeg/png).
function extForBlob(blob: Blob): string {
  const t = blob.type.toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('gif')) return 'gif';
  return 'webp';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SymbolEditorModal({
  isOpen,
  profileSymbolId,
  profileCategoryId: initCategoryId,
  accountId,
  language,
  voiceId = DEFAULT_VOICE_ID,
  editorMode = 'categoryBoard',
  initialLabel,
  onClose,
  onSave,
  onListItemSave,
  onSentenceSlotSave,
  folderImageMode = false,
  initialImagePath,
  initialAudioPath,
  onFolderImageSave,
  modalTitle,
  initialActiveAudioSource,
  initialDefaultAudioPath,
  initialGeneratedAudioPath,
  initialRecordedAudioPath,
  initialImageSourceType,
}: SymbolEditorModalProps) {
  const t = useTranslations('symbolEditor');
  const isEditMode = !!profileSymbolId;

  // ── State ──────────────────────────────────────────────────────────────────

  // ── Initial draft ──────────────────────────────────────────────────────────
  // listItem rehydration uses the active-source model: each source is held
  // independently and `activeAudioSource` selects which one playback uses.
  const listItemImageTab: ImageSourceTab | undefined =
    editorMode === 'listItem' && initialImageSourceType
      ? (initialImageSourceType === 'symbolstix'   ? 'symbolstix'   :
         initialImageSourceType === 'imageSearch'  ? 'image-search' :
         initialImageSourceType === 'aiGenerated'  ? 'ai-generate'  : 'upload')
      : undefined;

  const listItemImageSeed =
    editorMode === 'listItem' && initialImagePath
      ? (listItemImageTab === 'symbolstix'
          ? { imageSourceTab: 'symbolstix' as const, symbolstixImagePath: initialImagePath }
          : { imageSourceTab: (listItemImageTab ?? 'upload') as ImageSourceTab, resolvedImagePath: initialImagePath })
      : {};

  // Back-compat: items saved before the active-source model only carry `audioPath`.
  // Treat that as the default source so re-saving an untouched item doesn't erase it.
  const seededDefaultAudioPath =
    editorMode === 'listItem'
      ? (initialDefaultAudioPath
          ?? (!initialActiveAudioSource && !initialGeneratedAudioPath && !initialRecordedAudioPath
              ? initialAudioPath
              : undefined))
      : undefined;

  const initialActive: Draft['activeAudioSource'] =
    editorMode === 'listItem'
      ? (initialActiveAudioSource ?? (seededDefaultAudioPath ? 'default' : null))
      : null;

  const initialAudioMode = initialActive ?? 'default';

  const [draft, setDraft] = useState<Draft>({
    ...INITIAL_DRAFT,
    audioMode: initialAudioMode,
    activeAudioSource: initialActive,
    profileCategoryId: initCategoryId ?? '',
    ...(initialLabel ? { labelEng: initialLabel } : {}),
    // folderImage / sentenceSlot keep the simpler image rehydration (always upload tab)
    ...((folderImageMode || editorMode === 'sentenceSlot') && initialImagePath
      ? { resolvedImagePath: initialImagePath, imageSourceTab: 'upload' as const }
      : {}),
    ...listItemImageSeed,
    ...(editorMode === 'listItem'
      ? {
          defaultAudioPath:   seededDefaultAudioPath,
          generatedAudioPath: initialGeneratedAudioPath,
          recordedAudioPath:  initialRecordedAudioPath,
        }
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

  // Shared search query — persists as the user jumps between SymbolStix,
  // Image Search and AI Generate tabs. Each tab still runs its own debounce
  // + results pipeline against this single source of truth. Resets when the
  // modal closes so it doesn't bleed into the next open.
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  // ── Convex ─────────────────────────────────────────────────────────────────

  const existingSymbol = useQuery(
    api.profileSymbols.getProfileSymbol,
    profileSymbolId ? { profileSymbolId } : 'skip'
  );

  const categories = useQuery(
    api.profileCategories.getProfileCategories,
    editorMode === 'categoryBoard' ? {} : 'skip'
  );

  const createProfileSymbol = useMutation(api.profileSymbols.createProfileSymbol);
  const updateProfileSymbol = useMutation(api.profileSymbols.updateProfileSymbol);

  // ── Pre-populate draft in edit mode ────────────────────────────────────────

  useEffect(() => {
    if (!existingSymbol) return;
    const ps = existingSymbol;

    // Map saved audio.eng to the active-source model.
    const eng = ps.audio?.eng;
    const defaultPath = ps.symbolRecord?.audio.eng.default;
    const activeSource: Draft['activeAudioSource'] =
      !eng ? (defaultPath ? 'default' : null) :
      eng.type === 'recorded' ? 'record' :
      eng.type === 'tts'      ? 'generate' : 'default';

    // Each source's path: prefer alternates; fall back to the active path if it matches.
    const generatedAudioPath =
      eng?.alternates?.generated ?? (eng?.type === 'tts' ? eng.path : undefined);
    const recordedAudioPath =
      eng?.alternates?.recorded  ?? (eng?.type === 'recorded' ? eng.path : undefined);

    setDraft({
      imageSourceTab:
        ps.imageSource.type === 'symbolstix' ? 'symbolstix' :
        ps.imageSource.type === 'userUpload' ? 'upload' :
        ps.imageSource.type === 'imageSearch' ? 'image-search' : 'ai-generate',
      symbolstixId: ps.imageSource.type === 'symbolstix' ? ps.imageSource.symbolId : undefined,
      symbolstixImagePath: ps.symbolRecord?.imagePath,
      symbolstixAudioEng: defaultPath,
      symbolstixAudioHin: ps.symbolRecord?.audio.hin?.default,
      resolvedImagePath:
        ps.imageSource.type !== 'symbolstix'
          ? (ps.imageSource as { imagePath: string }).imagePath
          : undefined,
      wikimediaSourceUrl:
        ps.imageSource.type === 'imageSearch'
          ? (ps.imageSource as { imageSourceUrl?: string }).imageSourceUrl
          : undefined,
      wikimediaAttribution:
        ps.imageSource.type === 'imageSearch'
          ? (ps.imageSource as { attribution?: string }).attribution
          : undefined,
      wikimediaLicense:
        ps.imageSource.type === 'imageSearch'
          ? (ps.imageSource as { license?: string }).license
          : undefined,
      labelEng: ps.label.eng,
      labelHin: ps.label.hin ?? '',
      audioMode: activeSource ?? 'default',
      activeAudioSource: activeSource,
      defaultAudioPath: defaultPath,
      generatedAudioPath,
      recordedAudioPath,
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

  // ── Auto-match bg/border to the category's palette (NEW symbols only) ──────
  //
  // For category-board new symbols we seed bgColour from the category's c100
  // (light tint) and borderColour from c500 (saturated), so a freshly added
  // symbol visually belongs to its parent category by default. If the admin
  // manually overrides either colour after this fires, it sticks — the effect
  // only re-runs when the picked category changes (tracked via a ref).
  //
  // Edit mode is intentionally exempt — the existing-symbol pre-populate
  // effect above already pulls saved colours and we don't want to clobber
  // them on open.
  const matchedCategoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEditMode) return;
    if (editorMode !== 'categoryBoard') return;
    if (!categories) return;
    const cid = draft.profileCategoryId;
    if (!cid) return;
    if (matchedCategoryRef.current === cid) return;

    const cat = categories.find((c) => c._id === cid);
    if (!cat) return;

    const pair = getCategoryColour(cat.colour);
    setDraft((d) => ({ ...d, bgColour: pair.c100, borderColour: pair.c500 }));
    matchedCategoryRef.current = cid;
  }, [isEditMode, editorMode, categories, draft.profileCategoryId]);

  // Reset the ref each time the modal closes, so reopening for a NEW symbol
  // re-applies the match cleanly (state is preserved across open/close cycles
  // in some parents).
  useEffect(() => {
    if (!isOpen) matchedCategoryRef.current = null;
  }, [isOpen]);

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

    if (draft.activeAudioSource === 'default' && draft.defaultAudioPath) {
      audioUrl = `/api/assets?key=${draft.defaultAudioPath}`;
    } else if (draft.activeAudioSource === 'generate' && draft.generatedAudioPath) {
      audioUrl = `/api/assets?key=${draft.generatedAudioPath}`;
    } else if (draft.activeAudioSource === 'record') {
      if (pendingAudioBlobUrl) audioUrl = pendingAudioBlobUrl;
      else if (draft.recordedAudioPath) audioUrl = `/api/assets?key=${draft.recordedAudioPath}`;
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
          const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
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

    // ── Sentence slot mode ────────────────────────────────────────────────
    if (editorMode === 'sentenceSlot') {
      setIsSaving(true);
      try {
        let imagePath: string | undefined = draft.resolvedImagePath;
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
        } else if (pendingImageBlob) {
          const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
        }
        const ts = draft.textSize;
        onSentenceSlotSave?.({
          imagePath,
          displayProps: {
            bgColour:   draft.bgColour,
            textColour: draft.textColour,
            textSize:   (ts === 'xl' ? 'lg' : ts) as 'sm' | 'md' | 'lg',
            showLabel:  draft.showLabel,
            showImage:  draft.showImage,
            cardShape:  draft.shape,
          },
        });
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
        // Resolve image and remember which tab it came from
        let imagePath: string | undefined = draft.resolvedImagePath;
        let imageSourceType: ListItemSaveResult['imageSourceType'] = initialImageSourceType;
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
          imageSourceType = 'symbolstix';
        } else if (pendingImageBlob) {
          const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
          imageSourceType =
            draft.imageSourceTab === 'image-search' ? 'imageSearch' :
            draft.imageSourceTab === 'ai-generate'  ? 'aiGenerated' : 'upload';
        }

        // Upload pending recording before save (only if record is the active source —
        // an in-flight blob the user didn't switch to is discarded on save).
        let recordedAudioPath = draft.recordedAudioPath;
        if (pendingAudioBlob && draft.activeAudioSource === 'record') {
          const ext = pendingAudioBlob.type.includes('ogg') ? 'ogg' : 'webm';
          const key = `accounts/${accountId}/audio/${crypto.randomUUID()}.${ext}`;
          await uploadBlobToR2(pendingAudioBlob, key);
          recordedAudioPath = key;
        }

        // Resolve the active audio path for runtime playback.
        const audioPath =
          draft.activeAudioSource === 'default'  ? draft.defaultAudioPath :
          draft.activeAudioSource === 'generate' ? draft.generatedAudioPath :
          draft.activeAudioSource === 'record'   ? recordedAudioPath :
          undefined;

        onListItemSave?.({
          imagePath,
          description: draft.labelEng.trim() || undefined,
          audioPath,
          activeAudioSource: draft.activeAudioSource ?? undefined,
          defaultAudioPath: draft.defaultAudioPath,
          generatedAudioPath: draft.generatedAudioPath,
          recordedAudioPath,
          imageSourceType,
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
      // 1. Upload pending image (upload tab, Image Search proxy, or AI Generate)
      let resolvedImagePath = draft.resolvedImagePath;
      if (pendingImageBlob && draft.imageSourceTab !== 'symbolstix') {
        const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
        await uploadBlobToR2(pendingImageBlob, key);
        resolvedImagePath = key;
      }

      // 2. Upload pending audio recording (only if record is the active source)
      let recordedAudioPath = draft.recordedAudioPath;
      if (pendingAudioBlob && draft.activeAudioSource === 'record') {
        const ext = pendingAudioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const key = `accounts/${accountId}/audio/${crypto.randomUUID()}.${ext}`;
        await uploadBlobToR2(pendingAudioBlob, key);
        recordedAudioPath = key;
      }

      // 3. Build imageSource
      type IS =
        | { type: 'symbolstix'; symbolId: Id<'symbols'> }
        | { type: 'userUpload'; imagePath: string }
        | { type: 'imageSearch'; imagePath: string; imageSourceUrl?: string; attribution?: string; license?: string }
        | { type: 'aiGenerated'; imagePath: string; aiPrompt?: string };

      const imageSource: IS =
        draft.imageSourceTab === 'symbolstix'
          ? { type: 'symbolstix', symbolId: draft.symbolstixId! }
          : draft.imageSourceTab === 'image-search'
          ? {
              type: 'imageSearch',
              imagePath: resolvedImagePath!,
              imageSourceUrl: draft.wikimediaSourceUrl,
              attribution: draft.wikimediaAttribution,
              license: draft.wikimediaLicense,
            }
          : draft.imageSourceTab === 'ai-generate'
          ? { type: 'aiGenerated', imagePath: resolvedImagePath! }
          : { type: 'userUpload', imagePath: resolvedImagePath! };

      // 4. Build audio override using the active-source model.
      // type encodes the active source ('r2'=default, 'tts'=generated, 'recorded'=recorded);
      // alternates carries the inactive ones so they survive a re-edit.
      type AR = {
        type: 'r2' | 'tts' | 'recorded';
        path: string;
        ttsText?: string;
        language?: string;
        alternates?: { default?: string; generated?: string; recorded?: string };
      };
      let audio: { eng?: AR; hin?: AR } | undefined;
      const activePath =
        draft.activeAudioSource === 'default'  ? draft.defaultAudioPath :
        draft.activeAudioSource === 'generate' ? draft.generatedAudioPath :
        draft.activeAudioSource === 'record'   ? recordedAudioPath :
        undefined;

      if (draft.activeAudioSource && activePath) {
        const activeType: AR['type'] =
          draft.activeAudioSource === 'generate' ? 'tts' :
          draft.activeAudioSource === 'record'   ? 'recorded' : 'r2';

        const alternates: AR['alternates'] = {
          ...(draft.activeAudioSource !== 'default'   && draft.defaultAudioPath   ? { default:   draft.defaultAudioPath   } : {}),
          ...(draft.activeAudioSource !== 'generate' && draft.generatedAudioPath ? { generated: draft.generatedAudioPath } : {}),
          ...(draft.activeAudioSource !== 'record'   && recordedAudioPath        ? { recorded:  recordedAudioPath        } : {}),
        };

        audio = {
          eng: {
            type: activeType,
            path: activePath,
            language: 'eng',
            ...(Object.keys(alternates).length ? { alternates } : {}),
          },
        };
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
    { value: 'image-search', label: t('tabImageSearch') },
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
    editorMode === 'sentenceSlot' ? t('titleSentenceSlot') :
    editorMode === 'listItem'     ? t('titleListItem') :
    isEditMode ? t('titleEdit') : t('titleCreate');

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
              <SymbolStixTab
                language={language}
                draft={draft}
                patch={patch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {draft.imageSourceTab === 'upload' && (
              <UploadTab
                draft={draft}
                patch={patch}
                pendingImagePreviewUrl={pendingImagePreviewUrl}
                onImageSelected={handleImageSelected}
              />
            )}
            {draft.imageSourceTab === 'image-search' && (
              <ImagesTab
                draft={draft}
                patch={patch}
                onImageSelected={handleImageSelected}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {draft.imageSourceTab === 'ai-generate' && (
              <AiGenerateTab
                draft={draft}
                patch={patch}
                onImageSelected={handleImageSelected}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
