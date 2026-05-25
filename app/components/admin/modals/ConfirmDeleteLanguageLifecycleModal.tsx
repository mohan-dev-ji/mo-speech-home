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
  code: string;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Unpublish language" confirmation. Calls `deleteLanguageLifecycle`, which
 * drops the row but leaves the JSON module in
 * `convex/data/languages/<code>.json` untouched. The language stays
 * routable (deep-links to `/<code>/...` still resolve) but disappears
 * from pickers. Republishing is one click via the table.
 *
 * Copy mirrors the pack equivalent so admins recognise the pattern.
 */
export function ConfirmDeleteLanguageLifecycleModal({
  code,
  label,
  open,
  onOpenChange,
}: Props) {
  const deleteLifecycle = useMutation(api.languages.deleteLanguageLifecycle);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteLifecycle({ slug: code });
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
          <DialogTitle>Unpublish “{label}”?</DialogTitle>
          <DialogDescription>
            The language will disappear from in-app pickers immediately. The
            JSON module stays in the repo so you can republish in one click
            from the table.
          </DialogDescription>
        </DialogHeader>

        <p className="text-small text-muted-foreground">
          Code: <span className="font-mono">{code}</span>
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
            Unpublish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
