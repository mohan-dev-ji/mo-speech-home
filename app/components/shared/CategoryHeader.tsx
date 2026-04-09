"use client";

// One component, three modes:
//   "talker"         — talker bar + optional banner toggle (Search & Board)
//   "banner"         — collapsed; tapping a symbol plays audio directly
//   "admin-metadata" — category name + edit/add controls (instructor view)
//
// All props/callbacks only — no context dependency.

import { Edit2, Plus } from 'lucide-react';

export type CategoryHeaderMode = 'talker' | 'banner' | 'admin-metadata';

type BaseProps = {
  mode: CategoryHeaderMode;
};

type TalkerBannerProps = BaseProps & {
  mode: 'talker' | 'banner';
  talkerBar: React.ReactNode;
  showToggle?: boolean;        // driven by talker_banner_toggle state flag
  onToggleMode?: () => void;
};

type AdminMetadataProps = BaseProps & {
  mode: 'admin-metadata';
  categoryName: string;
  onEdit?: () => void;
  onAdd?: () => void;
};

type CategoryHeaderProps = TalkerBannerProps | AdminMetadataProps;

export function CategoryHeader(props: CategoryHeaderProps) {
  if (props.mode === 'admin-metadata') {
    return (
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--theme-bg-surface-alt)', color: 'var(--theme-nav-text)' }}
      >
        <h1 className="text-subheading font-bold">{props.categoryName}</h1>
        <div className="flex items-center gap-2">
          {props.onEdit && (
            <button
              type="button"
              onClick={props.onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-small font-medium"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--theme-nav-text)' }}
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {props.onAdd && (
            <button
              type="button"
              onClick={props.onAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-small font-medium"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--theme-nav-text)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>
    );
  }

  // talker / banner mode
  return (
    <div
      className="flex flex-col"
      style={{ background: 'var(--theme-talker-bg)' }}
    >
      {props.mode === 'talker' && (
        <div className="px-3 py-2">
          {props.talkerBar}
        </div>
      )}
      {props.showToggle && props.onToggleMode && (
        <div className="flex justify-end px-3 pb-2">
          <button
            type="button"
            onClick={props.onToggleMode}
            className="text-caption px-2.5 py-1 rounded-md"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--theme-talker-text)' }}
          >
            {props.mode === 'talker' ? 'Switch to Banner' : 'Switch to Talker'}
          </button>
        </div>
      )}
    </div>
  );
}
