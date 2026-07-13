"use client";

import { useState, useEffect } from 'react';
import { ImageIcon, Trash2, Move, Upload, RefreshCw, Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';
import { EditPanel } from '@/app/components/app/shared/ui/EditPanel';
import { ColourSwatchPicker } from '@/app/components/app/shared/ui/ColourSwatchPicker';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';
import { translateTexts } from '@/lib/languages/translateClient';

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
  /**
   * When true, `onOpen` also fires from a tap on the tile body IN edit mode
   * (default: edit-mode tiles don't open). The rename input, folder-image box
   * and edit-panel buttons all stopPropagation, so only an empty-body tap
   * drills in. Used by the talker dropdown's core groups, where folder editing
   * and content editing share one surface.
   */
  allowOpenInEditMode?: boolean;
  /** Inline rename committed from the dashed title box (blur / Enter). */
  onRename?: (value: string) => void;
  /**
   * ADR-016 Addendum D — the full localised name record + board language. When
   * both are set and the board-language key is empty, edit mode shows a translate
   * icon that MT-fills the name into the still-editable rename input. Omit to hide
   * the affordance (names never auto-translate).
   */
  nameRecord?: Record<string, string>;
  language?: string;
  /** New colour key from the swatch picker. */
  onRecolour?: (key: string) => void;
  /** Open the Symbol Editor (image only) to pick the folder image. */
  onEditImage?: () => void;
  onDeleteRequest?: () => void;
  /** Admin-only: publish this folder as a content module (ADR-014 Task B). */
  onPublishRequest?: () => void;
  /** True when this source is already published as a module → show Update look. */
  published?: boolean;
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
  allowOpenInEditMode,
  onRename,
  onRecolour,
  onEditImage,
  onDeleteRequest,
  onPublishRequest,
  published,
  nameRecord,
  language,
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

  // ADR-016 Addendum D — MT-fill the name into the still-editable input when the
  // board-language key is empty. Names never auto-translate; this is an explicit,
  // per-language, on-demand action the instructor can then correct on their
  // keyboard (commit on blur/Enter saves it under the board language).
  const [translating, setTranslating] = useState(false);
  const showTranslate = !!(language && nameRecord && !nameRecord[language]?.trim());
  async function handleTranslateName() {
    if (!language || !nameRecord) return;
    const src = displayString(nameRecord, language, DEFAULT_LOCALE);
    if (!src) return;
    setTranslating(true);
    try {
      const [translated] = await translateTexts([src], language);
      if (translated) setDraft(translated);
    } catch {
      /* leave the input as-is; the instructor can type it manually */
    } finally {
      setTranslating(false);
    }
  }

  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div ref={setNodeRef} style={style}>
      <Tag
        {...(!isEditing
          ? { type: 'button' as const, onClick: onOpen }
          : allowOpenInEditMode && onOpen
            ? { onClick: onOpen }
            : {})}
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
          <div className="w-full flex items-center gap-1">
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
              className="flex-1 min-w-0 text-center text-theme-alt-text font-normal leading-tight rounded-theme-sm px-2 py-1 outline-none"
              style={{ fontSize, background: 'transparent', border: '2px dashed var(--theme-enter-mode)' }}
            />
            {/* ADR-016 Addendum D — translate the name into the board language when
                its key is empty; fills the still-editable input. */}
            {showTranslate && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleTranslateName(); }}
                disabled={translating}
                aria-label={t('translateName')}
                title={t('translateName')}
                className="shrink-0 p-1.5 rounded-theme-sm transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ color: 'var(--theme-alt-text)', border: '1px solid var(--theme-enter-mode)' }}
              >
                <Languages className={`w-4 h-4 ${translating ? 'animate-pulse' : ''}`} />
              </button>
            )}
          </div>
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
            {onPublishRequest && (
              <IconButton
                size="sm"
                variant="neutral"
                className={published ? 'text-theme-primary' : undefined}
                icon={published ? <RefreshCw /> : <Upload />}
                label={published ? t('updateModule') : t('publish')}
                onClick={(e) => { e.stopPropagation(); onPublishRequest(); }}
              />
            )}
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
