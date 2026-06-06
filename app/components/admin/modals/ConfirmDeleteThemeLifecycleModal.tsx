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
  themeName: string;
  /** Builtin themes stay visible in pickers even after the lifecycle row goes. */
  builtin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Remove from library" confirmation. Calls `deleteThemeLifecycle`, which drops
 * the row but leaves the JSON file in convex/data/themes/<slug>.json untouched.
 * Republishing is one click (the table's "Publish now" inserts a fresh row).
 *
 * For a builtin theme, removing the lifecycle row only strips its
 * featured/tier/scheduling overrides — the theme itself stays in every picker.
 */
export function ConfirmDeleteThemeLifecycleModal({
  slug,
  themeName,
  builtin,
  open,
  onOpenChange,
}: Props) {
  const deleteLifecycle = useMutation(api.themes.deleteThemeLifecycle);
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
          <DialogTitle>Remove “{themeName}” lifecycle?</DialogTitle>
          <DialogDescription>
            {builtin ? (
              <>
                This is a built-in theme — it stays available in every picker.
                Removing the row only clears its featured / tier / scheduling
                overrides.
              </>
            ) : (
              <>
                The theme will disappear from pickers immediately. The JSON file
                stays in the repo, so you can republish in one click from the
                table.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <p className="text-small text-muted-foreground">
          Slug: <span className="font-mono">{slug}</span>
        </p>

        {error && <p className="text-caption text-destructive mt-2">{error}</p>}

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
