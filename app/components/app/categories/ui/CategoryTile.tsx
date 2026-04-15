"use client";

import { ImageIcon, Trash2, Pencil, Plus } from 'lucide-react';
import type { Doc, Id } from '@/convex/_generated/dataModel';

type Props = {
  category: Doc<'profileCategories'>;
  language: string;
  isEditing: boolean;
  onClick?: () => void;
  onDeleteRequest: (id: Id<'profileCategories'>, name: string) => void;
};

export function CategoryTile({
  category,
  language,
  isEditing,
  onClick,
  onDeleteRequest,
}: Props) {
  const name =
    language === 'hin' && category.name.hin
      ? category.name.hin
      : category.name.eng;

  // In edit mode the outer element must be a div so action buttons
  // inside are valid HTML (button > button is not allowed).
  const Tag = isEditing ? ('div' as const) : ('button' as const);

  return (
    <Tag
      {...(!isEditing && { type: 'button', onClick })}
      className={[
        'flex flex-col w-full group',
        !isEditing && 'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Folder tab — coloured strip at top-left */}
      <div
        className="self-start h-3 w-2/5 rounded-t-theme-sm"
        style={{ backgroundColor: category.colour }}
      />

      {/* Card body — top-left corner is flush against the tab */}
      <div
        className="w-full bg-theme-card rounded-theme rounded-tl-none p-theme-folder flex flex-col gap-theme-elements transition-opacity group-hover:opacity-90"
        style={
          isEditing
            ? { outline: '2px dashed var(--theme-enter-mode)', outlineOffset: '-2px' }
            : undefined
        }
      >
        {/* Symbol placeholder area */}
        <div className="aspect-square w-full rounded-theme-sm bg-theme-symbol-bg flex items-center justify-center">
          <ImageIcon className="w-1/3 h-1/3 text-theme-secondary-text" />
        </div>

        {/* Category name */}
        <p className="text-theme-s font-medium text-theme-alt-text text-center truncate">
          {name}
        </p>

        {/* Edit mode action row */}
        {isEditing && (
          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => onDeleteRequest(category._id, name)}
              className="p-1.5 rounded-theme-sm transition-colors hover:bg-white/15"
              style={{ color: 'var(--theme-alt-text)' }}
              aria-label={`Delete ${name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-theme-sm transition-colors hover:bg-white/15"
              style={{ color: 'var(--theme-alt-text)' }}
              aria-label={`Edit ${name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-theme-sm transition-colors hover:bg-white/15"
              style={{ color: 'var(--theme-alt-text)' }}
              aria-label={`Add symbols to ${name}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Tag>
  );
}
