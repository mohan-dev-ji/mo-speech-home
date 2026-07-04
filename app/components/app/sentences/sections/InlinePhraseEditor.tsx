"use client";
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Move } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { PhraseBuilderBody } from '@/app/components/app/shared/ui/composition/PhraseBuilderBody';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import type { SentenceSlotSaveResult } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import { SentenceAudioModal } from '@/app/components/app/sentences/modals/SentenceAudioModal';
import type { CompositionUnitClient } from '@/app/components/app/shared/ui/composition/blocks';
import type { Id } from '@/convex/_generated/dataModel';

type PhraseUnit = Extract<CompositionUnitClient, { kind: 'phrase' }>;

// Edit a phrase snapshot INLINE inside the sentence edit strip (ADR-015). Renders
// the dropbar's PhraseBuilderBody directly (no wrapping modal), so the only modal
// that ever opens is the single-level word editor / audio editor — no stacking.
// Every edit persists immediately via onChange (save-instantly), local to this
// sentence's snapshot. A drag handle + trash mirror the dropbar's phrase card.
export function InlinePhraseEditor({
  id, unit, unitIndex, sentenceId, onChange, onRemove,
}: {
  id: string;
  unit: PhraseUnit;
  unitIndex: number;
  sentenceId: Id<'profileSentences'>;
  onChange: (sentenceId: Id<'profileSentences'>, unitIndex: number, updated: PhraseUnit) => void;
  onRemove: (sentenceId: Id<'profileSentences'>, unitIndex: number) => void;
}) {
  const t = useTranslations('talker');
  const { language, accountId, voiceId } = useProfile();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const [wordEditor, setWordEditor] = useState<{ index: number } | null>(null);   // -1 = append
  const [audioOpen, setAudioOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const nameStr = displayString(unit.name, language, DEFAULT_LOCALE);
  const builderWords = unit.words.map((w) => ({
    imagePath: w.imagePath,
    label: displayString(w.label ?? {}, language, DEFAULT_LOCALE),
  }));
  const hasAudio = !!(unit.recordedAudioPath ?? unit.audioPath);
  const incomplete = unit.words.length < 2;

  function emit(updated: PhraseUnit) { onChange(sentenceId, unitIndex, updated); }

  function handleRename(v: string) {
    emit({ ...unit, name: { ...unit.name, [language]: v } });
  }
  function handleWordDelete(i: number) {
    emit({ ...unit, words: unit.words.filter((_, idx) => idx !== i).map((w, idx) => ({ ...w, order: idx })) });
  }
  function handleWordSave(result: SentenceSlotSaveResult) {
    if (!wordEditor) return;
    const words = [...unit.words];
    if (wordEditor.index === -1) {
      words.push({ order: words.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
    } else if (words[wordEditor.index]) {
      words[wordEditor.index] = { ...words[wordEditor.index], imagePath: result.imagePath, displayProps: result.displayProps };
    }
    emit({ ...unit, words: words.map((w, idx) => ({ ...w, order: idx })) });
    setWordEditor(null);
  }
  // Keep-audio-modal: opens a single-level audio editor. A new recording wins; if
  // none remains and the name changed, drop the stale TTS clip so playback
  // re-resolves TTS from the new name.
  async function handleAudioSave(payload: { text: string; recordedAudioPath?: string | null }) {
    const next: PhraseUnit = { ...unit };
    if (payload.text) next.name = { ...unit.name, [language]: payload.text };
    if (typeof payload.recordedAudioPath === 'string') next.recordedAudioPath = payload.recordedAudioPath;
    else if (payload.recordedAudioPath === null) next.recordedAudioPath = undefined;
    if (!next.recordedAudioPath) next.audioPath = undefined;
    emit(next);
  }

  const existingWordImagePath =
    wordEditor && wordEditor.index >= 0 ? unit.words[wordEditor.index]?.imagePath : undefined;

  return (
    <div ref={setNodeRef} style={style} className="shrink-0 w-fit min-w-[280px] max-w-full flex flex-col gap-2">
      <PhraseBuilderBody
        name={nameStr}
        words={builderWords}
        hasAudio={hasAudio}
        incomplete={incomplete}
        incompleteLabel={t('phraseNeedsTwo')}
        audioReadyLabel={t('phraseAudioReady')}
        audioGenerateLabel={t('phraseAudioGenerate')}
        renameLabel={t('phraseRename')}
        addLabel={t('phraseAddSymbol')}
        removeLabel={t('phraseRemoveSymbol')}
        onRename={handleRename}
        onWordAdd={() => setWordEditor({ index: -1 })}
        onWordEdit={(i) => setWordEditor({ index: i })}
        onWordDelete={handleWordDelete}
        onAudio={() => setAudioOpen(true)}
      />

      {/* Below-body controls: remove the phrase unit + drag-reorder handle. Drag
          listeners live ONLY on the handle so the builder's inputs stay usable. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRemove(sentenceId, unitIndex)}
          aria-label={t('phraseDelete')}
          className="w-8 h-8 rounded-theme-sm flex items-center justify-center border border-theme-line"
          style={{ color: 'var(--theme-warning)' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label={t('phraseMove')}
          className="w-8 h-8 rounded-theme-sm flex items-center justify-center border border-theme-line cursor-grab active:cursor-grabbing touch-none"
          style={{ color: 'var(--theme-nav-text)' }}
          {...listeners}
          {...attributes}
        >
          <Move className="w-4 h-4" />
        </button>
      </div>

      {/* Word editor — image-only (sentenceSlot); the phrase plays as one clip. */}
      {wordEditor && accountId && (
        <SymbolEditorModal
          isOpen
          accountId={accountId}
          language={language}
          voiceId={voiceId}
          editorMode="sentenceSlot"
          initialImagePath={existingWordImagePath}
          onClose={() => setWordEditor(null)}
          onSave={() => {}}
          onSentenceSlotSave={handleWordSave}
        />
      )}

      {/* Phrase audio — reuses the sentence audio modal via saveOverride. */}
      {audioOpen && accountId && (
        <SentenceAudioModal
          isOpen
          sentenceId={null}
          accountId={accountId}
          initialValue={nameStr}
          title={t('phraseEditTitle')}
          fieldLabel={t('phraseFieldLabel')}
          onClose={() => setAudioOpen(false)}
          saveOverride={handleAudioSave}
        />
      )}
    </div>
  );
}
