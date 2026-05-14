"use client";

import { ImageIcon, Trash2, Move } from 'lucide-react';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';
import { useProfile } from '@/app/contexts/ProfileContext';
import { PackStatusLabel } from '@/app/components/app/shared/ui/packStatusBadge';

// Tile label fluid sizing — clamp(min, cqi, max) reads from the tile's container
// (the aspect-square wrapper marked @container), so the label scales smoothly as
// the tile resizes with viewport, breakpoint, or grid_size column count.
// Tuned for the folder-tab band (smaller than the old in-body label area).
const NAME_FONT_SIZE = {
  large:  'clamp(0.625rem, 5cqi,   1rem)',
  medium: 'clamp(0.5rem,   5.5cqi, 0.875rem)',
  small:  'clamp(0.5rem,   6cqi,   0.75rem)',
} as const;

type AdminPacksStatus = {
  starterPackId: Id<'resourcePacks'> | null;
  libraryPacksById: Record<
    string,
    { tier: 'free' | 'pro' | 'max'; name: { eng: string; hin?: string } }
  >;
};

type Props = {
  category: Doc<'profileCategories'>;
  language: string;
  isEditing: boolean;
  onClick?: () => void;
  onDeleteRequest: (id: Id<'profileCategories'>, name: string) => void;
  dragHandleProps?: {
    listeners?: SyntheticListenerMap;
    attributes?: DraggableAttributes;
  };
  // Optional — only passed when viewMode === 'admin'. When set, renders a small
  // pack-status badge in the top-right corner of the tile.
  adminPacks?: AdminPacksStatus;
};

export function CategoryTile({
  category,
  language,
  isEditing,
  onClick,
  onDeleteRequest,
  dragHandleProps,
  adminPacks,
}: Props) {
  const name =
    language === 'hin' && category.name.hin
      ? category.name.hin
      : category.name.eng;

  const colourPair = getCategoryColour(category.colour);
  const Tag = isEditing ? ('div' as const) : ('button' as const);

  const { stateFlags } = useProfile();
  const nameFontSize = NAME_FONT_SIZE[stateFlags.grid_size ?? 'large'];

  return (
    <ModellingOverlayWrapper
      componentKey={`category-tile-${category._id}`}
      // The wrapper is square in non-edit mode; in edit mode the wrapper
      // grows taller to accommodate the action-button row below the folder
      // (the symbol image keeps its full square space). The @container query
      // anchors `cqi`-based sizing to inline-size (width), so font/symbol
      // dimensions stay consistent across both modes.
      className="w-full @container"
    >
    <Tag
      {...(!isEditing && { type: 'button', onClick })}
      className={[
        'relative w-full',
        !isEditing && 'cursor-pointer group',
      ].filter(Boolean).join(' ')}
    >
      {/* Edit mode: SVG dashed border wraps the entire tile (folder + button row) */}
      {isEditing && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <rect
            x="2"
            y="2"
            rx="16"
            ry="16"
            style={{
              width: 'calc(100% - 4px)',
              height: 'calc(100% - 4px)',
              fill: 'none',
              stroke: 'var(--theme-enter-mode)',
              strokeWidth: 4,
              strokeDasharray: '12 6',
            }}
          />
        </svg>
      )}

      {/* Inner content — folder padding in edit mode creates gap from the
          dashed border. The folder stays square; edit buttons sit below it. */}
      <div
        className={[
          'w-full flex flex-col',
          isEditing && 'p-theme-folder px-3 py-3 gap-2',
        ].filter(Boolean).join(' ')}
      >
        {/* Folder (always square) — tab + card body */}
        <div className="w-full aspect-square flex flex-col">
          {/* Folder tab — holds the category name; width auto-sizes to text within
              min/max bounds so the folder-tab silhouette is preserved. Height + font
              scale with tile via cqi.
              Tab background mixes the saturated category colour with the
              page bg so the white label keeps enough contrast on the
              brighter palettes (yellow / lime / amber) — pure c500 was
              too washed out under white text. */}
          <div
            className="self-start w-fit min-w-[40%] max-w-[85%] shrink-0 rounded-t-theme-sm flex items-center justify-center"
            style={{
              height: 'clamp(1rem, 10cqi, 2rem)',
              padding: '0 4cqi',
              backgroundColor: `color-mix(in srgb, ${colourPair.c500} 50%, transparent)`,
            }}
          >
            <p
              className="font-semibold text-white text-center truncate leading-tight"
              style={{ fontSize: nameFontSize }}
            >
              {name}
            </p>
          </div>

          {/* Card body — same 50%-saturated category-colour mix as the
              folder tab above, so the tab and body read as one continuous
              coloured surface. The inner symbol box keeps its pale c100
              tint so the image still pops against the body. */}
          <div
            className="w-full flex-1 min-h-0 rounded-theme rounded-tl-none overflow-hidden flex flex-col transition-opacity group-hover:opacity-90"
            style={{
              backgroundColor: `color-mix(in srgb, ${colourPair.c500} 50%, transparent)`,
            }}
          >

            {/* Symbol — square coloured box, height-first sizing.
                Symbol flex-shrinks when the admin pack-status label is rendered
                below it, so the label always has room. Top padding bumps when
                the admin label is present to visually balance the extra space
                the label adds below; in instructor view top + bottom match. */}
            <div
              className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
              style={{ padding: adminPacks ? '7cqi 3cqi 3cqi' : '5cqi 3cqi 5cqi' }}
            >
              <div
                className="aspect-square h-full max-w-full rounded-theme flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: colourPair.c100 }}
              >
                {category.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/assets?key=${category.imagePath}`}
                    alt={name}
                    className="w-full h-full object-contain"
                    style={{ padding: '2cqi' }}
                    draggable={false}
                  />
                ) : (
                  <ImageIcon className="w-1/2 h-1/2" style={{ color: colourPair.c500 }} />
                )}
              </div>
            </div>

            {/* Admin-only pack-status label — sits inside the folder card under
                the symbol. Symbol flex-shrinks above to make room. */}
            {adminPacks && (
              <div
                className="shrink-0 flex items-center justify-center"
                style={{ padding: '0 3cqi 4cqi' }}
              >
                <PackStatusLabel
                  publishedToPackId={category.publishedToPackId}
                  packs={adminPacks}
                  language={language}
                />
              </div>
            )}
          </div>
        </div>

        {/* Edit-mode action buttons — sit BELOW the folder so they don't
            squeeze the symbol image. Wrapped by the dashed border above.
            Gap, padding, and icon size scale with tile width via cqi so
            they stay inside the dashed border on small grid sizes. */}
        {isEditing && (
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ gap: 'clamp(0.25rem, 2cqi, 0.75rem)' }}
          >
            <button
              type="button"
              onClick={() => onDeleteRequest(category._id, name)}
              className="rounded-theme-sm transition-colors hover:bg-white/10"
              style={{
                color: 'var(--theme-warning)',
                padding: 'clamp(0.125rem, 1.5cqi, 0.375rem)',
              }}
              aria-label={`Delete ${name}`}
            >
              <Trash2 style={{ width: 'clamp(0.625rem, 4cqi, 1rem)', height: 'clamp(0.625rem, 4cqi, 1rem)' }} />
            </button>
            <button
              type="button"
              className="rounded-theme-sm transition-colors hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none"
              style={{
                color: 'var(--theme-text-primary)',
                padding: 'clamp(0.125rem, 1.5cqi, 0.375rem)',
              }}
              aria-label={`Move ${name}`}
              {...dragHandleProps?.listeners}
              {...dragHandleProps?.attributes}
            >
              <Move style={{ width: 'clamp(0.625rem, 4cqi, 1rem)', height: 'clamp(0.625rem, 4cqi, 1rem)' }} />
            </button>
          </div>
        )}
      </div>
    </Tag>
    </ModellingOverlayWrapper>
  );
}
