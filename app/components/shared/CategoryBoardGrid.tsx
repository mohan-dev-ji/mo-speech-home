// Pure layout container for SymbolCard instances.
// Reads grid_size from ProfileContext and applies responsive column counts:
//   large  → 1 col (mobile) / 2 cols (md) / 4 cols (lg+)
//   medium → 2 cols (mobile) / 4 cols (md) / 8 cols (lg+)
//   small  → 4 cols (mobile) / 8 cols (md) / 12 cols (lg+)
// An explicit `columns` prop bypasses profile and breakpoint logic.

"use client";

import { useProfile } from '@/app/contexts/ProfileContext';

const GRID_SIZE_CLASSES = {
  large:  'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  medium: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8',
  small:  'grid-cols-4 md:grid-cols-8 lg:grid-cols-12',
} as const;

type CategoryBoardGridProps = {
  children: React.ReactNode;
  columns?: number;
};

export function CategoryBoardGrid({ children, columns }: CategoryBoardGridProps) {
  const { stateFlags } = useProfile();

  if (columns !== undefined) {
    return (
      <div
        className="grid gap-3 content-start"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 content-start ${GRID_SIZE_CLASSES[stateFlags.grid_size ?? 'large']}`}>
      {children}
    </div>
  );
}
