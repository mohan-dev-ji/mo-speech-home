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
import {
  CUSTOM_ACCESS_REASONS,
  type CustomAccessReason,
} from "@/app/components/admin/constants";

type Props = {
  userId: Id<"users">;
  userLabel: string; // name or email — for the dialog title
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Grant custom admin access. Calls the audit-trail-aware
 * `grantCustomAccess` mutation. When "Other" is picked, notes become
 * required so the audit log never has an opaque "Other" entry.
 *
 * No "trial" semantics — this build has no free trial (see plan Context
 * callout). A grant is open-ended unless the expiry datepicker has a value.
 */
export function GrantCustomAccessModal({
  userId,
  userLabel,
  open,
  onOpenChange,
}: Props) {
  const grant = useMutation(api.users.grantCustomAccess);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState<CustomAccessReason>(
    CUSTOM_ACCESS_REASONS[0]
  );
  const [expiresAt, setExpiresAt] = useState<string>(""); // YYYY-MM-DD; blank = permanent
  const [notes, setNotes] = useState("");

  const isOther = reason === "Other";
  const notesMissing = isOther && notes.trim() === "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (notesMissing) {
      setError("Notes are required when the reason is Other.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await grant({
          userId,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
          notes: notes.trim() === "" ? undefined : notes.trim(),
        });
        onOpenChange(false);
        // Reset for next open
        setReason(CUSTOM_ACCESS_REASONS[0]);
        setExpiresAt("");
        setNotes("");
        // The parent user-detail page is a server component reading via
        // ConvexHttpClient — props don't update on mutation. Force a
        // server re-render so the new grant + history entry appear
        // without the admin double-clicking.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Grant failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant custom access</DialogTitle>
          <DialogDescription>
            Grants full access to {userLabel}, bypassing Stripe. Recorded in the
            audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as CustomAccessReason)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {CUSTOM_ACCESS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
              Expires (optional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-caption text-muted-foreground">
              Blank = permanent grant. Revoke manually when no longer needed.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
              Notes {isOther && <span className="text-destructive">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                isOther
                  ? "Required — describe the reason"
                  : "Optional context for the audit log"
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          </div>

          {error && <p className="text-caption text-destructive">{error}</p>}

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
              type="submit"
              size="sm"
              loading={isPending}
              disabled={notesMissing}
            >
              Grant access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
