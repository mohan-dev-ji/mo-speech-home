"use client";

// Renders in the app layout shell above all pages.
// Owns PlayModal and sentence sequence playback.

import { useState, useRef } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker, type TalkerSymbolItem } from '@/app/contexts/TalkerContext';
import { Header } from '@/app/components/app/shared/ui/Header';
import { PlayModal } from '@/app/components/app/shared/modals/PlayModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayModalState = {
  symbolId: string;
  imagePath?: string;
  audioPath?: string;
  label: string;
} | null;

// ─── Audio ────────────────────────────────────────────────────────────────────

function playAudio(audioPath: string) {
  const audio = new Audio(`/api/assets?key=${audioPath}`);
  audio.play().catch(() => {});
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersistentTalker() {
  const { stateFlags, language } = useProfile();
  const { talkerSymbols, talkerMode, addToTalker, clearTalker } = useTalker();

  const [playModal, setPlayModal] = useState<PlayModalState>(null);
  const cancelSequenceRef = useRef(false);

  // Only render in sentence-builder mode; banner mode shows page-level banners instead
  if (!stateFlags.talker_visible || talkerMode !== 'talker') return null;

  function handleChipTap(item: TalkerSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    setPlayModal({
      symbolId: item.symbolId,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
      label: item.label,
    });
  }

  async function handlePlaySentence() {
    if (talkerSymbols.length === 0) return;
    cancelSequenceRef.current = false;

    for (const symbol of talkerSymbols) {
      if (cancelSequenceRef.current) break;
      setPlayModal({
        symbolId: symbol.symbolId,
        imagePath: symbol.imagePath,
        audioPath: symbol.audioPath,
        label: symbol.label,
      });
      if (symbol.audioPath) {
        const path = symbol.audioPath;
        await new Promise<void>((resolve) => {
          const audio = new Audio(`/api/assets?key=${path}`);
          audio.addEventListener('ended', () => resolve());
          audio.addEventListener('error', () => resolve());
          audio.play().catch(() => resolve());
        });
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
      }
    }
    if (!cancelSequenceRef.current) setPlayModal(null);
  }

  function handleQuickSymbolTap(item: { symbolId: string; label: string; imagePath?: string; audioPath?: string }) {
    if (item.audioPath) playAudio(item.audioPath);
    addToTalker({
      symbolId: item.symbolId,
      label: item.label,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
    });
  }

  return (
    <>
      <div className="shrink-0 px-theme-mobile-general md:px-theme-general pt-theme-mobile-general md:pt-theme-general pb-8">
        <Header
          symbols={talkerSymbols}
          language={language}
          onChipTap={handleChipTap}
          onPlaySentence={handlePlaySentence}
          onClear={clearTalker}
          onQuickSymbolTap={handleQuickSymbolTap}
        />
      </div>

      {playModal && (
        <PlayModal
          isOpen={true}
          symbolId={playModal.symbolId}
          imagePath={playModal.imagePath}
          label={playModal.label}
          language={language}
          onClose={() => { cancelSequenceRef.current = true; setPlayModal(null); }}
        />
      )}
    </>
  );
}
