"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { GrantCustomAccessModal } from "@/app/components/admin/modals/GrantCustomAccessModal";
import { RevokeCustomAccessModal } from "@/app/components/admin/modals/RevokeCustomAccessModal";
import { formatDate } from "@/lib/utils";

type CustomAccess = {
  isActive: boolean;
  reason: string;
  grantedBy: string;
  grantedAt: number;
  expiresAt?: number;
};

type HistoryEntry = {
  action: "granted" | "revoked";
  reason: string;
  performedBy: string;
  performedAt: number;
  expiresAt?: number;
  notes?: string;
};

type Props = {
  userId: Id<"users">;
  userLabel: string;
  customAccess?: CustomAccess | null;
  history?: HistoryEntry[];
  /**
   * Whether the grant is currently in effect (active flag + expiry not yet
   * reached). Computed in the parent server component so this client
   * component never reads wall-clock time during render. Re-derived after
   * each grant/revoke via `router.refresh()`.
   */
  isActive: boolean;
  /** Whether the grant has an expiry that has already passed. */
  isExpired: boolean;
};

/**
 * Custom access card on the admin user-detail page. Shows the current
 * state (Active / Expired / None), Grant + Revoke buttons, and an
 * append-only audit timeline (newest first).
 *
 * Replaces the earlier minimal GrantAccessForm. Per plan §3.4.
 */
export function CustomAccessCard({
  userId,
  userLabel,
  customAccess,
  history,
  isActive,
  isExpired,
}: Props) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  // Newest entry first
  const sortedHistory = [...(history ?? [])].sort(
    (a, b) => b.performedAt - a.performedAt
  );

  return (
    <section className="border border-border rounded-lg">
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
              Custom access
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              Bypass Stripe and grant full access. All changes appear in the audit
              log below.
            </p>
          </div>
          <StatusBadge isActive={isActive} isExpired={isExpired} />
        </div>

        {customAccess && (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-small">
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="col-span-2">{customAccess.reason}</dd>

            <dt className="text-muted-foreground">Granted by</dt>
            <dd className="col-span-2 font-mono text-caption truncate">
              {customAccess.grantedBy}
            </dd>

            <dt className="text-muted-foreground">Granted at</dt>
            <dd className="col-span-2">{formatDate(customAccess.grantedAt)}</dd>

            {customAccess.expiresAt && (
              <>
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="col-span-2">{formatDate(customAccess.expiresAt)}</dd>
              </>
            )}
          </dl>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            {isActive ? "Replace grant" : "Grant access"}
          </Button>
          {isActive && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setRevokeOpen(true)}
            >
              Revoke access
            </Button>
          )}
        </div>

        {sortedHistory.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider mb-2">
              History ({sortedHistory.length})
            </p>
            <ul className="space-y-2">
              {sortedHistory.map((entry, i) => (
                <li
                  key={`${entry.performedAt}-${i}`}
                  className="text-small border-l-2 border-border pl-3"
                >
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium capitalize">{entry.action}</span>
                    <span className="text-caption text-muted-foreground">
                      {formatDate(entry.performedAt)}
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground mt-0.5">
                    {entry.reason}
                    {entry.expiresAt && (
                      <> · expires {formatDate(entry.expiresAt)}</>
                    )}
                  </p>
                  {entry.notes && (
                    <p className="text-caption text-muted-foreground mt-0.5 italic">
                      “{entry.notes}”
                    </p>
                  )}
                  <p className="text-caption text-muted-foreground/70 font-mono mt-0.5 truncate">
                    by {entry.performedBy}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <GrantCustomAccessModal
        userId={userId}
        userLabel={userLabel}
        open={grantOpen}
        onOpenChange={setGrantOpen}
      />
      {customAccess && (
        <RevokeCustomAccessModal
          userId={userId}
          userLabel={userLabel}
          current={customAccess}
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
        />
      )}
    </section>
  );
}

function StatusBadge({
  isActive,
  isExpired,
}: {
  isActive: boolean;
  isExpired: boolean;
}) {
  if (isActive) return <Badge variant="success">Active</Badge>;
  if (isExpired) return <Badge variant="warning">Expired</Badge>;
  return <Badge variant="outline">None</Badge>;
}
