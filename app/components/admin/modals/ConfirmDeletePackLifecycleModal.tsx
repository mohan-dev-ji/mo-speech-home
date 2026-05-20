"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  packName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Remove from library" confirmation. Calls `deletePackLifecycle`, which
 * drops the row but leaves the JSON file in
 * `convex/data/library_packs/<slug>.json` untouched. Republishing is one
 * click — the table's "Publish now" action inserts a fresh lifecycle row.
 *
 * The copy emphasises this is non-destructive so admins don't flinch.
 */
export function ConfirmDeletePackLifecycleModal({
  slug,
  packName,
  open,
  onOpenChange,
}: Props) {
  const deleteLifecycle = useMutation(api.resourcePacks.deletePackLifecycle);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteLifecycle({ slug });
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove “{packName}” from the library?</DialogTitle>
          <DialogDescription>
            The pack will disappear from <code className="font-mono">/library</code>
            {" "}immediately. The JSON content file stays in the repo, so you can
            republish in one click from the table.
          </DialogDescription>
        </DialogHeader>

        <p className="text-small text-muted-foreground">
          Slug: <span className="font-mono">{slug}</span>
        </p>

        {error && (
          <p className="text-caption text-destructive mt-2">{error}</p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            loading={isPending}
            onClick={handleConfirm}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
