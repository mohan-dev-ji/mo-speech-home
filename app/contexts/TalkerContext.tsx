"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';

// ─── Types ────────────────────────────────────────────────────────────────────

// A unit in the talker (ADR-015). A plain word/symbol carries the original
// fields; a phrase additionally carries `kind: 'phrase'`, its name, and its
// decomposition (`words`) so the bar can render the zinc box and a saved
// sentence can retain the breakdown. The fields are ADDITIVE — existing word
// items (kind undefined/'word') behave exactly as before; consumers that read
// only symbolId/label/imagePath/audioPath keep working for both.
export type TalkerPhraseWord = {
  imagePath?: string;
  audioPath?: string;
  label: string;
  // Phase 15 (Task 6): full localised record from the source, so a saved sentence
  // keys each word's text by its TRUE language (not the board language). Optional —
  // when absent, save falls back to { [boardLanguage]: label }.
  labelRecord?: Record<string, string>;
};

export type TalkerSymbolItem = {
  instanceId: string;
  symbolId: string;
  imagePath?: string;
  audioPath?: string;
  label: string;
  // Phase 15 (Task 6): full localised record carried from the tap source.
  labelRecord?: Record<string, string>;
  // Phrase fields (present only when kind === 'phrase').
  kind?: 'word' | 'phrase';
  phraseName?: string;
  phraseNameRecord?: Record<string, string>;
  words?: TalkerPhraseWord[];
};

export type TalkerMode = 'talker' | 'banner';

type TalkerContextValue = {
  talkerSymbols: TalkerSymbolItem[];
  talkerMode: TalkerMode;
  addToTalker: (item: Omit<TalkerSymbolItem, 'instanceId'>) => void;
  removeFromTalker: (instanceId: string) => void;
  reorderTalker: (fromIndex: number, toIndex: number) => void;
  clearTalker: () => void;
  setTalkerMode: (mode: TalkerMode) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const TalkerContext = createContext<TalkerContextValue | null>(null);

export function useTalker() {
  const ctx = useContext(TalkerContext);
  if (!ctx) throw new Error('useTalker must be used inside TalkerProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TalkerProvider({ children }: { children: ReactNode }) {
  const { stateFlags, setHeaderInBannerMode } = useProfile();

  const [talkerSymbols, setTalkerSymbols] = useState<TalkerSymbolItem[]>([]);

  const talkerMode: TalkerMode = stateFlags.header_in_banner_mode ? 'banner' : 'talker';

  function setTalkerMode(mode: TalkerMode) {
    setHeaderInBannerMode(mode === 'banner');
  }

  function addToTalker(item: Omit<TalkerSymbolItem, 'instanceId'>) {
    setTalkerSymbols((prev) => [
      ...prev,
      { ...item, instanceId: crypto.randomUUID() },
    ]);
  }

  function removeFromTalker(instanceId: string) {
    setTalkerSymbols((prev) => prev.filter((s) => s.instanceId !== instanceId));
  }

  // Shuffle-editing (ADR-015 §8): move a unit within the bar. Splice-based,
  // mirroring the MVP's reorderSymbols. The bar is the composition surface, so
  // reordering here does not touch the fixed board's motor planning.
  function reorderTalker(fromIndex: number, toIndex: number) {
    setTalkerSymbols((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function clearTalker() {
    setTalkerSymbols([]);
  }

  return (
    <TalkerContext.Provider
      value={{ talkerSymbols, talkerMode, addToTalker, removeFromTalker, reorderTalker, clearTalker, setTalkerMode }}
    >
      {children}
    </TalkerContext.Provider>
  );
}
