"use client";

import { useProfile } from '@/app/contexts/ProfileContext';

type Props = {
  title: string;
  /**
   * Optional override for the default `<h1>` rendering. Lets edit-mode
   * affordances (e.g. an inline editable input with dashed outline) sit
   * in the title slot without forking the banner shell. When omitted,
   * the default static `<h1>` renders.
   */
  titleSlot?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageBanner({ title, titleSlot, children }: Props) {
  const { viewMode, stateFlags } = useProfile();

  // In student-view, banner action buttons are hidden unless instructor has granted edit access.
  const showChildren = viewMode !== 'student-view' || stateFlags.student_can_edit;

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-theme-general bg-theme-card rounded-theme">
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {titleSlot ?? (
          <h1
            className="text-theme-h3 font-bold leading-tight truncate"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {title}
          </h1>
        )}
        {showChildren && children && (
          <div className="flex items-center flex-wrap gap-2 mt-3">
            {children}
          </div>
        )}
      </div>

    </div>
  );
}
