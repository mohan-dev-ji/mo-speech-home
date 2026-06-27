"use client";

import { useState, useEffect } from 'react';
import { ImageIcon, Trash2, Move } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { ColourSwatchPicker } from '@/app/components/app/shared/ui/ColourSwatchPicker';
import { getCategoryColour } from '@/app/lib/categoryColours';

const TITLE_FONT_SIZE = {
  large: 'clamp(0.875rem, 6cqi, 1.25rem)',
  medium: 'clamp(0.75rem, 6cqi, 1rem)',
  small: 'clamp(0.625rem, 6cqi, 0.875rem)',
} as const;

type Props = {
  /** Sortable id — the category or folder id. */
  id: string;
  name: string;
  colour?: string;
  imagePath?: string;
  isEditing: boolean;
  /** Grid size for fluid title sizing; defaults to 'large'. */
  gridSize?: 'large' | 'medium' | 'small';
  /** Slot rendered between the image and the edit panel — e.g. an admin badge. */
  badgeSlot?: React.ReactNode;
  onOpen?: () => void;
  /** Inline rename committed from the dashed title box (blur / Enter). */
  onRename?: (value: string) => void;
  /** New colour key from the swatch picker. */
  onRecolour?: (key: string) => void;
  /** Open the Symbol Editor (image only) to pick the folder image. */
  onEditImage?: () => void;
  onDeleteRequest?: () => void;
};

/**
 * Shared group/folder tile (ADR-014) — the single component behind category
 * folders, list groups and sentence groups. In edit mode it carries all the
 * folder-level editing: a dashed inline title, a colour swatch (drives the
 * tile/image colour variants), and a dashed folder-image that opens the Symbol
 * Editor; plus delete + drag-reorder. Out of edit mode it's a tappable tile.
 */
export function GroupTile({
  id,
  name,
  colour,
  imagePath,
  isEditing,
  gridSize = 'large',
  badgeSlot,
  onOpen,
  onRename,
  onRecolour,
  onEditImage,
  onDeleteRequest,
}: Props) {
  const t = useTranslations('group');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const colourPair = getCategoryColour(colour ?? '#6B7280');
  const fontSize = TITLE_FONT_SIZE[gridSize];
  const Tag = isEditing ? ('div' as const) : ('button' as const);

  // Inline title editing — dashed box in edit mode, commit on blur / Enter.
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  function commitName() {
    const v = draft.trim();
    if (v && v !== name) onRename?.(v);
    else setDraft(name);
  }

  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div ref={setNodeRef} style={style}>
      <Tag
        {...(!isEditing && { type: 'button', onClick: onOpen })}
        className={[
          'relative w-full @container flex flex-col items-center justify-center text-center',
          'gap-theme-gap p-theme-folder rounded-theme-card border-2 border-dashed',
          isEditing
            ? 'border-theme-enter-mode'
            : 'border-transparent cursor-pointer group transition-opacity hover:opacity-90',
        ].join(' ')}
        style={{ backgroundColor: `color-mix(in srgb, ${colourPair.c500} 30%, transparent)` }}
      >
        {/* Title */}
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
            aria-label={t('rename')}
            className="w-full text-center text-theme-alt-text font-normal leading-tight rounded-theme-sm px-2 py-1 outline-none"
            style={{ fontSize, background: 'transparent', border: '2px dashed var(--theme-enter-mode)' }}
          />
        ) : (
          <p
            className="w-full text-center text-theme-alt-text font-normal truncate leading-tight"
            style={{ fontSize }}
          >
            {name}
          </p>
        )}

        {/* Folder image — dashed + clickable in edit mode (opens Symbol Editor) */}
        <div
          {...(isEditing && onEditImage
            ? { onClick: (e: React.MouseEvent) => { e.stopPropagation(); onEditImage(); }, role: 'button', 'aria-label': t('editImage') }
            : {})}
          className={[
            'w-full aspect-square rounded-theme-sm flex items-center justify-center overflow-hidden',
            isEditing && onEditImage ? 'cursor-pointer border-2 border-dashed' : '',
          ].join(' ')}
          style={{
            backgroundColor: colourPair.c100,
            padding: '8cqi',
            ...(isEditing && onEditImage ? { borderColor: 'var(--theme-enter-mode)' } : {}),
          }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} className="w-full h-full object-contain" draggable={false} />
          ) : (
            <ImageIcon className="w-1/2 h-1/2" style={{ color: colourPair.c500 }} />
          )}
        </div>

        {badgeSlot}

        {/* Edit controls — colour swatch + delete + reorder */}
        {isEditing && (
          <EditPanel orientation="horizontal" className="flex-wrap">
            {onRecolour && (
              <ColourSwatchPicker
                value={colour ?? '#6B7280'}
                onChange={onRecolour}
                ariaLabel={t('colour')}
              />
            )}
            <IconButton
              size="sm"
              variant="neutral"
              className="text-theme-warning"
              icon={<Trash2 />}
              label={t('delete')}
              onClick={(e) => { e.stopPropagation(); onDeleteRequest?.(); }}
            />
            <IconButton
              size="sm"
              variant="neutral"
              className="cursor-grab active:cursor-grabbing touch-none"
              icon={<Move />}
              label={t('reorder')}
              {...listeners}
              {...attributes}
            />
          </EditPanel>
        )}
      </Tag>
    </div>
  );
}
