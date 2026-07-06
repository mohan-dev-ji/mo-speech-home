"use client";

import { useEffect, useRef, useState } from 'react';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { PLAY_GLOW } from '@/app/components/app/shared/ui/playGlow';
import { ReplayButton } from '@/app/components/app/shared/ui/ReplayButton';
import { resolveTtsKey } from '@/lib/audio/playTts';

type Slot = {
  order: number;
  imagePath?: string;
};

type SentencePlayModalProps = {
  isOpen: boolean;
  sentenceText: string;
  slots: Slot[];
  /** Human recording override — voice-independent; wins over dynamic TTS. */
  recordedAudioPath?: string;
  /** Active voice — TTS is resolved per (sentenceText, voiceId) at play time. */
  voiceId: string;
  /** The sentence's module (folder) colour key; drives the 50% symbol-group fill. */
  moduleColour?: string;
  onClose: () => void;
};

// Fullscreen play modal for fluent / single-symbol sentences (ADR-015). A variant
// of the block CompositionPlayModal: the whole sentence plays as ONE clip, so the
// shared yellow play-glow sits on the WHOLE symbol group for exactly as long as the
// audio sounds (not stepped per symbol). The symbols group on the module colour at
// 50% so the glow reads; a smaller sentence pill + the shared Replay button below.
export function SentencePlayModal({
  isOpen, sentenceText, slots, recordedAudioPath, voiceId, moduleColour, onClose,
}: SentencePlayModalProps) {
  // Monotonic run token guards against StrictMode's double-mount + replay taps
  // launching overlapping clips (mirrors CompositionPlayModal).
  const runIdRef = useRef(0);
  const activeAudioRef = useRef<{ audio: HTMLAudioElement; done: () => void } | null>(null);
  const [playing, setPlaying] = useState(false);

  function stopActive() {
    const cur = activeAudioRef.current;
    if (cur) { activeAudioRef.current = null; cur.audio.pause(); cur.done(); }
  }

  // Play the sentence as a single clip and hold the glow on until it ENDS.
  // Recording wins (any voice); otherwise resolve TTS for the current voice
  // (cache hit, or synthesise on a cold first tap). `playing` is driven off the
  // audio element's own play/ended events so the glow tracks real playback (and
  // setState never fires synchronously inside the mount effect).
  async function playClip() {
    const myRun = ++runIdRef.current;
    stopActive();
    let key = recordedAudioPath;
    if (!key && sentenceText) {
      key = await resolveTtsKey(sentenceText, voiceId);
      if (runIdRef.current !== myRun) return;   // superseded during synth
    }
    if (!key) return;
    await new Promise<void>((res) => {
      const audio = new Audio(`/api/assets?key=${key}`);
      const done = () => { if (activeAudioRef.current?.audio === audio) activeAudioRef.current = null; res(); };
      const stop = () => { if (runIdRef.current === myRun) setPlaying(false); done(); };
      activeAudioRef.current = { audio, done };
      audio.addEventListener('play', () => { if (runIdRef.current === myRun) setPlaying(true); });
      audio.addEventListener('ended', stop);
      audio.addEventListener('error', stop);
      audio.play().catch(stop);
    });
  }

  function close() { runIdRef.current++; stopActive(); setPlaying(false); onClose(); }

  useEffect(() => {
    if (isOpen) playClip();
    return () => { runIdRef.current++; stopActive(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const filledSlots = slots.filter((s) => s.imagePath);
  const groupBg = `color-mix(in srgb, ${getCategoryColour(moduleColour ?? 'zinc').c500} 50%, transparent)`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-8"
      style={{ background: 'var(--theme-overlay)' }}
      onClick={close}
    >
      <div
        className="flex flex-col items-center gap-theme-gap"
        onClick={(e) => e.stopPropagation()}
      >
        {filledSlots.length > 0 && (
          <div
            className="flex flex-wrap items-center justify-center gap-theme-gap p-theme-general rounded-theme max-w-[min(90vw,900px)] transition-shadow duration-300"
            style={{ background: groupBg, boxShadow: playing ? PLAY_GLOW : undefined }}
          >
            {filledSlots.map((slot, i) => (
              <div
                key={i}
                className="w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] rounded-theme border-2 border-theme-line overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--theme-symbol-card-bg)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/assets?key=${slot.imagePath}`}
                  alt=""
                  className="w-full h-full object-contain p-2"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer — pt keeps the glow clear of the buttons (Figma note). */}
        <div className="w-full flex flex-col items-center gap-theme-gap pt-theme-general">
          <div className="w-full min-h-[44px] flex items-center justify-center px-4 py-2 rounded-theme-chip border border-theme-line bg-theme-button-primary text-theme-button-secondary text-theme-h4 font-semibold text-center">
            {sentenceText}
          </div>
          <ReplayButton onClick={playClip} />
        </div>
      </div>
    </div>
  );
}
