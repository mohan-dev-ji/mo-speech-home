"use client";

import { useState, useEffect } from 'react';
import { ImageIcon, Trash2, Move } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DraggableAttributes } from '@dnd-kit/core';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { ModellingOverlayWrapper } from '@/app/components/app/shared/ui/ModellingOverlayWrapper';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { PackStatusLabel } from '@/app/components/app/shared/ui/packStatusBadge';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';

// Tile title fluid sizing — clamp(min, cqi, max) reads from the tile's container
// (the @container wrapper), so the title scales smoothly as the tile resizes with
// viewport, breakpoint, or grid_size column count. The caps approach the Figma
// 20px (text-theme-large) on the wide `large` grid and step down for denser grids.
const NAME_FONT_SIZE = {
  large:  'clamp(0.875rem, 6cqi, 1.25rem)',
  medium: 'clamp(0.75rem,  6cqi, 1rem)',
  small:  'clamp(0.625rem, 6cqi, 0.875rem)',
} as const;

type AdminPacksStatus = {
  starterSlug: string;
  libraryPacksBySlug: Record<
    string,
    { tier: 'free' | 'pro' | 'max'; name: Record<string, string> }
  >;
};

type Props = {
  category: Doc<'profileCategories'>;
  language: string;
  isEditing: boolean;
  onClick?: () => void;
  onDeleteRequest: (id: Id<'profileCategories'>, name: string) => void;
  /** Inline rename committed from the edit-mode dashed title box. */
  onRename?: (id: Id<'profileCategories'>, value: string) => void;
  dragHandleProps?: {
    listeners?: SyntheticListenerMap;
    attributes?: DraggableAttributes;
  };
  // Optional — only passed when viewMode === 'admin'. When set, renders the
  // pack-status label below the thumbnail.
  adminPacks?: AdminPacksStatus;
};

export function CategoryTile({
  category,
  language,
  isEditing,
  onClick,
  onDeleteRequest,
  onRename,
  dragHandleProps,
  adminPacks,
}: Props) {
  const t = useTranslations('categories');
  const name = displayString(category.name, language, DEFAULT_LOCALE);

  // Inline title editing — in edit mode the title becomes a dashed text box,
  // committing on blur/Enter (ADR-014 unified group/tile edit UX).
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename?.(category._id, v);
    else setDraft(name);
  }

  const colourPair = getCategoryColour(category.colour);
  const Tag = isEditing ? ('div' as const) : ('button' as const);

  const { stateFlags } = useProfile();
  const nameFontSize = NAME_FONT_SIZE[stateFlags.grid_size ?? 'large'];

  return (
    <ModellingOverlayWrapper
      componentKey={`category-tile-${category._id}`}
      // @container anchors the `cqi`-based title sizing to the tile width. The
      // tile keeps a fixed width (grid-driven) and grows TALLER in edit mode as
      // the edit-panel is added below — width never changes, so grid settings hold.
      className="w-full @container"
    >
      <Tag
        {...(!isEditing && { type: 'button', onClick })}
        // New Figma Category-tile (3017:2352): soft category-tinted card (c500 @ 30%,
        // same as the detail banner), no folder shape, no source tag. Edit mode adds
        // a subtle stroke-2 dashed border fixed to the tile (transparent when idle →
        // no layout shift) and injects the Edit-panel below the thumb.
        className={[
          'relative w-full flex flex-col items-center justify-center text-center',
          'gap-theme-gap p-theme-folder rounded-theme-card border-2 border-dashed',
          isEditing ? 'border-theme-enter-mode' : 'border-transparent',
          !isEditing && 'cursor-pointer group transition-opacity hover:opacity-90',
        ].filter(Boolean).join(' ')}
        style={{ backgroundColor: `color-mix(in srgb, ${colourPair.c500} 30%, transparent)` }}
      >
        {/* Title — plain centred text; in edit mode a dashed editable box. */}
        {isEditing ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={t('rename', { name })}
            className="w-full text-center text-theme-alt-text font-normal leading-tight rounded-theme-sm px-2 py-1 outline-none"
            style={{ fontSize: nameFontSize, background: 'transparent', border: '2px dashed var(--theme-enter-mode)' }}
          />
        ) : (
          <p
            className="w-full text-center text-theme-alt-text font-normal truncate leading-tight"
            style={{ fontSize: nameFontSize }}
          >
            {name}
          </p>
        )}

        {/* Thumb — light c100 box holding the category image (or fallback icon). */}
        <div
          className="w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: colourPair.c100, padding: '8cqi' }}
        >
          {category.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/assets?key=${category.imagePath}`}
              alt={name}
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : (
            <ImageIcon className="w-1/2 h-1/2" style={{ color: colourPair.c500 }} />
          )}
        </div>

        {/* Admin-only pack-status label — the public "From pack" tag is gone, but
            the admin badge stays. Slots between thumb and edit-panel. */}
        {adminPacks && (
          <div className="w-full flex items-center justify-center">
            <PackStatusLabel
              packSlug={category.librarySourceId}
              packs={adminPacks}
              language={language}
            />
          </div>
        )}

        {/* Edit-panel — Delete + Move 32² icon-buttons. `flex-wrap` keeps the
            tile width fixed: when a dense-grid tile is too narrow for both in a
            row, the second wraps below (tile grows taller, never wider). */}
        {isEditing && (
          <EditPanel orientation="horizontal" className="flex-wrap">
            <IconButton
              size="sm"
              variant="neutral"
              className="text-theme-warning"
              icon={<Trash2 />}
              label={t('deleteCategory', { name })}
              onClick={() => onDeleteRequest(category._id, name)}
            />
            <IconButton
              size="sm"
              variant="neutral"
              className="cursor-grab active:cursor-grabbing touch-none"
              icon={<Move />}
              label={t('moveCategory', { name })}
              {...dragHandleProps?.listeners}
              {...dragHandleProps?.attributes}
            />
          </EditPanel>
        )}
      </Tag>
    </ModellingOverlayWrapper>
  );
}
