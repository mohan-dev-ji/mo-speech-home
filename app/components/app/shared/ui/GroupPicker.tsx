"use client";

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { useTranslations } from 'next-intl';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';

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

type Props = {
  tree: 'sentences' | 'lists';
  value: GroupSelection;
  onChange: (next: GroupSelection) => void;
};

/**
 * "Where does this go?" — the tree's folders, Drafts, and an inline new group.
 * Shared by the talker's save dialog and Home's two create modals so the
 * question looks and behaves the same wherever content is created.
 */
export function GroupPicker({ tree, value, onChange }: Props) {
  const t = useTranslations('groupPicker');
  const { language } = useProfile();
  const folders = useQuery(api.profileFolders.getProfileFolders, { tree });
  // Kept across a toggle away and back, so a mistyped name isn't lost.
  const [newName, setNewName] = useState('');

  const rowStyle = (selected: boolean) => ({
    background: selected ? 'var(--theme-primary)' : 'var(--theme-symbol-bg)',
    color: selected ? 'var(--theme-alt-text)' : 'var(--theme-text)',
    border: `2px solid ${selected ? 'var(--theme-primary)' : 'transparent'}`,
  });

  const rowClass = 'text-left px-3 py-2.5 rounded-theme-sm text-theme-s font-medium transition-colors';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-theme-s font-medium" style={{ color: 'var(--theme-text)' }}>
        {t('label')}
      </label>

      <div className="flex flex-col gap-2 max-h-[40vh] overflow-auto">
        {(folders ?? []).map((f) => {
          const selected = value.kind === 'folder' && value.id === f._id;
          return (
            <button
              key={f._id}
              type="button"
              onClick={() => onChange({ kind: 'folder', id: f._id })}
              className={rowClass}
              style={rowStyle(selected)}
            >
              {displayString(f.name, language, DEFAULT_LOCALE)}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChange({ kind: 'drafts' })}
          className={rowClass}
          style={rowStyle(value.kind === 'drafts')}
        >
          {t('drafts')}
        </button>

        <button
          type="button"
          onClick={() => onChange({ kind: 'new', name: newName })}
          className={rowClass}
          style={rowStyle(value.kind === 'new')}
        >
          {t('newGroup')}
        </button>

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
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          />
        )}
      </div>
    </div>
  );
}
