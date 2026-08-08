"use client";

import { useConvex } from 'convex/react';
import { useMemo } from 'react';
import { api } from '@/convex/_generated/api';
import { voiceForLanguage } from '@/lib/audio/resolveVoiceId';
import type { AutoMatchDeps, SearchHit } from '@/lib/categories/autoMatchSymbols';

/**
 * The search + TTS resolvers `buildCreateSymbols` needs to auto-match pasted
 * words to their top SymbolStix hit. Shared by every host that turns a list of
 * words into symbol specs (create-category, add-list-to-core-words).
 */
export function useAutoMatchDeps(): AutoMatchDeps {
  const convex = useConvex();
  return useMemo<AutoMatchDeps>(() => ({
    search: async (term, lang): Promise<SearchHit | null> => {
      const results = await convex.query(api.symbols.searchSymbols, {
        searchTerm: term, language: lang, limit: 1,
      });
      const first = results?.[0];
      return first ? { _id: first._id, words: first.words } : null;
    },
    resolveTts: async (text, lang): Promise<string | null> => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceId: voiceForLanguage(lang) }),
        });
        if (!res.ok) return null;
        const { r2Key } = (await res.json()) as { r2Key: string };
        return r2Key ?? null;
      } catch {
        return null;
      }
    },
  }), [convex]);
}
