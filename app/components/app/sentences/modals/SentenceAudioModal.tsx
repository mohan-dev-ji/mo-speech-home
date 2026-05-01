"use client";

import { useState, useRef, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Loader2, Mic, Play, RefreshCw, Square as StopIcon, Trash2, Volume2 } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { DEFAULT_VOICE_ID } from '@/lib/r2-paths';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/app/shared/ui/Dialog';

type Props = {
  isOpen: boolean;
  sentenceId: Id<'profileSentences'> | null;
  accountId: Id<'users'>;
  initialValue?: string;   // single sentence field — used as both display name and TTS text
  initialAudioPath?: string;
  onClose: () => void;
};

async function uploadBlobToR2(blob: Blob, key: string): Promise<void> {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('key', key);
  const res = await fetch('/api/upload-asset', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
}

export function SentenceAudioModal({
  isOpen,
  sentenceId,
  accountId,
  initialValue = '',
  initialAudioPath,
  onClose,
}: Props) {
  const t = useTranslations('sentences');
  const updateAudio    = useMutation(api.profileSentences.updateProfileSentenceAudio);
  const renameSentence = useMutation(api.profileSentences.updateProfileSentenceName);

  const [value, setValue] = useState(initialValue);
  const [ttsKey, setTtsKey] = useState<string | undefined>(initialAudioPath);
  const [ttsSource, setTtsSource] = useState<'cache' | 'generated' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Reset state when opening for a different sentence
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTtsKey(initialAudioPath);
      setTtsSource(null);
      setGenerateError(null);
      setRecordedBlobUrl(null);
      setRecordedBlob(null);
    }
  }, [isOpen, initialValue, initialAudioPath]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleGenerate() {
    if (!value.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value.trim(), voiceId: DEFAULT_VOICE_ID }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `${res.status}`);
      }
      const { r2Key, source } = (await res.json()) as { r2Key: string; source: string };
      setTtsKey(r2Key);
      setTtsSource(source === 'generated' ? 'generated' : 'cache');
      setRecordedBlobUrl(null);
      setRecordedBlob(null);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : t('audioModalGenerateError'));
    } finally {
      setIsGenerating(false);
    }
  }

  function playTts() {
    if (!ttsKey) return;
    new Audio(`/api/assets?key=${ttsKey}`).play().catch(() => {});
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setRecordedBlob(blob);
        setRecordedBlobUrl(url);
        setTtsKey(undefined);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // microphone denied
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function discardRecording() {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setRecordedBlob(null);
    setRecordedBlobUrl(null);
  }

  async function handleSave() {
    if (!sentenceId) return;
    setIsSaving(true);
    try {
      let audioPath: string | undefined = ttsKey;
      if (recordedBlob) {
        const ext = recordedBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const key = `accounts/${accountId}/audio/${crypto.randomUUID()}.${ext}`;
        await uploadBlobToR2(recordedBlob, key);
        audioPath = key;
      }
      const trimmedValue = value.trim();
      if (trimmedValue) {
        await renameSentence({ profileSentenceId: sentenceId, name: { eng: trimmedValue } });
      }
      await updateAudio({ profileSentenceId: sentenceId, text: trimmedValue || undefined, audioPath });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  const canSave = !!value.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('editModalTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">

          {/* Single sentence field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
              {t('editModalSentenceLabel')}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('editModalSentencePlaceholder')}
              autoFocus
              className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
              style={{
                background: 'var(--theme-symbol-bg)',
                color: 'var(--theme-text)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          </div>

          {/* TTS generate */}
          <div className="flex flex-col gap-2">
            {!ttsKey ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !value.trim()}
                className="flex items-center justify-center gap-2 py-2.5 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
                style={{ background: 'var(--theme-brand-primary)', color: 'var(--theme-alt-text)' }}
              >
                {isGenerating
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{t('audioModalGenerating')}</>
                  : t('audioModalGenerate')
                }
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={playTts}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-theme-sm text-theme-s font-medium"
                  style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)', border: '1px solid var(--theme-button-highlight)' }}
                >
                  <Volume2 className="w-3.5 h-3.5" />{t('audioModalPlay')}
                </button>
                <button
                  type="button"
                  onClick={() => { setTtsKey(undefined); setTtsSource(null); handleGenerate(); }}
                  disabled={isGenerating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-theme-sm text-theme-s font-medium disabled:opacity-50"
                  style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)', border: '1px solid var(--theme-button-highlight)' }}
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {t('audioModalRegenerate')}
                </button>
              </div>
            )}
            {ttsSource && (
              <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                {ttsSource === 'cache' ? t('audioModalCacheHit') : t('audioModalGenerated')}
              </p>
            )}
            {generateError && (
              <p className="text-theme-xs" style={{ color: 'var(--theme-warning)' }}>{generateError}</p>
            )}
            {!value.trim() && (
              <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                {t('audioModalNoText')}
              </p>
            )}
          </div>

          {/* Record */}
          <div className="flex flex-col gap-2">
            {!recordedBlobUrl ? (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className="flex items-center justify-center gap-2 py-2.5 rounded-theme-sm text-theme-s font-semibold"
                style={{
                  background: isRecording ? 'var(--theme-warning)' : 'var(--theme-symbol-bg)',
                  color: isRecording ? '#fff' : 'var(--theme-text)',
                  border: isRecording ? 'none' : '1px solid var(--theme-button-highlight)',
                }}
              >
                {isRecording
                  ? <><StopIcon className="w-4 h-4" />{t('audioModalRecordStop')}</>
                  : <><Mic className="w-4 h-4" />{t('audioModalRecord')}</>
                }
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { new Audio(recordedBlobUrl).play().catch(() => {}); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-theme-sm text-theme-s font-medium"
                  style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)', border: '1px solid var(--theme-button-highlight)' }}
                >
                  <Play className="w-3.5 h-3.5" />{t('audioModalRecordPlay')}
                </button>
                <button
                  type="button"
                  onClick={discardRecording}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-theme-sm text-theme-s font-medium"
                  style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-warning)', border: '1px solid var(--theme-button-highlight)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />{t('audioModalRecordDiscard')}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
            >
              {t('audioModalCancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="py-3 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: '#16a34a', color: '#fff' }}
            >
              {isSaving ? t('audioModalSaving') : t('audioModalSave')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
