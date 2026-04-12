// Pure layout container for SymbolCard instances.
// Reads grid_size from ProfileContext (large=4, medium=8, small=12).
// An explicit `columns` prop overrides the profile setting.

"use client";

import { useProfile } from '@/app/contexts/ProfileContext';

const GRID_SIZE_COLUMNS = { large: 4, medium: 8, small: 12 } as const;

type CategoryBoardGridProps = {
  children: React.ReactNode;
  columns?: number;
};

export function CategoryBoardGrid({ children, columns }: CategoryBoardGridProps) {
  const { stateFlags } = useProfile();
  const cols = columns ?? GRID_SIZE_COLUMNS[stateFlags.grid_size ?? 'large'];

  return (
    <div
      className="grid gap-3 content-start"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
