"use client";

// One component, three modes:
//   "talker"         — talker bar + collapse chevron (Search & Board)
//   "banner"         — collapsed; tapping a symbol plays audio directly
//   "admin-metadata" — category name + edit/add controls (instructor view)
//
// All props/callbacks only — no context dependency.

import { ChevronDown, Edit2, Plus } from 'lucide-react';

export type CategoryHeaderMode = 'talker' | 'banner' | 'admin-metadata';

type BaseProps = {
  mode: CategoryHeaderMode;
};

type TalkerBannerProps = BaseProps & {
  mode: 'talker' | 'banner';
  talkerBar: React.ReactNode;
  showToggle?: boolean;        // driven by talker_banner_toggle state flag
  onToggleMode?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
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
      className="flex flex-col rounded-theme overflow-hidden"
      style={{ background: 'var(--theme-bg-surface-alt)' }}
    >
      {/* Talker bar content — hidden when collapsed */}
      {props.mode === 'talker' && !props.isCollapsed && (
        <div className="px-3 py-3">
          {props.talkerBar}
        </div>
      )}

      {/* Mode toggle (text button, rarely shown) */}
      {props.showToggle && props.onToggleMode && !props.isCollapsed && (
        <div className="flex justify-end px-3 pb-2">
          <button
            type="button"
            onClick={props.onToggleMode}
            className="text-caption px-2.5 py-1 rounded-md"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--theme-nav-text)' }}
          >
            {props.mode === 'talker' ? 'Switch to Banner' : 'Switch to Talker'}
          </button>
        </div>
      )}

      {/* Collapse chevron strip — only rendered when onToggleCollapsed is wired */}
      {props.onToggleCollapsed && (
        <button
          type="button"
          onClick={props.onToggleCollapsed}
          className="flex items-center justify-center py-1.5 w-full transition-colors hover:bg-black/10"
          style={{ color: 'var(--theme-nav-text)' }}
          aria-label={props.isCollapsed ? 'Expand talker' : 'Collapse talker'}
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${props.isCollapsed ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
