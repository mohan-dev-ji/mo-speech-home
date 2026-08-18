"use client";

import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import type { GroupSelection } from '@/app/components/app/shared/ui/GroupPicker';

/**
 * Resolve a GroupPicker selection to the folderId the content should be created
 * with, creating the folder first when the user chose "new group".
 *
 * Callers MUST await this BEFORE creating their content. That order is the
 * point of the hook: if the folder create fails, nothing is written and the
 * caller's dialog stays open. The reverse order could strand an item whose
 * folder never appeared.
 *
 * A "new" selection with a blank name resolves to undefined (Drafts) rather
 * than creating an untitled folder — hosts gate submit on
 * `isGroupSelectionReady`, so this is a backstop, not the expected path.
 */
export function useResolveGroupSelection(tree: 'sentences' | 'lists') {
  const createFolder = useMutation(api.profileFolders.createFolder);
  const { language } = useProfile();

  return useCallback(
    async (sel: GroupSelection): Promise<Id<'profileFolders'> | undefined> => {
      if (sel.kind === 'folder') return sel.id;
      if (sel.kind === 'drafts') return undefined;
      const name = sel.name.trim();
      if (!name) return undefined;
      // Key the name under the board language and stamp it as the origin
      // language (ADR-020) — same call CreateGroupModal makes, so a group made
      // here is an ordinary folder: colour and cover are set later in edit mode.
      return await createFolder({
        tree,
        name: { [language]: name },
        authoredLanguage: language,
      });
    },
    [createFolder, tree, language],
  );
}
