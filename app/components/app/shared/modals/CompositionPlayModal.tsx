"use client";
import { useEffect, useRef, useState } from 'react';
import { CompositionBlock } from '@/app/components/app/shared/ui/composition/CompositionBlock';
import { PlayModalBackdrop } from '@/app/components/app/shared/ui/PlayModalBackdrop';
import { useTranslations } from 'next-intl';
import { usePlayPulse } from '@/app/hooks/usePlayPulse';
import {
  PLAY_SURFACE_MIN_H, PLAY_SURFACE_ZOOM_CLASS, playSurfaceTransform,
} from '@/app/components/app/shared/ui/playSurface';
import { ToneChipRow } from '@/app/components/app/shared/ui/ToneChipRow';
import { useToast } from '@/app/components/app/shared/ui/Toast';
import type { PlayBlock } from '@/app/components/app/shared/ui/composition/blocks';
import { resolveTtsKey } from '@/lib/audio/playTts';
import { voiceForResolvedLocale } from '@/lib/audio/resolveSpokenVoice';
import type { Tone } from '@/lib/audio/tonePresets';

// Block play modal (ADR-015). Shows the whole composition at once and steps a
// yellow glow through each block in time with its audio. Tapping anywhere on the
// strip re-runs the whole sequence in order; clicking the backdrop closes. A
// block with no stored clip falls back to TTS of its label/name (better than
// silence). Individual blocks are not tap targets: one big control beats a row
// of small ones to aim at.
//
// The surface matches SentencePlayModal's (shared `playSurface` tokens): same
// height, same zoom pulse, no Replay button — a block sentence and a fluent one
// are the same object to the student, so they should not behave like two
// different screens. It carries no panel fill of its own, unlike fluent: the
// blocks are already cards on their own backgrounds, and they fill the surface,
// so a tint behind them would only be visible in the gaps.
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
  // Tone (Phase 15, Thread 2): the emoji row plays the whole utterance as ONE
  // fluent Gemini clip (glow on all blocks), distinct from the stepped ▶ replay.
  const [fluentPlaying, setFluentPlaying] = useState(false);
  const [activeTone, setActiveTone] = useState<Tone | null>(null);
  const [busy, setBusy] = useState(false);
  // Tap feedback on the replay surface — a brief scale-up that eases back.
  const { zoom, pulse, reset: resetPulse } = usePlayPulse(isOpen);
  const t = useTranslations('tone');
  const tTalker = useTranslations('talker');
  const { showToast } = useToast();

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
      // Voice follows the block's resolved text language (Phase 15, 3e): an
      // English block on a Hindi board is synthesised with an English voice
      // (persona preserved), not the board's Hindi voice. Live talker blocks have
      // no `locale` and use the board voiceId as-is.
      const blockVoice = voiceForResolvedLocale(b.locale, voiceId);
      // `literal`: speak the authored text in the board voice, skipping the
      // SymbolStix per-language default (which would swap a word for its canonical
      // board-language word — the translation). Matches how phrases already behave.
      key = await resolveTtsKey(ttsText(b), blockVoice, undefined, { literal: true });
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

  // Fluent tone playback (Phase 15, Thread 2): join the blocks in authored-language
  // order into one utterance and synthesise it with the chosen tone via Gemini —
  // ONE whole-utterance clip, glow held on all blocks. Distinct from the stepped
  // ▶ replay above, which stays the free per-block Wavenet voice.
  async function playFluent(tone: Tone) {
    const myRun = ++runIdRef.current;
    stopActive();
    setActiveIndex(null);
    const text = blocks.map(ttsText).filter(Boolean).join(' ').trim();
    if (!text) return;
    // Whole utterance is one authored language; take the first block's resolved
    // locale (all share it) so the voice follows the text, not the board.
    const locale = blocks.find((b) => b.locale)?.locale;
    const voice = voiceForResolvedLocale(locale, voiceId);
    setActiveTone(tone);
    setBusy(true);
    const key = await resolveTtsKey(text, voice, tone);
    setBusy(false);
    if (runIdRef.current !== myRun) return;   // superseded during synth
    if (!key) {
      // Synthesis failed — surface it instead of a silent no-op.
      setActiveTone(null);
      showToast({ tone: 'warning', title: t('playbackError'), dedupeKey: 'tone-playback-error' });
      return;
    }
    setFluentPlaying(true);
    await new Promise<void>((res) => {
      const audio = new Audio(`/api/assets?key=${key}`);
      const done = () => { if (activeAudioRef.current?.audio === audio) activeAudioRef.current = null; res(); };
      const stop = () => { if (runIdRef.current === myRun) { setFluentPlaying(false); setActiveTone(null); } done(); };
      activeAudioRef.current = { audio, done };
      audio.addEventListener('ended', stop);
      audio.addEventListener('error', stop);
      audio.play().catch(stop);
    });
  }

  // Tapping the surface (anywhere but a block) restarts the stepped sequence.
  function handleReplay() {
    pulse();
    setFluentPlaying(false);
    setActiveTone(null);
    runSequence();
  }

  function close() {
    runIdRef.current++; stopActive(); resetPulse();
    setFluentPlaying(false); setActiveTone(null); setBusy(false);
    onClose();
  }

  useEffect(() => {
    if (isOpen) runSequence();
    return () => { runIdRef.current++; stopActive(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <PlayModalBackdrop onClose={close} className="flex-col items-center justify-center gap-theme-gap p-8">
      {/* The whole block strip is the replay control — the blocks themselves are
          not tappable, so there is one target rather than a row of small ones. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleReplay(); }}
        aria-label={tTalker('replay')}
        className={`flex flex-wrap items-center justify-center gap-theme-gap p-theme-general rounded-theme max-w-[min(95vw,1200px)] ${PLAY_SURFACE_MIN_H} ${PLAY_SURFACE_ZOOM_CLASS}`}
        style={{ transform: playSurfaceTransform(zoom) }}
      >
        {blocks.map((b, i) => (
          <CompositionBlock key={i} block={b} size="lg" active={activeIndex === i || fluentPlaying} />
        ))}
      </button>

      <div className="pt-theme-general" onClick={(e) => e.stopPropagation()}>
        <ToneChipRow activeTone={activeTone} busy={busy} onSelect={playFluent} />
      </div>
    </PlayModalBackdrop>
  );
}
