"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { formatDate } from "@/lib/utils";

type CurrentGrant = {
  reason: string;
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
};

type Props = {
  userId: Id<"users">;
  userLabel: string;
  current: CurrentGrant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Confirm revoking an active custom access grant. Shows the current grant
 * details for context, lets the admin add optional revoke notes, and calls
 * the `revokeCustomAccess` mutation which appends a "revoked" entry to
 * `customAccessHistory`.
 */
export function RevokeCustomAccessModal({
  userId,
  userLabel,
  current,
  open,
  onOpenChange,
}: Props) {
  const revoke = useMutation(api.users.revokeCustomAccess);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await revoke({
          userId,
          notes: notes.trim() === "" ? undefined : notes.trim(),
        });
        onOpenChange(false);
        setNotes("");
        // Server-component parent doesn't auto-update; force a fresh
        // server render so the cleared grant + new history entry show
        // without the admin reloading.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Revoke failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke custom access</DialogTitle>
          <DialogDescription>
            Removes the active grant for {userLabel}. Recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-caption">
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="col-span-2">{current.reason}</dd>

            <dt className="text-muted-foreground">Granted by</dt>
            <dd className="col-span-2 font-mono truncate">{current.grantedBy}</dd>

            <dt className="text-muted-foreground">Granted at</dt>
            <dd className="col-span-2">{formatDate(current.grantedAt)}</dd>

            {current.expiresAt && (
              <>
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="col-span-2">{formatDate(current.expiresAt)}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="space-y-1.5 mt-4">
          <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Reason for revoke — visible in the audit log"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>

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
            Revoke access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
