"use client";

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Mic, Square as StopIcon, Play } from 'lucide-react';
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
};

const AUDIO_MODES: AudioMode[] = ['default', 'record', 'choose-word', 'generate'];
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
}: Props) {
  const t = useTranslations('symbolEditor');

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['label', 'category'])
  );
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

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
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // microphone permission denied — no-op
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
  }

  const audioModeLabel: Record<AudioMode, string> = {
    default: t('audioDefault'),
    record: t('audioRecord'),
    'choose-word': t('audioChooseWord'),
    generate: t('audioGenerate'),
  };

  const textSizeLabel: Record<TextSize, string> = {
    sm: t('textSizeSm'),
    md: t('textSizeMd'),
    lg: t('textSizeLg'),
  };

  const shapeLabel: Record<CardShape, string> = {
    square: t('shapeSquare'),
    rounded: t('shapeRounded'),
    circle: t('shapeCircle'),
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ borderTop: '1px solid var(--theme-button-highlight)' }}>

      {/* ── Label ─────────────────────────────────────────────────────────── */}
      <AccordionSection
        label={t('sectionLabel')}
        isOpen={openSections.has('label')}
        onToggle={() => toggleSection('label')}
      >
        <label className="flex flex-col gap-1">
          <span className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
            {t('labelEng')}
          </span>
          <input
            type="text"
            value={draft.labelEng}
            onChange={(e) => patch({ labelEng: e.target.value })}
            placeholder={t('labelPlaceholder')}
            className="w-full rounded-theme-sm px-3 py-2 text-theme-s outline-none"
            style={{
              background: 'var(--theme-symbol-bg)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-button-highlight)',
            }}
          />
        </label>
        {language === 'hin' && (
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
      </AccordionSection>

      {/* ── Audio ─────────────────────────────────────────────────────────── */}
      <AccordionSection
        label={t('sectionAudio')}
        isOpen={openSections.has('audio')}
        onToggle={() => toggleSection('audio')}
      >
        {/* Segmented control */}
        <div
          className="flex rounded-theme-sm overflow-hidden p-0.5 gap-0.5"
          style={{ background: 'var(--theme-button-highlight)' }}
        >
          {AUDIO_MODES.map((mode) => {
            const isActive = draft.audioMode === mode;
            const isDisabled = mode === 'choose-word' || mode === 'generate';
            return (
              <button
                key={mode}
                type="button"
                disabled={isDisabled}
                onClick={() => patch({ audioMode: mode })}
                className="flex-1 py-1.5 rounded text-theme-xs font-medium transition-colors"
                style={{
                  background: isActive ? 'var(--theme-brand-primary)' : 'transparent',
                  color: isActive ? 'var(--theme-alt-text)' : 'var(--theme-text)',
                  opacity: isDisabled ? 0.35 : 1,
                }}
              >
                {audioModeLabel[mode]}
              </button>
            );
          })}
        </div>

        {draft.audioMode === 'default' && (
          <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
            {t('audioDefaultHint')}
          </p>
        )}
        {draft.audioMode === 'choose-word' && (
          <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
            {t('audioChooseWordComingSoon')}
          </p>
        )}
        {draft.audioMode === 'generate' && (
          <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
            {t('audioGenerateComingSoon')}
          </p>
        )}

        {draft.audioMode === 'record' && (
          <>
            {!pendingAudioBlobUrl ? (
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { const a = new Audio(pendingAudioBlobUrl); a.play(); }}
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
            )}
          </>
        )}
      </AccordionSection>

      {/* ── Display ───────────────────────────────────────────────────────── */}
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

      {/* ── Text size ─────────────────────────────────────────────────────── */}
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

      {/* ── Shape ─────────────────────────────────────────────────────────── */}
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

      {/* ── Category ──────────────────────────────────────────────────────── */}
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

    </div>
  );
}
