"use client";

// Thin page header for category detail — category name, folder image, edit button.
// Separate from the global PersistentTalker (see ADR-004).

import { getCategoryColour } from '@/app/lib/categoryColours';
import { Banner } from '@/app/components/app/shared/ui/Banner';

type Props = {
  categoryName: string;
  imagePath?: string;
  colour?: string;
  onEdit: () => void;
};

export function CategoryPageHeader({ categoryName, imagePath, colour, onEdit }: Props) {
  const bg = getCategoryColour(colour ?? 'orange').c700;

  return (
    <div
      className="relative rounded-theme p-3 min-h-[200px] flex flex-col justify-center"
      style={{ background: bg }}
    >
      <Banner
        categoryName={categoryName}
        imagePath={imagePath}
        colour={colour}
        onEdit={onEdit}
      />
    </div>
  );
}
