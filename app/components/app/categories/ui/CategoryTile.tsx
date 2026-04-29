"use client";

import { ImageIcon, Trash2, Move } from 'lucide-react';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { ModellingOverlayWrapper } from '@/app/components/shared/ModellingOverlayWrapper';

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
}: Props) {
  const name =
    language === 'hin' && category.name.hin
      ? category.name.hin
      : category.name.eng;

  const colourPair = getCategoryColour(category.colour);
  const Tag = isEditing ? ('div' as const) : ('button' as const);

  return (
    <ModellingOverlayWrapper
      componentKey={`category-tile-${category._id}`}
      className="w-full aspect-square"
    >
    <Tag
      {...(!isEditing && { type: 'button', onClick })}
      className={[
        'relative w-full h-full',
        !isEditing && 'cursor-pointer group',
      ].filter(Boolean).join(' ')}
    >
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
        {/* Folder tab */}
        <div
          className="self-start h-6 w-[30%] shrink-0 rounded-t-theme-sm"
          style={{ backgroundColor: colourPair.c500 }}
        />

        {/* Card body — dark bg matches the design */}
        <div className="w-full flex-1 min-h-0 bg-theme-card rounded-theme rounded-tl-none overflow-hidden flex flex-col transition-opacity group-hover:opacity-90">

          {/* Category name — top of card, text scales up on smaller screens */}
          <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-center">
            <p className="text-theme-h3 md:text-theme-h4 lg:text-theme-large font-semibold text-theme-alt-text text-center truncate w-full leading-tight">
              {name}
            </p>
          </div>

          {/* Symbol — square coloured box, height-first sizing */}
          <div className="flex-1 min-h-0 p-3 flex items-center justify-center overflow-hidden">
            <div
              className="aspect-square h-full max-w-full rounded-theme flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: colourPair.c100 }}
            >
              {category.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/assets?key=${category.imagePath}`}
                  alt={name}
                  className="w-full h-full object-contain p-2"
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
