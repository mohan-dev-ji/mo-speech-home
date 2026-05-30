"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

type Props = {
  slug: string;
  /** Pack name for the title — pass the localised display string. */
  packName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fires when the admin clicks the destructive confirm. The parent is
   * expected to run the actual republish (POST /api/admin/pack-publish)
   * and close the modal on success — this component doesn't know about
   * the API or toast machinery, keeping it reusable.
   */
  onConfirm: () => void;
  /**
   * Disable the confirm button while the parent's fetch is in flight.
   * Cancel stays enabled — the user can dismiss without aborting the
   * fetch (the request will complete regardless).
   */
  busy?: boolean;
};

/**
 * Destructive confirmation for the Republish-to-JSON / Save changes
 * action. Overwrites `convex/data/library_packs/<slug>.json` from the
 * caller's profile snapshot — no merge, no diff, can't be undone except
 * via git. Copy emphasises the destructive scope so admins don't flinch
 * past the warning.
 *
 * Mirror of `ConfirmDeletePackLifecycleModal.tsx` in shape; the only
 * structural difference is that the parent owns the side-effect
 * (fetch + toast) rather than this component running a Convex mutation
 * directly. RepublishButton.tsx is the one caller today.
 */
export function SavePackChangesConfirmModal({
  slug,
  packName,
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: Props) {
  const t = useTranslations("packPicker");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmModalTitle", { packName })}</DialogTitle>
          <DialogDescription>
            {t("confirmModalBody", { slug })}
          </DialogDescription>
        </DialogHeader>

        <p className="text-small text-muted-foreground">
          <span className="font-mono">{t("confirmModalSlugLine", { slug })}</span>
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={busy}
            onClick={onConfirm}
          >
            {t("confirmModalConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
