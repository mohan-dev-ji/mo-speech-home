"use client";
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Id } from '@/convex/_generated/dataModel';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { PhraseBuilderBody } from '@/app/components/app/shared/ui/composition/PhraseBuilderBody';
import { SymbolEditorModal } from '@/app/components/app/shared/modals/symbol-editor';
import type { SentenceSlotSaveResult } from '@/app/components/app/shared/modals/symbol-editor/SymbolEditorModal';
import { SentenceAudioModal } from '@/app/components/app/sentences/modals/SentenceAudioModal';
import type { CompositionUnitClient } from '@/app/components/app/shared/ui/composition/blocks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/app/components/app/shared/ui/Dialog';

// Narrow to the phrase branch of the unit union.
type PhraseUnit = Extract<CompositionUnitClient, { kind: 'phrase' }>;
type PhraseWord = PhraseUnit['words'][number];

// Edit a phrase snapshot IN PLACE (local to one sentence — ADR-015). Reuses the
// dropbar's PhraseBuilderBody + the same word/audio sub-editors, but all edits
// stay in local state until Save, which hands the rebuilt unit back to the host
// to persist via updateProfileSentenceUnits. Never touches the phrase bank.
export function PhraseUnitEditorModal({
  isOpen, unit, language, accountId, voiceId, onSave, onClose,
}: {
  isOpen: boolean;
  unit: PhraseUnit;
  language: string;
  accountId: Id<'users'>;
  voiceId: string;
  onSave: (updated: PhraseUnit) => void;
  onClose: () => void;
}) {
  const t = useTranslations('sentences');
  const tTalker = useTranslations('talker');

  // Local editable copy, reseeded whenever a different phrase opens.
  const [name, setName] = useState<Record<string, string>>(unit.name);
  const [words, setWords] = useState<PhraseWord[]>(unit.words);
  const [audioPath, setAudioPath] = useState<string | undefined>(unit.audioPath);
  const [recordedAudioPath, setRecordedAudioPath] = useState<string | undefined>(unit.recordedAudioPath);
  const [wordEditor, setWordEditor] = useState<{ index: number } | null>(null);   // index -1 = append
  const [audioOpen, setAudioOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(unit.name);
    setWords(unit.words);
    setAudioPath(unit.audioPath);
    setRecordedAudioPath(unit.recordedAudioPath);
    setWordEditor(null);
    setAudioOpen(false);
  }, [isOpen, unit]);

  const nameStr = displayString(name, language, DEFAULT_LOCALE);
  const builderWords = words.map((w) => ({
    imagePath: w.imagePath,
    label: displayString(w.label ?? {}, language, DEFAULT_LOCALE),
  }));
  const hasAudio = !!(recordedAudioPath ?? audioPath);
  const incomplete = words.length < 2;

  // ── Word edits (mirror TalkerDropdown.handlePhraseWordSave) ────────────────
  function handleWordSave(result: SentenceSlotSaveResult) {
    setWords((prev) => {
      if (!wordEditor) return prev;
      const next = [...prev];
      if (wordEditor.index === -1) {
        next.push({ order: next.length, imagePath: result.imagePath, audioPath: undefined, label: undefined, displayProps: result.displayProps });
      } else if (next[wordEditor.index]) {
        next[wordEditor.index] = { ...next[wordEditor.index], imagePath: result.imagePath, displayProps: result.displayProps };
      }
      return next.map((w, i) => ({ ...w, order: i }));
    });
    setWordEditor(null);
  }
  function handleWordDelete(index: number) {
    setWords((prev) => prev.filter((_, i) => i !== index).map((w, i) => ({ ...w, order: i })));
  }

  // ── Phrase audio + name (SentenceAudioModal saveOverride) ──────────────────
  // A new recording wins. If there's no recording after this save, drop the
  // stale TTS clip (audioPath) so playback re-resolves TTS from the (possibly
  // renamed) phrase name instead of speaking the old name.
  async function handleAudioSave(payload: { text: string; recordedAudioPath?: string | null }) {
    if (payload.text) setName((prev) => ({ ...prev, [language]: payload.text }));
    let nextRecorded = recordedAudioPath;
    if (typeof payload.recordedAudioPath === 'string') nextRecorded = payload.recordedAudioPath;
    else if (payload.recordedAudioPath === null) nextRecorded = undefined;
    setRecordedAudioPath(nextRecorded);
    if (!nextRecorded) setAudioPath(undefined);
  }

  function handleSave() {
    if (words.length < 2) return;
    const updated: PhraseUnit = {
      ...unit,                 // preserves kind, order, librarySourceId
      name,
      words: words.map((w, i) => ({ ...w, order: i })),
      audioPath: audioPath ?? undefined,
      recordedAudioPath: recordedAudioPath ?? undefined,
    };
    onSave(updated);
  }

  const existingWordImagePath =
    wordEditor && wordEditor.index >= 0 ? words[wordEditor.index]?.imagePath : undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('phraseEditorTitle')}</DialogTitle>
          </DialogHeader>

          <PhraseBuilderBody
            name={nameStr}
            words={builderWords}
            hasAudio={hasAudio}
            incomplete={incomplete}
            incompleteLabel={tTalker('phraseNeedsTwo')}
            audioReadyLabel={tTalker('phraseAudioReady')}
            audioGenerateLabel={tTalker('phraseAudioGenerate')}
            renameLabel={tTalker('phraseRename')}
            addLabel={tTalker('phraseAddSymbol')}
            removeLabel={tTalker('phraseRemoveSymbol')}
            onRename={(v) => setName((prev) => ({ ...prev, [language]: v }))}
            onWordAdd={() => setWordEditor({ index: -1 })}
            onWordEdit={(i) => setWordEditor({ index: i })}
            onWordDelete={handleWordDelete}
            onAudio={() => setAudioOpen(true)}
          />

          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold"
                style={{ background: 'var(--theme-line)', color: 'var(--theme-text)' }}
              >
                {t('phraseEditorCancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleSave}
              disabled={incomplete}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--theme-create)', color: '#fff' }}
            >
              {t('phraseEditorSave')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Word editor — image-only (sentenceSlot); a phrase plays as one clip. */}
      {wordEditor && (
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
      {audioOpen && (
        <SentenceAudioModal
          isOpen
          sentenceId={null}
          accountId={accountId}
          initialValue={nameStr}
          title={tTalker('phraseEditTitle')}
          fieldLabel={tTalker('phraseFieldLabel')}
          onClose={() => setAudioOpen(false)}
          saveOverride={handleAudioSave}
        />
      )}
    </>
  );
}
