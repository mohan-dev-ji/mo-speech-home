"use client";
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from 'convex/react';
import { useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/convex/_generated/api';
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { PhraseBuilderBody } from '@/app/components/app/shared/ui/composition/PhraseBuilderBody';
import { BlockEditControls } from '@/app/components/app/shared/ui/composition/BlockEditControls';
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
  // Audio-ready mirrors the legacy sentence indicator: a human recording, OR the
  // TTS clip for the CURRENT name+voice is already cached (so it stays in sync
  // with the text — a rename that isn't yet generated reads as "needs audio").
  const nameKey = nameStr.toLowerCase().trim();
  const audioAvail = useQuery(
    api.ttsCache.checkMany,
    nameKey ? { texts: [nameKey], voiceId } : 'skip'
  );
  // checkMany returns an array (Convex forbids non-ASCII object keys like Hindi text).
  const hasAudio =
    !!unit.recordedAudioPath ||
    audioAvail?.some((e) => e.text === nameKey && e.available) === true;
  const incomplete = unit.words.length < 1;

  function emit(updated: PhraseUnit) { onChange(sentenceId, unitIndex, updated); }

  function handleRename(v: string) {
    emit({ ...unit, name: { ...unit.name, [language]: v } });
  }
  function handleWordDelete(i: number) {
    emit({ ...unit, words: unit.words.filter((_, idx) => idx !== i).map((w, idx) => ({ ...w, order: idx })) });
  }
  function handleWordReorder(from: number, to: number) {
    emit({ ...unit, words: arrayMove(unit.words, from, to).map((w, idx) => ({ ...w, order: idx })) });
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
    <div ref={setNodeRef} style={style} className="shrink-0 w-fit min-w-0 sm:min-w-[280px] max-w-full">
      <PhraseBuilderBody
        name={nameStr}
        words={builderWords}
        hasAudio={hasAudio}
        incomplete={incomplete}
        audioReadyLabel={t('phraseAudioReady')}
        audioGenerateLabel={t('phraseAudioGenerate')}
        renameLabel={t('phraseRename')}
        addLabel={t('phraseAddSymbol')}
        removeLabel={t('phraseRemoveSymbol')}
        onRename={handleRename}
        onWordAdd={() => setWordEditor({ index: -1 })}
        onWordEdit={(i) => setWordEditor({ index: i })}
        onWordDelete={handleWordDelete}
        onWordReorder={handleWordReorder}
        onAudio={() => setAudioOpen(true)}
        controls={
          <BlockEditControls
            onDelete={() => onRemove(sentenceId, unitIndex)}
            deleteLabel={t('phraseDelete')}
            moveLabel={t('phraseMove')}
            dragProps={{ ...listeners, ...attributes }}
          />
        }
      />

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
