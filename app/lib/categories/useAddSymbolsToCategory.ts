"use client";

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { buildCreateSymbols } from '@/lib/categories/autoMatchSymbols';
import { useAutoMatchDeps } from '@/app/lib/symbols/useAutoMatchDeps';

/**
 * Append a list of words to an EXISTING profileCategory (e.g. the core-words
 * dropdown container), auto-matching ticked rows to their top SymbolStix hit and
 * leaving unticked rows as editable placeholders — the same builder the
 * create-category flow uses, but the specs land at the end of the target grid.
 */
export function useAddSymbolsToCategory() {
  const addSymbols = useMutation(api.profileCategories.addProfileSymbols);
  const { language } = useProfile();
  const deps = useAutoMatchDeps();

  return async function add(
    profileCategoryId: Id<'profileCategories'>,
    rows: Array<{ label: string; autoMatch: boolean }>,
  ): Promise<void> {
    const symbols = await buildCreateSymbols(rows, language, deps);
    if (symbols.length === 0) return;
    await addSymbols({ profileCategoryId, symbols });
  };
}
