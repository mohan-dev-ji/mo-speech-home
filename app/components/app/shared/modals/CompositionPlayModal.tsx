"use client";
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw } from 'lucide-react';
import { CompositionBlock } from '@/app/components/app/shared/ui/composition/CompositionBlock';
import type { PlayBlock } from '@/app/components/app/shared/ui/composition/blocks';
import { playTts } from '@/lib/audio/playTts';

// Block play modal (ADR-015). Shows the whole composition at once and steps a
// yellow glow through each block in time with its audio. Replay re-runs the
// sequence; tapping a block cancels the run and plays just that block; clicking
// the backdrop closes. A block with no stored clip falls back to TTS of its
// label/name (better than silence).
export function CompositionPlayModal({
  isOpen, blocks, voiceId, onClose,
}: { isOpen: boolean; blocks: PlayBlock[]; voiceId: string; onClose: () => void }) {
  const t = useTranslations('talker');
  const cancelRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  function clipKey(b: PlayBlock) { return b.audioKey; }          // word/phrase own clip
  function ttsText(b: PlayBlock) { return b.kind === 'word' ? b.label : b.name; }

  async function playOne(b: PlayBlock): Promise<void> {
    const key = clipKey(b);
    if (key) {
      await new Promise<void>((res) => {
        const a = new Audio(`/api/assets?key=${key}`);
        a.addEventListener('ended', () => res());
        a.addEventListener('error', () => res());
        a.play().catch(() => res());
      });
    } else {
      // no stored clip → speak the label/name (better than silence)
      await playTts(ttsText(b), voiceId);
      await new Promise<void>((res) => setTimeout(res, 200));
    }
  }

  async function runSequence() {
    cancelRef.current = false;
    for (let i = 0; i < blocks.length; i++) {
      if (cancelRef.current) break;
      setActiveIndex(i);
      await playOne(blocks[i]);
    }
    if (!cancelRef.current) setActiveIndex(null);
  }

  useEffect(() => { if (isOpen) runSequence(); return () => { cancelRef.current = true; }; }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 p-8"
         style={{ background: 'var(--theme-overlay)' }} onClick={() => { cancelRef.current = true; onClose(); }}>
      <div className="flex flex-wrap gap-4 justify-center max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {blocks.map((b, i) => (
          <CompositionBlock key={i} block={b} active={activeIndex === i}
            onTap={() => { cancelRef.current = true; setActiveIndex(i); playOne(b).then(() => setActiveIndex(null)); }} />
        ))}
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); runSequence(); }}
        className="flex items-center gap-2 rounded-theme-sm px-5 py-3 text-body font-semibold"
        style={{ background: 'var(--theme-brand-primary)', color: '#fff' }}>
        <RotateCcw className="w-5 h-5" /> {t('replay')}
      </button>
    </div>
  );
}
