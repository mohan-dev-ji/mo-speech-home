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
  onModel?: () => void;
  modelDisabledReason?: string;
  librarySourceId?: string;
  /** Optional slot rendered at the top of the banner card, above the
   *  title. Used to surface the admin pack-status label in admin view. */
  topSlot?: React.ReactNode;
};

export function CategoryPageHeader({
  categoryName,
  imagePath,
  colour,
  onEdit,
  onModel,
  modelDisabledReason,
  librarySourceId,
  topSlot,
}: Props) {
  const bg = getCategoryColour(colour ?? 'orange').c700;

  return (
    <div
      className="relative rounded-theme p-3 min-h-[200px] flex flex-col justify-center"
      style={{ background: bg }}
    >
      {/* topSlot threads down to Banner so it sits tight above the title
          inside the left column — keeps the right-column image centered
          against the whole [slot + title + buttons] group. */}
      <Banner
        categoryName={categoryName}
        imagePath={imagePath}
        colour={colour}
        onEdit={onEdit}
        onModel={onModel}
        modelDisabledReason={modelDisabledReason}
        librarySourceId={librarySourceId}
        topSlot={topSlot}
      />
    </div>
  );
}
