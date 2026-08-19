"use client";

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { Select } from '@/app/components/app/shared/ui/Select';

/**
 * Where a newly created thing should go. The picker REPORTS this; it never
 * writes. `useResolveGroupSelection` turns it into a folderId, creating the
 * folder when kind === 'new' — that ordering (folder first, then content) lives
 * in one place so a failed create can't strand an item.
 */
export type GroupSelection =
  | { kind: 'folder'; id: Id<'profileFolders'> }
  | { kind: 'drafts' }
  | { kind: 'new'; name: string };

/** The default every host opens on, and what "sort it later" means. */
export const DRAFTS_SELECTION: GroupSelection = { kind: 'drafts' };

/** A host's submit stays disabled until this is true. */
export function isGroupSelectionReady(sel: GroupSelection): boolean {
  return sel.kind === 'new' ? sel.name.trim().length > 0 : true;
}

// Sentinel option values. Folder options carry their real id, so these two only
// have to avoid colliding with a Convex id.
const DRAFTS_VALUE = '__drafts';
const NEW_VALUE = '__new';

type Props = {
  tree: 'sentences' | 'lists';
  value: GroupSelection;
  onChange: (next: GroupSelection) => void;
};

/**
 * "Where does this go?" — the tree's folders, Drafts, and an inline new group.
 * Shared by the talker's save dialog and Home's two create modals so the
 * question looks and behaves the same wherever content is created.
 *
 * A single <select> rather than a row per folder: a profile with a dozen groups
 * pushed the create modals past the viewport and cut off the footer buttons.
 * Same shape as the symbol editor's category picker.
 */
export function GroupPicker({ tree, value, onChange }: Props) {
  const t = useTranslations('groupPicker');
  const { language } = useProfile();
  const folders = useQuery(api.profileFolders.getProfileFolders, { tree });
  // Kept across a toggle away and back, so a mistyped name isn't lost.
  const [newName, setNewName] = useState('');

  const selectValue =
    value.kind === 'folder' ? value.id : value.kind === 'new' ? NEW_VALUE : DRAFTS_VALUE;

  function handleSelect(next: string) {
    if (next === DRAFTS_VALUE) onChange({ kind: 'drafts' });
    else if (next === NEW_VALUE) onChange({ kind: 'new', name: newName });
    else onChange({ kind: 'folder', id: next as Id<'profileFolders'> });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
        {t('label')}
      </label>

      <Select value={selectValue} onChange={(e) => handleSelect(e.target.value)}>
        <option value={DRAFTS_VALUE}>{t('drafts')}</option>
        {(folders ?? []).map((f) => (
          <option key={f._id} value={f._id}>
            {displayString(f.name, language, DEFAULT_LOCALE)}
          </option>
        ))}
        <option value={NEW_VALUE}>{t('newGroup')}</option>
      </Select>

      {value.kind === 'new' && (
        <input
          type="text"
          value={newName}
          autoFocus
          onChange={(e) => {
            setNewName(e.target.value);
            onChange({ kind: 'new', name: e.target.value });
          }}
          placeholder={t('newGroupPlaceholder')}
          className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
          style={{
            background: 'var(--theme-symbol-bg)',
            color: 'var(--theme-text)',
            border: '1px solid var(--theme-line)',
          }}
        />
      )}
    </div>
  );
}
