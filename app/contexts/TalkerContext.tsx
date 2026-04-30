"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TalkerSymbolItem = {
  instanceId: string;
  symbolId: string;
  imagePath?: string;
  audioPath?: string;
  label: string;
};

export type TalkerMode = 'talker' | 'banner';

type TalkerContextValue = {
  talkerSymbols: TalkerSymbolItem[];
  talkerMode: TalkerMode;
  addToTalker: (item: Omit<TalkerSymbolItem, 'instanceId'>) => void;
  removeFromTalker: (instanceId: string) => void;
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

  function clearTalker() {
    setTalkerSymbols([]);
  }

  return (
    <TalkerContext.Provider
      value={{ talkerSymbols, talkerMode, addToTalker, removeFromTalker, clearTalker, setTalkerMode }}
    >
      {children}
    </TalkerContext.Provider>
  );
}
