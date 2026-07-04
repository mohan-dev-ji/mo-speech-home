"use client";
import { useState, useEffect } from 'react';
import { Plus, Volume2, Mic, X } from 'lucide-react';
import { getCategoryColour } from '@/app/lib/categoryColours';

const ZINC = getCategoryColour('zinc');

export type PhraseBuilderWord = { imagePath?: string; label: string };

// A single word tile inside the phrase builder — edit on tap, X to remove.
export function WordChip({
  imagePath, label, removeLabel, onEdit, onDelete,
}: { imagePath?: string; label: string; removeLabel: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onEdit}
        aria-label={label}
        className="w-16 h-16 rounded-theme-sm overflow-hidden flex items-center justify-center"
        style={{ background: ZINC.c100 }}
      >
        {imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/api/assets?key=${imagePath}`} alt={label} className="w-full h-full object-contain p-1" draggable={false} />
        ) : (
          <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{label}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={removeLabel}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
        style={{ background: 'var(--theme-warning)', color: '#fff' }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// The inner phrase builder: word chips + add-word, a name field, and the phrase
// audio button. Pure props/callbacks — shared by the talker dropbar's
// PhraseEditCard and the sentence PhraseUnitEditorModal, so both edit a phrase
// identically. The host owns the actual word/audio sub-editors + persistence.
export function PhraseBuilderBody({
  name, words, hasAudio, incomplete,
  incompleteLabel, audioReadyLabel, audioGenerateLabel, renameLabel, addLabel, removeLabel,
  onRename, onWordAdd, onWordEdit, onWordDelete, onAudio,
}: {
  name: string;
  words: PhraseBuilderWord[];
  hasAudio: boolean;
  incomplete: boolean;
  incompleteLabel: string;
  audioReadyLabel: string;
  audioGenerateLabel: string;
  renameLabel: string;
  addLabel: string;
  removeLabel: string;
  onRename: (value: string) => void;
  onWordAdd: () => void;
  onWordEdit: (index: number) => void;
  onWordDelete: (index: number) => void;
  onAudio: () => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename(v);
    else setDraft(name);
  }

  return (
    <div
      className="flex flex-col gap-3 p-3 rounded-theme-card border-2 border-dashed"
      style={{ background: ZINC.c500, borderColor: incomplete ? 'var(--theme-warning)' : 'var(--theme-enter-mode)' }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {words.map((w, i) => (
          <WordChip
            key={i}
            imagePath={w.imagePath}
            label={w.label}
            removeLabel={removeLabel}
            onEdit={() => onWordEdit(i)}
            onDelete={() => onWordDelete(i)}
          />
        ))}
        <button
          type="button"
          onClick={onWordAdd}
          aria-label={addLabel}
          className="w-16 h-16 rounded-theme-sm border-2 border-dashed border-theme-enter-mode flex items-center justify-center transition-opacity hover:opacity-80 shrink-0"
        >
          <Plus className="w-6 h-6" style={{ color: 'var(--theme-enter-mode)' }} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
          }}
          aria-label={renameLabel}
          className="flex-1 min-w-0 text-caption font-medium rounded-full px-3 py-1 outline-none"
          style={{ background: ZINC.c700, color: '#fff', border: '2px dashed var(--theme-enter-mode)' }}
        />
        <button
          type="button"
          onClick={onAudio}
          className="flex items-center gap-1 text-caption font-medium rounded-full px-2.5 py-1 shrink-0"
          style={{ background: ZINC.c700, color: '#fff' }}
        >
          {hasAudio ? <Volume2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {hasAudio ? audioReadyLabel : audioGenerateLabel}
        </button>
      </div>

      {incomplete && (
        <span className="text-caption" style={{ color: 'var(--theme-warning)' }}>{incompleteLabel}</span>
      )}
    </div>
  );
}
