"use client";
import type { CSSProperties, ReactNode } from 'react';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { PLAY_GLOW } from '@/app/components/app/shared/ui/playGlow';
import type { PlayBlock } from './blocks';

const ZINC = getCategoryColour('zinc');

// Only a block with an `onTap` is a control. Without one it renders as a plain
// div — in the play modal the whole surface is the button, and a button nested
// inside a button is invalid HTML.
function BlockShell({ onTap, label, className, style, children }: {
  onTap?: () => void; label: string; className: string; style: CSSProperties; children: ReactNode;
}) {
  if (!onTap) return <div className={className} style={style}>{children}</div>;
  return (
    <button type="button" onClick={onTap} aria-label={label} className={className} style={style}>
      {children}
    </button>
  );
}

// Shared block renderer (ADR-015). A word is an image-over-label card; a phrase
// is the zinc box from TalkerBar's PhraseBox (thumbnail row + name pill). `active`
// wraps the block in the stepped-play glow. `onTap` makes it a play/edit target.
//
// `size="lg"` is the fullscreen play modal. It grows to fill the play surface —
// the surface height (PLAY_SURFACE_MIN_H) less its own padding and this card's
// chrome — but scales with the viewport below that, so a long sentence shrinks
// to fit a phone instead of running off both edges.
export function CompositionBlock({ block, active, onTap, size = 'default' }: {
  block: PlayBlock; active?: boolean; onTap?: () => void; size?: 'default' | 'lg';
}) {
  const glow = active ? { boxShadow: PLAY_GLOW } : undefined;
  const lg = size === 'lg';
  if (block.kind === 'word') {
    return (
      <BlockShell onTap={onTap} label={block.label}
        className="flex flex-col items-center gap-1 rounded-theme p-2 transition-shadow"
        style={{ background: 'var(--theme-symbol-card-bg)', ...glow }}>
        <div className={`${lg ? 'w-[clamp(72px,14vw,182px)] h-[clamp(72px,14vw,182px)]' : 'w-24 h-24'} flex items-center justify-center`}>
          {block.imageUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={block.imageUrl} alt={block.label} className="w-full h-full object-contain" draggable={false} />
            : <div className="w-3/4 aspect-square rounded-lg bg-black/10" />}
        </div>
        <span className="text-caption font-medium" style={{ color: 'var(--theme-symbol-card-text)' }}>{block.label}</span>
      </BlockShell>
    );
  }
  // phrase — zinc box (mirror TalkerBar PhraseBox), name pill underneath
  return (
    <BlockShell onTap={onTap} label={block.name}
      className="flex flex-col items-center gap-2 rounded-theme p-3 transition-shadow max-w-full"
      style={{ background: ZINC.c500, ...glow }}>
      {/* Wraps rather than overflowing: a phrase with many words would otherwise
          be wider than the screen, and a centred overflow crops both ends. */}
      <div className="flex flex-wrap items-end justify-center gap-2">
        {(block.words.length ? block.words : [{ label: '', imageUrl: undefined }]).map((w, i) => (
          <div key={i} className={`${lg ? 'w-[clamp(60px,11vw,166px)] h-[clamp(60px,11vw,166px)]' : 'w-20 h-20'} rounded-theme-sm overflow-hidden flex items-center justify-center`} style={{ background: ZINC.c100 }}>
            {w.imageUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={w.imageUrl} alt={w.label} className="w-full h-full object-contain p-1.5" draggable={false} />
              : <span className="text-caption px-1 text-center" style={{ color: ZINC.c700 }}>{w.label}</span>}
          </div>
        ))}
      </div>
      <span className="text-caption font-medium rounded-full px-3 py-0.5" style={{ background: ZINC.c700, color: '#fff' }}>{block.name}</span>
    </BlockShell>
  );
}
