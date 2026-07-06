"use client";

import Link from 'next/link';
import { Pointer, ImageIcon, ChevronLeft, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { EditButton } from '@/app/components/app/shared/ui/EditButton';
import { Button } from '@/app/components/app/shared/ui/Button';

type BannerProps = {
  categoryName: string;
  imagePath?: string;
  colour?: string;
  onEdit?: () => void;
  onModel?: () => void;
  modelDisabledReason?: string;
  /** Admin-only: open the tier picker to publish this category as a module.
   *  Rendered inline with the Edit/Model buttons. Parent passes it only in
   *  admin view. */
  onPublishModule?: () => void;
  /** Label for the publish button — "Publish as module" or "Update module". */
  publishModuleLabel?: string;
  /** Optional slot rendered above the title inside the left column.
   *  Sits tight to the title (small mb) so the right-column image stays
   *  vertically centered against the [slot + title + buttons] group as
   *  a whole. Used to surface the admin pack-status label. */
  topSlot?: React.ReactNode;
  /** When set, a back chevron renders left of the title, linking up one
   *  level (the category's folder) — ADR-014 tree navigation. */
  backHref?: string;
  backLabel?: string;
};

export function Banner({
  categoryName,
  imagePath,
  colour,
  onEdit,
  onModel,
  modelDisabledReason,
  onPublishModule,
  publishModuleLabel,
  topSlot,
  backHref,
  backLabel,
}: BannerProps) {
  const t = useTranslations('banner');

  // `null` while the category colour is still loading — avoids an orange flash
  // from a `?? 'orange'` fallback on the image card before `colour` resolves.
  const colourPair = colour ? getCategoryColour(colour) : null;
  const imageUrl = imagePath ? `/api/assets?key=${imagePath}` : null;

  return (
    <div className="flex items-center gap-4 min-h-[136px] p-1">

      {/* Left: name + action buttons */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {topSlot && <div className="mb-1.5 self-start">{topSlot}</div>}
        <div className="flex items-center gap-2 min-w-0">
          {backHref && (
            <Link
              href={backHref}
              aria-label={backLabel ?? 'Back'}
              className="shrink-0 flex items-center justify-center w-9 h-9 -ml-1 rounded-theme-sm transition-opacity hover:opacity-80"
              style={{ color: 'var(--theme-text-primary)' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
          )}
          <h1
            className="text-theme-h3 font-bold leading-tight truncate"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            {categoryName}
          </h1>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {/* Edit — shared EditButton (always isEditing=false here since
              Banner is the view-mode header; clicking flips into edit
              mode via the parent's onEdit handler). The exitLabel is
              unused but required by the component shape. */}
          <EditButton
            isEditing={false}
            onClick={() => onEdit?.()}
            editLabel={t('editButton')}
            exitLabel={t('editButton')}
          />

          <Button
            variant="primary"
            size="sm"
            onClick={onModel}
            disabled={!onModel}
            title={modelDisabledReason}
            icon={<Pointer className="w-3.5 h-3.5" />}
          >
            {t('modelButton')}
          </Button>

          {/* Publish as module — admin-only, inline with the primary actions
              (matches the list/sentence module pages). */}
          {onPublishModule && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onPublishModule}
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              {publishModuleLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Right: category folder image card */}
      <div
        className="w-[136px] h-[136px] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ backgroundColor: colourPair?.c100 ?? 'var(--theme-alt-card)' }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={categoryName}
            className="w-full h-full object-contain p-3"
            draggable={false}
          />
        ) : (
          <ImageIcon className="w-12 h-12" style={{ color: colourPair?.c500 ?? 'var(--theme-secondary-text)' }} />
        )}
      </div>
    </div>
  );
}
