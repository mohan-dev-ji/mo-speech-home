"use client";

import { useState, useEffect } from 'react';
import { ImageIcon, Trash2, Move, Upload, RefreshCw } from 'lucide-react';
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
import { TranslateRevertControl } from '@/app/components/app/shared/ui/TranslateRevertControl';
import { UseOriginalConfirmDialog } from '@/app/components/app/shared/ui/UseOriginalConfirmDialog';
import { labelTranslateState } from '@/lib/languages/variants';

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
   * both are set, EDIT mode shows an inline translate/revert control right of
   * the title input (Figma 3017-2352): untranslated → one-tap MT-fill via
   * `onRename`; translated → revert (confirm, then `onRevert` strips the key).
   * Omit to hide the affordance (names never auto-translate).
   */
  nameRecord?: Record<string, string>;
  language?: string;
  /** Strip the board-language key from the name record (parent owns the mutation). */
  onRevert?: () => void;
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
  onRevert,
}: Props) {
  const t = useTranslations('group');
  const tTranslate = useTranslations('translate');
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

  // Edit-mode one-tap translate: MT-fill the name into the board language and
  // persist via the parent's rename. (No modal — the title input IS the manual path.)
  const [revertOpen, setRevertOpen] = useState(false);
  async function handleTranslate() {
    if (!language || !nameRecord) return;
    // Clicking the control blurs the title input first (commitName → onRename),
    // so `nameRecord` here can still be the stale pre-commit prop. Prefer the
    // live `draft` when it's a real, uncommitted edit so the just-typed text is
    // what gets translated, not whatever `onRename` raced in with.
    const typedDraft = draft.trim();
    const src = typedDraft && typedDraft !== name
      ? typedDraft
      : displayString(nameRecord, language, DEFAULT_LOCALE);
    if (!src) return;
    const [translated] = await translateTexts([src], language);
    if (translated) onRename?.(translated);
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
        {/* Title (+ edit-mode translate/revert control, inline right — Figma 3017-2352) */}
        {isEditing ? (
          <div className="w-full flex items-center gap-theme-gap" onClick={(e) => e.stopPropagation()}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                else if (e.key === 'Escape') { setDraft(name); e.currentTarget.blur(); }
              }}
              aria-label={t('rename')}
              className="flex-1 min-w-0 text-center text-theme-alt-text font-normal leading-tight rounded-theme-sm px-2 py-1 outline-none"
              style={{ fontSize, background: 'transparent', border: '2px dashed var(--theme-enter-mode)' }}
            />
            {language && nameRecord && (
              <TranslateRevertControl
                state={labelTranslateState(nameRecord, language)}
                onTranslate={() => void handleTranslate()}
                onRevert={() => setRevertOpen(true)}
                translateLabel={tTranslate('controlTranslateLabel', { lang: language.toUpperCase() })}
                revertLabel={tTranslate('controlRevertLabel')}
              />
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

      <UseOriginalConfirmDialog
        open={revertOpen}
        onOpenChange={setRevertOpen}
        name={name}
        onConfirm={() => { setRevertOpen(false); onRevert?.(); }}
      />
    </div>
  );
}
