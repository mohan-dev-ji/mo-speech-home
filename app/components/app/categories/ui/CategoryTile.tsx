"use client";

import { ImageIcon, Trash2, Move } from 'lucide-react';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';
import { useProfile } from '@/app/contexts/ProfileContext';
import { AdminPackBadge } from '@/app/components/app/shared/ui/packStatusBadge';

// Tile label fluid sizing — clamp(min, cqi, max) reads from the tile's container
// (the aspect-square wrapper marked @container), so the label scales smoothly as
// the tile resizes with viewport, breakpoint, or grid_size column count.
const NAME_FONT_SIZE = {
  large:  'clamp(0.875rem, 6cqi, 1.5rem)',
  medium: 'clamp(0.75rem,  7cqi, 1.125rem)',
  small:  'clamp(0.625rem, 8cqi, 0.875rem)',
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

// Semi-transparent card-colour strip — keeps text readable over the light symbol bg
// color-mix works with CSS variables in all modern browsers
const OVERLAY_BG = 'color-mix(in srgb, var(--theme-card) 88%, transparent)';

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
      className="w-full aspect-square @container"
    >
    <Tag
      {...(!isEditing && { type: 'button', onClick })}
      className={[
        'relative w-full h-full',
        !isEditing && 'cursor-pointer group',
      ].filter(Boolean).join(' ')}
    >
      {/* Admin-view pack-status badge (top-right corner, above all other layers
          including the edit-mode dashed border). */}
      {adminPacks && (
        <div className="absolute top-2 right-2 z-30 pointer-events-none">
          <AdminPackBadge
            publishedToPackId={category.publishedToPackId}
            packs={adminPacks}
          />
        </div>
      )}

      {/* Edit mode: SVG dashed border around the full square tile */}
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

      {/* Inner content — folder padding in edit mode creates gap from dashed border */}
      <div
        className={[
          'w-full h-full flex flex-col',
          isEditing && 'p-theme-folder',
        ].filter(Boolean).join(' ')}
      >
        {/* Folder tab — height scales with tile via cqi, clamped for very small/large tiles */}
        <div
          className="self-start w-[30%] shrink-0 rounded-t-theme-sm"
          style={{
            height: 'clamp(0.75rem, 8cqi, 1.75rem)',
            backgroundColor: colourPair.c500,
          }}
        />

        {/* Card body — dark bg matches the design */}
        <div className="w-full flex-1 min-h-0 bg-theme-card rounded-theme rounded-tl-none overflow-hidden flex flex-col transition-opacity group-hover:opacity-90">

          {/* Category name — fluid font + padding scale with the tile's container size */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{ padding: '3cqi 3cqi 2cqi 3cqi' }}
          >
            <p
              className="font-semibold text-theme-alt-text text-center truncate w-full leading-tight"
              style={{ fontSize: nameFontSize }}
            >
              {name}
            </p>
          </div>

          {/* Symbol — square coloured box, height-first sizing.
              Extra bottom padding gives breathing room between the image and the folder edge. */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
            style={{ padding: '3cqi 3cqi 6cqi' }}
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

          {/* Edit mode action buttons */}
          {isEditing && (
            <div
              className="shrink-0 px-2 py-1.5 flex items-center justify-center gap-3"
              style={{ background: OVERLAY_BG }}
            >
              <button
                type="button"
                onClick={() => onDeleteRequest(category._id, name)}
                className="p-1 rounded-theme-sm transition-colors hover:bg-white/20"
                style={{ color: 'var(--theme-alt-text)' }}
                aria-label={`Delete ${name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1 rounded-theme-sm transition-colors hover:bg-white/20 cursor-grab active:cursor-grabbing touch-none"
                style={{ color: 'var(--theme-alt-text)' }}
                aria-label={`Move ${name}`}
                {...dragHandleProps?.listeners}
                {...dragHandleProps?.attributes}
              >
                <Move className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Tag>
    </ModellingOverlayWrapper>
  );
}
