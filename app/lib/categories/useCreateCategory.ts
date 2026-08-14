"use client";

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { buildCreateSymbols } from '@/lib/categories/autoMatchSymbols';
import { useAutoMatchDeps } from '@/app/lib/categories/useAutoMatchDeps';

/**
 * Create a category from create-modal rows, auto-matching ticked words to their
 * top SymbolStix hit (image + label + audio-follows-label). Shared by the
 * Categories page and the Home page, which both mount CreateCategoryModal.
 * Returns the new category id; the caller handles routing.
 */
export function useCreateCategory() {
  const createCategory = useMutation(api.profileCategories.createProfileCategory);
  const { language } = useProfile();
  const deps = useAutoMatchDeps();

  return async function create(
    name: string,
    rows: Array<{ label: string; autoMatch: boolean }>,
  ): Promise<Id<'profileCategories'>> {
    const symbols = await buildCreateSymbols(rows, language, deps);
    // Names never auto-translate; key by the board language (ADR-016 Addendum D).
    return createCategory({ name: { [language]: name }, symbols, authoredLanguage: language });
  };
}
