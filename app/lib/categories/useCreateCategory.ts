"use client";

import { useConvex, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { voiceForLanguage } from '@/lib/audio/resolveVoiceId';
import { buildCreateSymbols, type SearchHit } from '@/lib/categories/autoMatchSymbols';

/**
 * Create a category from create-modal rows, auto-matching ticked words to their
 * top SymbolStix hit (image + label + audio-follows-label). Shared by the
 * Categories page and the Home page, which both mount CreateCategoryModal.
 * Returns the new category id; the caller handles routing.
 */
export function useCreateCategory() {
  const convex = useConvex();
  const createCategory = useMutation(api.profileCategories.createProfileCategory);
  const { language } = useProfile();

  return async function create(
    name: string,
    rows: Array<{ label: string; autoMatch: boolean }>,
  ): Promise<Id<'profileCategories'>> {
    const symbols = await buildCreateSymbols(rows, language, {
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
    });
    // Names never auto-translate; key by the board language (ADR-016 Addendum D).
    return createCategory({ name: { [language]: name }, symbols });
  };
}
