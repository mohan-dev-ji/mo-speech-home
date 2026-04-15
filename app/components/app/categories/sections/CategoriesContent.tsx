"use client";

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { Edit2, Save, Plus } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useProfile } from '@/app/contexts/ProfileContext';
import { CategoryTile } from '@/app/components/app/categories/ui/CategoryTile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/app/components/shared/ui/Dialog';

type PendingDelete = { id: Id<'profileCategories'>; name: string } | null;

export function CategoriesContent() {
  const t = useTranslations('categories');
  const { activeProfileId, language } = useProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categories = useQuery(
    api.profileCategories.getProfileCategories,
    activeProfileId ? { profileId: activeProfileId } : 'skip',
  );

  const deleteCategoryMutation = useMutation(api.profileCategories.deleteCategory);

  function handleDeleteRequest(id: Id<'profileCategories'>, name: string) {
    setPendingDelete({ id, name });
  }

  async function handleDeleteConfirm() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteCategoryMutation({ profileCategoryId: pendingDelete.id });
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="p-theme-general flex flex-col gap-theme-gap">

      {/* Page header */}
      <div className="rounded-theme bg-theme-card px-theme-item py-theme-item flex flex-col gap-theme-elements">
        <h1 className="text-theme-h4 font-semibold text-theme-alt-text">{t('title')}</h1>
        <div className="flex items-center gap-theme-elements">

          {/* Edit / Save toggle */}
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--theme-alt-text)' }}
          >
            {isEditing ? (
              <>
                <Save className="w-3.5 h-3.5" />
                {t('save')}
              </>
            ) : (
              <>
                <Edit2 className="w-3.5 h-3.5" />
                {t('edit')}
              </>
            )}
          </button>

          {/* Add — always visible */}
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--theme-alt-text)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('add')}
          </button>
        </div>
      </div>

      {/* Loading */}
      {categories === undefined && activeProfileId && (
        <p className="text-theme-s text-theme-secondary-alt-text">{t('loading')}</p>
      )}

      {/* No profile */}
      {!activeProfileId && (
        <p className="text-theme-s text-theme-secondary-alt-text">{t('noProfile')}</p>
      )}

      {/* Category grid */}
      {categories && categories.length > 0 && (
        <div className="grid grid-cols-4 gap-theme-gap">
          {categories.map((cat) => (
            <CategoryTile
              key={cat._id}
              category={cat}
              language={language}
              isEditing={isEditing}
              onDeleteRequest={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirm', { name: pendingDelete?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-colors"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--theme-text)' }}
              >
                {t('cancel')}
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            >
              {isDeleting ? t('deleting') : t('delete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
