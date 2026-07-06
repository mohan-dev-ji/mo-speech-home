"use client";
import { getCategoryColour } from '@/app/lib/categoryColours';
import { PLAY_GLOW } from '@/app/components/app/shared/ui/playGlow';
import type { PlayBlock } from './blocks';

const ZINC = getCategoryColour('zinc');

// Shared block renderer (ADR-015). A word is an image-over-label card; a phrase
// is the zinc box from TalkerBar's PhraseBox (thumbnail row + name pill). `active`
// wraps the block in the stepped-play glow. `onTap` makes it a play/edit target.
export function CompositionBlock({ block, active, onTap }: { block: PlayBlock; active?: boolean; onTap?: () => void }) {
  const glow = active ? { boxShadow: PLAY_GLOW } : undefined;
  if (block.kind === 'word') {
    return (
      <button type="button" onClick={onTap} aria-label={block.label}
        className="flex flex-col items-center gap-1 rounded-theme p-2 transition-shadow"
        style={{ background: 'var(--theme-symbol-card-bg)', ...glow }}>
        <div className="w-24 h-24 flex items-center justify-center">
          {block.imageUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={block.imageUrl} alt={block.label} className="w-full h-full object-contain" draggable={false} />
            : <div className="w-3/4 aspect-square rounded-lg bg-black/10" />}
        </div>
        <span className="text-caption font-medium" style={{ color: 'var(--theme-symbol-card-text)' }}>{block.label}</span>
      </button>
    );
  }
  // phrase — zinc box (mirror TalkerBar PhraseBox), name pill underneath
  return (
    <button type="button" onClick={onTap} aria-label={block.name}
      className="flex flex-col items-center gap-2 rounded-theme p-3 transition-shadow"
      style={{ background: ZINC.c500, ...glow }}>
      <div className="flex items-end gap-2">
        {(block.words.length ? block.words : [{ label: '', imageUrl: undefined }]).map((w, i) => (
          <div key={i} className="w-20 h-20 rounded-theme-sm overflow-hidden flex items-center justify-center" style={{ background: ZINC.c100 }}>
            {w.imageUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={w.imageUrl} alt={w.label} className="w-full h-full object-contain p-1.5" draggable={false} />
              : <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{w.label}</span>}
          </div>
        ))}
      </div>
      <span className="text-caption font-medium rounded-full px-3 py-0.5" style={{ background: ZINC.c700, color: '#fff' }}>{block.name}</span>
    </button>
  );
}
