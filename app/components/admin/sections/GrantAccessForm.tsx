"use client";

import { useState, useTransition } from "react";
import { Button } from "@/app/components/shared/ui/Button";
import { adminSetAccess } from "@/app/(admin)/admin/users/[userId]/actions";
import type { SubscriptionTier, SubscriptionStatus } from "@/types";

type Props = {
  userId: string;
  currentTier: SubscriptionTier;
  currentStatus: SubscriptionStatus;
};

const TIER_OPTIONS: { value: SubscriptionTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "max", label: "Max" },
];

export function GrantAccessForm({ userId, currentTier, currentStatus }: Props) {
  const [tier, setTier] = useState<SubscriptionTier>(currentTier);
  const [status, setStatus] = useState<SubscriptionStatus>(currentStatus);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await adminSetAccess(userId, tier, status);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
            Tier
          </label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as SubscriptionTier)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="free">Free</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past due</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={isPending}>
          Save changes
        </Button>
        {saved && (
          <span className="text-caption text-green-600 dark:text-green-400">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
