"use client";

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Square as StopIcon, Play, RefreshCw, Loader2 } from 'lucide-react';
import type { Doc } from '@/convex/_generated/dataModel';
import { AccordionSection } from './AccordionSection';
import type { Draft, AudioMode, TextSize, CardShape } from './types';

type Props = {
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
  language: string;
  categories: Doc<'profileCategories'>[] | undefined;
  pendingAudioBlobUrl: string | null;
  onAudioBlobChange: (blob: Blob | null, blobUrl: string | null) => void;
  editorMode: 'categoryBoard' | 'listItem' | 'sentenceSlot';
  voiceId: string;
};

const AUDIO_MODES_BOARD: AudioMode[] = ['default', 'generate', 'record'];
const AUDIO_MODES_LIST: AudioMode[] = ['default', 'generate', 'record'];
const TEXT_SIZES: TextSize[] = ['sm', 'md', 'lg'];
const SHAPES: CardShape[] = ['square', 'rounded', 'circle'];

const COLOUR_FIELDS: { key: keyof Draft; labelKey: string }[] = [
  { key: 'bgColour', labelKey: 'displayBgColour' },
  { key: 'textColour', labelKey: 'displayTextColour' },
  { key: 'borderColour', labelKey: 'displayBorderColour' },
];

export function PropertiesPanel({
  draft,
  patch,
  language,
  categories,
  pendingAudioBlobUrl,
  onAudioBlobChange,
  editorMode,
  voiceId,
}: Props) {
  const t = useTranslations('symbolEditor');

  // Audio is open by default so non-SymbolStix flows (uploads, AI gen, image
  // search) make it visually obvious there's no audio yet.
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['label', 'audio', 'category'])
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<'symbolstix' | 'cache' | 'generated' | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const ttsPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      ttsPreviewAudioRef.current?.pause();
    };
  }, []);

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Recording ───────────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
        const url = URL.createObjectURL(blob);
        audioBlobUrlRef.current = url;
        onAudioBlobChange(blob, url);
        patch({ activeAudioSource: 'record' });
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // microphone permission denied
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function discardRecording() {
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    audioBlobUrlRef.current = null;
    onAudioBlobChange(null, null);
    patch({
      recordedAudioPath: undefined,
      // Flip back to default if available, else clear active.
      activeAudioSource: draft.defaultAudioPath ? 'default' : null,
    });
  }

  // ── Generate TTS ────────────────────────────────────────────────────────────

  async function handleGenerate() {
    const text = draft.labelEng.trim();
    if (!text) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const body = await res.json(); detail = body.error ?? detail; } catch { /* ignore */ }
        throw new Error(detail);
      }
      const { r2Key, source } = (await res.json()) as { r2Key: string; cached: boolean; source: 'symbolstix' | 'cache' | 'generated' };
      patch({ generatedAudioPath: r2Key, activeAudioSource: 'generate' });
      setAudioSource(source);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : t('audioGenerateError'));
    } finally {
      setIsGenerating(false);
    }
  }

  function playTtsPreview() {
    if (!draft.generatedAudioPath) return;
    ttsPreviewAudioRef.current?.pause();
    const audio = new Audio(`/api/assets?key=${draft.generatedAudioPath}`);
    ttsPreviewAudioRef.current = audio;
    audio.play().catch(() => {});
  }

  // ── Active-audio helpers ────────────────────────────────────────────────────

  function activeAudioUrl(): string | null {
    if (draft.activeAudioSource === 'default' && draft.defaultAudioPath) {
      return `/api/assets?key=${draft.defaultAudioPath}`;
    }
    if (draft.activeAudioSource === 'generate' && draft.generatedAudioPath) {
      return `/api/assets?key=${draft.generatedAudioPath}`;
    }
    if (draft.activeAudioSource === 'record') {
      if (pendingAudioBlobUrl) return pendingAudioBlobUrl;
      if (draft.recordedAudioPath) return `/api/assets?key=${draft.recordedAudioPath}`;
    }
    return null;
  }

  function playActiveAudio() {
    const url = activeAudioUrl();
    if (!url) return;
    ttsPreviewAudioRef.current?.pause();
    const audio = new Audio(url);
    ttsPreviewAudioRef.current = audio;
    audio.play().catch(() => {});
  }

  const statusLabelKey =
    draft.activeAudioSource === 'default'  ? 'audioStatusDefault'   :
    draft.activeAudioSource === 'generate' ? 'audioStatusGenerated' :
    draft.activeAudioSource === 'record'   ? 'audioStatusRecorded'  :
    'audioStatusNone';

  // ── Labels ──────────────────────────────────────────────────────────────────

  const audioModes = editorMode === 'listItem' ? AUDIO_MODES_LIST : AUDIO_MODES_BOARD;

  const audioModeLabel: Record<AudioMode, string> = {
    default: t('audioDefault'),
    record: t('audioRecord'),
    generate: t('audioGenerate'),
  };

  const textSizeLabel: Record<TextSize, string> = {
    sm: t('textSizeSm'),
    md: t('textSizeMd'),
    lg: t('textSizeLg'),
    xl: 'XL',
  };

  const shapeLabel: Record<CardShape, string> = {
    square: t('shapeSquare'),
    rounded: t('shapeRounded'),
    circle: t('shapeCircle'),
  };

  const labelSectionTitle = editorMode === 'listItem' ? t('sectionDescription') : t('sectionLabel');
  const labelFieldTitle = editorMode === 'listItem' ? t('sectionDescription') : t('labelEng');

  return (
    <div className="flex-1 overflow-y-auto" style={{ borderTop: '1px solid var(--theme-button-highlight)' }}>

      {/* ── Label / Description — hidden for sentenceSlot ─────────────────── */}
      {editorMode !== 'sentenceSlot' && <AccordionSection
        label={labelSectionTitle}
        isOpen={openSections.has('label')}
        onToggle={() => toggleSection('label')}
      >
        <label className="flex flex-col gap-1">
          <span className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
            {labelFieldTitle}
          </span>
          <input
            type="text"
            value={draft.labelEng}
            onChange={(e) => patch({ labelEng: e.target.value })}
            placeholder={editorMode === 'listItem' ? t('descriptionPlaceholder') : t('labelPlaceholder')}
            className="w-full rounded-theme-sm px-3 py-2 text-theme-s outline-none"
            style={{
              background: 'var(--theme-symbol-bg)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-button-highlight)',
            }}
          />
        </label>
        {editorMode === 'categoryBoard' && language === 'hin' && (
          <label className="flex flex-col gap-1">
            <span className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
              {t('labelHin')}
            </span>
            <input
              type="text"
              value={draft.labelHin}
              onChange={(e) => patch({ labelHin: e.target.value })}
              placeholder={t('labelPlaceholder')}
              className="w-full rounded-theme-sm px-3 py-2 text-theme-s outline-none"
              style={{
                background: 'var(--theme-symbol-bg)',
                color: 'var(--theme-text)',
                border: '1px solid var(--theme-button-highlight)',
              }}
            />
          </label>
        )}
      </AccordionSection>}

      {/* ── Audio — hidden for sentenceSlot ───────────────────────────────── */}
      {editorMode !== 'sentenceSlot' && <AccordionSection
        label={t('sectionAudio')}
        isOpen={openSections.has('audio')}
        onToggle={() => toggleSection('audio')}
      >
        {/* Status banner — shows which audio is currently active */}
        <div
          className="flex items-center gap-2 rounded-theme-sm px-2.5 py-2"
          style={{
            background: 'var(--theme-symbol-bg)',
            border: '1px solid var(--theme-button-highlight)',
          }}
        >
          <button
            type="button"
            onClick={playActiveAudio}
            disabled={!activeAudioUrl()}
            aria-label={t('audioPlay')}
            className="flex items-center justify-center w-8 h-8 rounded-theme-sm shrink-0"
            style={{
              background: 'var(--theme-brand-primary)',
              color: 'var(--theme-alt-text)',
              opacity: activeAudioUrl() ? 1 : 0.4,
            }}
          >
            <Play className="w-4 h-4" />
          </button>
          <span className="text-theme-xs" style={{ color: 'var(--theme-text)' }}>
            {t(statusLabelKey as Parameters<typeof t>[0])}
          </span>
        </div>

        {/* Segmented control — purely tab navigation, doesn't affect activeAudioSource */}
        <div
          className="flex rounded-theme-sm overflow-hidden p-0.5 gap-0.5"
          style={{ background: 'var(--theme-button-highlight)' }}
        >
          {audioModes.map((mode) => {
            const isActive = draft.audioMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => patch({ audioMode: mode })}
                className="flex-1 py-1.5 rounded text-theme-xs font-medium transition-colors"
                style={{
                  background: isActive ? 'var(--theme-brand-primary)' : 'transparent',
                  color: isActive ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                }}
              >
                {audioModeLabel[mode]}
              </button>
            );
          })}
        </div>

        {/* Default */}
        {draft.audioMode === 'default' && (
          <div className="flex flex-col gap-2">
            <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
              {t('audioDefaultHint')}
            </p>
            {draft.defaultAudioPath && draft.activeAudioSource !== 'default' && (
              <button
                type="button"
                onClick={() => patch({ activeAudioSource: 'default' })}
                className="flex items-center justify-center gap-1.5 rounded-theme-sm py-2 text-theme-s font-medium"
                style={{
                  background: 'var(--theme-symbol-bg)',
                  color: 'var(--theme-text)',
                  border: '1px solid var(--theme-button-highlight)',
                }}
              >
                {t('audioUseDefault')}
              </button>
            )}
          </div>
        )}

        {/* Generate */}
        {draft.audioMode === 'generate' && (
          <div className="flex flex-col gap-2">
            {!draft.generatedAudioPath ? (
              <>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || !draft.labelEng.trim()}
                  className="flex items-center justify-center gap-2 rounded-theme-sm py-2.5 text-theme-s font-semibold"
                  style={{
                    background: 'var(--theme-brand-primary)',
                    color: 'var(--theme-alt-text)',
                    opacity: (isGenerating || !draft.labelEng.trim()) ? 0.55 : 1,
                  }}
                >
                  {isGenerating
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{t('audioGenerating')}</>
                    : t('audioGenerateButton')
                  }
                </button>
                {!draft.labelEng.trim() && (
                  <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                    {t('audioGenerateNeedsLabel')}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={playTtsPreview}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-theme-sm py-2 text-theme-s font-medium"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid var(--theme-button-highlight)',
                    }}
                  >
                    <Play className="w-3.5 h-3.5" />{t('audioGeneratePlay')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { patch({ generatedAudioPath: undefined }); setAudioSource(null); handleGenerate(); }}
                    disabled={isGenerating}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-theme-sm py-2 text-theme-s font-medium"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid var(--theme-button-highlight)',
                      opacity: isGenerating ? 0.55 : 1,
                    }}
                  >
                    {isGenerating
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />
                    }
                    {t('audioGenerateRegenerate')}
                  </button>
                </div>
                {draft.activeAudioSource !== 'generate' && (
                  <button
                    type="button"
                    onClick={() => patch({ activeAudioSource: 'generate' })}
                    className="flex items-center justify-center gap-1.5 rounded-theme-sm py-2 text-theme-s font-medium"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid var(--theme-button-highlight)',
                    }}
                  >
                    {t('audioUseGenerated')}
                  </button>
                )}
              </>
            )}
            {audioSource && (
              <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                {audioSource === 'symbolstix' && '✓ From SymbolStix library'}
                {audioSource === 'cache' && '✓ Found in TTS cache'}
                {audioSource === 'generated' && '✓ Newly generated'}
              </p>
            )}
            {generateError && (
              <p className="text-theme-xs" style={{ color: 'var(--theme-warning)' }}>
                {generateError}
              </p>
            )}
          </div>
        )}

        {/* Record */}
        {draft.audioMode === 'record' && (
          <div className="flex flex-col gap-2">
            {!(pendingAudioBlobUrl || draft.recordedAudioPath) ? (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className="flex items-center justify-center gap-2 rounded-theme-sm py-2.5 text-theme-s font-semibold"
                style={{
                  background: isRecording ? 'var(--theme-warning)' : 'var(--theme-brand-primary)',
                  color: 'var(--theme-alt-text)',
                }}
              >
                {isRecording
                  ? <><StopIcon className="w-4 h-4" />{t('audioRecordStop')}</>
                  : <><Mic className="w-4 h-4" />{t('audioRecordStart')}</>
                }
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = pendingAudioBlobUrl
                        ?? (draft.recordedAudioPath ? `/api/assets?key=${draft.recordedAudioPath}` : null);
                      if (!url) return;
                      const a = new Audio(url);
                      a.play().catch(() => {});
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-theme-sm py-2 text-theme-s font-medium"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid var(--theme-button-highlight)',
                    }}
                  >
                    <Play className="w-3.5 h-3.5" />{t('audioRecordPlayback')}
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    className="flex-1 flex items-center justify-center rounded-theme-sm py-2 text-theme-s font-medium"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-warning)',
                      border: '1px solid var(--theme-button-highlight)',
                    }}
                  >
                    {t('audioRecordDiscard')}
                  </button>
                </div>
                {draft.activeAudioSource !== 'record' && (
                  <button
                    type="button"
                    onClick={() => patch({ activeAudioSource: 'record' })}
                    className="flex items-center justify-center gap-1.5 rounded-theme-sm py-2 text-theme-s font-medium"
                    style={{
                      background: 'var(--theme-symbol-bg)',
                      color: 'var(--theme-text)',
                      border: '1px solid var(--theme-button-highlight)',
                    }}
                  >
                    {t('audioUseRecorded')}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </AccordionSection>}

      {/* ── Display (categoryBoard + sentenceSlot) ────────────────────────── */}
      {(editorMode === 'categoryBoard' || editorMode === 'sentenceSlot') && (
        <AccordionSection
          label={t('sectionDisplay')}
          isOpen={openSections.has('display')}
          onToggle={() => toggleSection('display')}
        >
          <div className="grid grid-cols-2 gap-3">
            {COLOUR_FIELDS.map(({ key, labelKey }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                  {t(labelKey as Parameters<typeof t>[0])}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft[key] as string}
                    onChange={(e) => patch({ [key]: e.target.value })}
                    className="w-7 h-7 rounded-theme-sm cursor-pointer border-0 p-0"
                  />
                  <span className="text-theme-xs font-mono" style={{ color: 'var(--theme-secondary-text)' }}>
                    {draft[key] as string}
                  </span>
                </div>
              </label>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                {t('displayBorderWidth')}
              </span>
              <input
                type="number"
                min={0}
                max={8}
                value={draft.borderWidth}
                onChange={(e) => patch({ borderWidth: Number(e.target.value) })}
                className="w-full rounded-theme-sm px-3 py-1.5 text-theme-s outline-none"
                style={{
                  background: 'var(--theme-symbol-bg)',
                  color: 'var(--theme-text)',
                  border: '1px solid var(--theme-button-highlight)',
                }}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => patch({ showLabel: !draft.showLabel })}
              className="flex-1 py-2 rounded-theme-sm text-theme-xs font-medium"
              style={{
                background: draft.showLabel ? 'var(--theme-brand-primary)' : 'var(--theme-symbol-bg)',
                color: draft.showLabel ? 'var(--theme-alt-text)' : 'var(--theme-secondary-text)',
                border: draft.showLabel ? 'none' : '1px solid var(--theme-button-highlight)',
              }}
            >
              {draft.showLabel ? t('displayShowLabel') : t('displayHideLabel')}
            </button>
            <button
              type="button"
              onClick={() => patch({ showImage: !draft.showImage })}
              className="flex-1 py-2 rounded-theme-sm text-theme-xs font-medium"
              style={{
                background: draft.showImage ? 'var(--theme-brand-primary)' : 'var(--theme-symbol-bg)',
                color: draft.showImage ? 'var(--theme-alt-text)' : 'var(--theme-secondary-text)',
                border: draft.showImage ? 'none' : '1px solid var(--theme-button-highlight)',
              }}
            >
              {draft.showImage ? t('displayShowImage') : t('displayHideImage')}
            </button>
          </div>
        </AccordionSection>
      )}

      {/* ── Text size (categoryBoard + sentenceSlot) ─────────────────────── */}
      {(editorMode === 'categoryBoard' || editorMode === 'sentenceSlot') && (
        <AccordionSection
          label={t('sectionText')}
          isOpen={openSections.has('text')}
          onToggle={() => toggleSection('text')}
        >
          <div
            className="flex rounded-theme-sm overflow-hidden p-0.5 gap-0.5"
            style={{ background: 'var(--theme-button-highlight)' }}
          >
            {TEXT_SIZES.map((size) => {
              const isActive = draft.textSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => patch({ textSize: size })}
                  className="flex-1 py-1.5 rounded text-theme-s font-medium"
                  style={{
                    background: isActive ? 'var(--theme-brand-primary)' : 'transparent',
                    color: isActive ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                  }}
                >
                  {textSizeLabel[size]}
                </button>
              );
            })}
          </div>
        </AccordionSection>
      )}

      {/* ── Shape (categoryBoard + sentenceSlot) ─────────────────────────── */}
      {(editorMode === 'categoryBoard' || editorMode === 'sentenceSlot') && (
        <AccordionSection
          label={t('sectionShape')}
          isOpen={openSections.has('shape')}
          onToggle={() => toggleSection('shape')}
        >
          <div
            className="flex rounded-theme-sm overflow-hidden p-0.5 gap-0.5"
            style={{ background: 'var(--theme-button-highlight)' }}
          >
            {SHAPES.map((s) => {
              const isActive = draft.shape === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ shape: s })}
                  className="flex-1 py-1.5 rounded text-theme-s font-medium"
                  style={{
                    background: isActive ? 'var(--theme-brand-primary)' : 'transparent',
                    color: isActive ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                  }}
                >
                  {shapeLabel[s]}
                </button>
              );
            })}
          </div>
        </AccordionSection>
      )}

      {/* ── Category (categoryBoard only) ─────────────────────────────────── */}
      {editorMode === 'categoryBoard' && (
        <AccordionSection
          label={t('sectionCategory')}
          isOpen={openSections.has('category')}
          onToggle={() => toggleSection('category')}
        >
          <select
            value={draft.profileCategoryId}
            onChange={(e) => patch({ profileCategoryId: e.target.value as Draft['profileCategoryId'] })}
            className="w-full rounded-theme-sm px-3 py-2 text-theme-s outline-none"
            style={{
              background: 'var(--theme-symbol-bg)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-button-highlight)',
            }}
          >
            <option value="" disabled>{t('categoryPlaceholder')}</option>
            {categories?.map((cat) => {
              const name = language === 'hin' && cat.name.hin ? cat.name.hin : cat.name.eng;
              return <option key={cat._id} value={cat._id}>{name}</option>;
            })}
          </select>
        </AccordionSection>
      )}

    </div>
  );
}
