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
  /** Admin-view flag — gates the "From pack" badge to admin context only. */
  showAdminContext?: boolean;
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
  showAdminContext = false,
  topSlot,
}: Props) {
  // Banner bg = the category's tailwind-500 colour at 30% opacity (a soft tint
  // over the page background), matching the simplified category visual.
  // While `colour` is still loading (undefined on first paint after navigation),
  // render NO tint rather than a hard-coded fallback — a `?? 'orange'` fallback
  // caused an orange flash before the category's colour resolved.
  const bg = colour
    ? `color-mix(in srgb, ${getCategoryColour(colour).c500} 30%, transparent)`
    : 'transparent';

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
        showAdminContext={showAdminContext}
        topSlot={topSlot}
      />
    </div>
  );
}
