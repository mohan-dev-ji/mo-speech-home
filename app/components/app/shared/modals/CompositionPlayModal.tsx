"use client";
import { useEffect, useRef, useState } from 'react';
import { CompositionBlock } from '@/app/components/app/shared/ui/composition/CompositionBlock';
import { PlayModalBackdrop } from '@/app/components/app/shared/ui/PlayModalBackdrop';
import { ReplayButton } from '@/app/components/app/shared/ui/ReplayButton';
import type { PlayBlock } from '@/app/components/app/shared/ui/composition/blocks';
import { resolveTtsKey } from '@/lib/audio/playTts';

// Block play modal (ADR-015). Shows the whole composition at once and steps a
// yellow glow through each block in time with its audio. Replay re-runs the
// sequence; tapping a block cancels the run and plays just that block; clicking
// the backdrop closes. A block with no stored clip falls back to TTS of its
// label/name (better than silence).
export function CompositionPlayModal({
  isOpen, blocks, voiceId, onClose,
}: { isOpen: boolean; blocks: PlayBlock[]; voiceId: string; onClose: () => void }) {
  // Monotonic run token: every new sequence/tap/close bumps it, so any older
  // in-flight run bails at its next check. Guards against React StrictMode's
  // double-invoked mount effect launching two concurrent runs — which is what
  // made blocks play twice and overlap.
  const runIdRef = useRef(0);
  const activeAudioRef = useRef<{ audio: HTMLAudioElement; done: () => void } | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  function ttsText(b: PlayBlock) { return b.kind === 'word' ? b.label : b.name; }

  // Stop whatever is currently sounding and resolve its awaiting promise, so a
  // superseded loop unwinds instead of hanging forever waiting on 'ended'.
  function stopActive() {
    const cur = activeAudioRef.current;
    if (cur) { activeAudioRef.current = null; cur.audio.pause(); cur.done(); }
  }

  // Play one block and resolve only when its audio has actually ENDED, so the
  // glow lasts exactly as long as the sound. A clip-less block (a phrase with no
  // recorded/generated audio) is synthesised to a clip first, then played the
  // same way — so its glow matches too, instead of jumping ahead of the speech.
  async function playOne(b: PlayBlock, runId: number): Promise<void> {
    let key = b.audioKey;
    if (!key) {
      key = await resolveTtsKey(ttsText(b), voiceId);
      if (runIdRef.current !== runId) return;   // superseded during synth — don't play
    }
    if (!key) { await new Promise<void>((res) => setTimeout(res, 300)); return; } // nothing to play
    await new Promise<void>((res) => {
      const audio = new Audio(`/api/assets?key=${key}`);
      const done = () => { if (activeAudioRef.current?.audio === audio) activeAudioRef.current = null; res(); };
      activeAudioRef.current = { audio, done };
      audio.addEventListener('ended', done);
      audio.addEventListener('error', done);
      audio.play().catch(done);
    });
  }

  async function runSequence() {
    const myRun = ++runIdRef.current;
    stopActive();
    for (let i = 0; i < blocks.length; i++) {
      if (runIdRef.current !== myRun) return;
      setActiveIndex(i);
      await playOne(blocks[i], myRun);
      if (runIdRef.current !== myRun) return;   // re-check after the await
    }
    if (runIdRef.current === myRun) setActiveIndex(null);
  }

  function playSingle(i: number) {
    const myRun = ++runIdRef.current;   // cancel any running sequence
    stopActive();
    setActiveIndex(i);
    playOne(blocks[i], myRun).then(() => { if (runIdRef.current === myRun) setActiveIndex(null); });
  }

  function close() { runIdRef.current++; stopActive(); onClose(); }

  useEffect(() => {
    if (isOpen) runSequence();
    return () => { runIdRef.current++; stopActive(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <PlayModalBackdrop onClose={close} className="flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-wrap gap-4 justify-center max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {blocks.map((b, i) => (
          <CompositionBlock key={i} block={b} active={activeIndex === i} onTap={() => playSingle(i)} />
        ))}
      </div>
      <ReplayButton onClick={runSequence} />
    </PlayModalBackdrop>
  );
}
