"use client";

// Renders in the app layout shell above all pages.
// Owns PlayModal and sentence sequence playback.

import { useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/app/contexts/ProfileContext';
import { useTalker, type TalkerSymbolItem } from '@/app/contexts/TalkerContext';
import { Header } from '@/app/components/app/shared/ui/Header';
import type { QuickSymbolItem } from '@/app/components/app/shared/ui/Header';
import { PlayModal } from '@/app/components/app/shared/modals/PlayModal';

// Route segments where the talker is allowed to replace the page banner.
// Everywhere else (lists, sentences, settings, home) keeps its own permanent
// header, so the talker bar never appears there. Pathname shape is
// `/<locale>/<segment>/...`, so segment is index 2. `categories` covers both
// the listing and the `/categories/[id]` detail page.
const TALKER_SEGMENTS = ['search', 'categories'];

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
  const { talkerSymbols, talkerMode, addToTalker, removeFromTalker, reorderTalker, clearTalker } = useTalker();
  const pathname = usePathname();

  const [playModal, setPlayModal] = useState<PlayModalState>(null);
  const cancelSequenceRef = useRef(false);

  // Only render in sentence-builder mode; banner mode shows page-level banners instead
  if (!stateFlags.talker_visible || talkerMode !== 'talker') return null;

  // Only on talker-capable pages — lists/sentences/settings keep a permanent
  // banner and home owns its own header, so the talker never appears there.
  const segment = pathname.split('/')[2] ?? '';
  if (!TALKER_SEGMENTS.includes(segment)) return null;

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

  function handleQuickSymbolTap(item: QuickSymbolItem) {
    if (item.audioPath) playAudio(item.audioPath);
    addToTalker({
      symbolId: item.symbolId,
      label: item.label,
      imagePath: item.imagePath,
      audioPath: item.audioPath,
      // Phrase units carry their kind + name + decomposition through to the bar
      // (ADR-015). Word units leave these undefined and behave as before.
      ...(item.kind ? { kind: item.kind } : {}),
      ...(item.phraseName ? { phraseName: item.phraseName } : {}),
      ...(item.words ? { words: item.words } : {}),
    });
  }

  return (
    <>
      {/* No bottom padding — the page content below owns the gap via its own top
          padding, so the talker doesn't double up the space under it. */}
      <div className="shrink-0 px-theme-mobile-general md:px-theme-general pt-theme-mobile-general md:pt-theme-general">
        <Header
          symbols={talkerSymbols}
          language={language}
          onChipTap={handleChipTap}
          onPlaySentence={handlePlaySentence}
          onClear={clearTalker}
          onQuickSymbolTap={handleQuickSymbolTap}
          onRemove={removeFromTalker}
          onReorder={reorderTalker}
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
