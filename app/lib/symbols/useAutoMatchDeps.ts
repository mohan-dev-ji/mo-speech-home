"use client";

import { useConvex } from 'convex/react';
import { useMemo } from 'react';
import { api } from '@/convex/_generated/api';
import { voiceForLanguage } from '@/lib/audio/resolveVoiceId';
import type { AutoMatchDeps, SearchHit } from '@/lib/symbols/autoMatchDeps';

/**
 * The search + TTS resolvers the auto-match builders need to match a typed word
 * to its top SymbolStix hit. Shared by every host that turns typed words into
 * content: create-category, add-list-to-core-words, and create-sentence.
 *
 * `limit: 1` gives the same first result the search page shows — the exact
 * whole-word boost in `convex/symbols.ts:searchSymbols` runs either way, so
 * short function words ("is", "go") resolve to their canonical symbol rather
 * than a longer prefix match.
 */
export function useAutoMatchDeps(): AutoMatchDeps {
  const convex = useConvex();
  return useMemo<AutoMatchDeps>(() => ({
    search: async (term, lang): Promise<SearchHit | null> => {
      const results = await convex.query(api.symbols.searchSymbols, {
        searchTerm: term, language: lang, limit: 1,
      });
      const first = results?.[0];
      return first
        ? { _id: first._id, words: first.words, imagePath: first.imagePath }
        : null;
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
