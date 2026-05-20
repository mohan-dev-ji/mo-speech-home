"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deriveTier, type SubscriptionStatus, type SubscriptionPlanId } from "@/types";
import { AccessBadge } from "@/app/components/admin/ui/AccessBadge";
import { StripeLink } from "@/app/components/admin/ui/StripeLink";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { formatDate } from "@/lib/utils";

type AdminUserRow = {
  _id: string;
  _creationTime: number;
  email: string;
  name?: string;
  lastActiveAt: number;
  profileCount: number;
  subscription: {
    status: SubscriptionStatus;
    plan?: SubscriptionPlanId;
    customAccess?: {
      isActive: boolean;
      reason: string;
    };
    stripeCustomerId?: string;
  };
};

type Props = {
  users: AdminUserRow[];
};

type StatusFilter = "all" | SubscriptionStatus;

const PAGE_SIZE = 20;

/**
 * Phase 7 admin Users list — extended columns, search, status filter,
 * pagination. Per plan §3.5.
 *
 * The "trial" status is a legacy artefact of signup defaults (see
 * Context No-Trial callout). It surfaces in the filter as
 * "Free (legacy)" so admins can find these accounts.
 */
export function UsersAdminTable({ users }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q !== "") {
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchName = (u.name ?? "").toLowerCase().includes(q);
        if (!matchEmail && !matchName) return false;
      }
      if (statusFilter !== "all" && u.subscription.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [users, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    clampedPage * PAGE_SIZE,
    (clampedPage + 1) * PAGE_SIZE
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border border-border rounded-lg p-3 bg-muted/20">
        <div className="space-y-1 flex-1 min-w-[12rem]">
          <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider block">
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="email or name"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider block">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(0);
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="past_due">Past due</option>
            <option value="expired">Expired</option>
            <option value="trial">Free (legacy)</option>
          </select>
        </div>
        <div className="ml-auto text-caption text-muted-foreground">
          {filtered.length} of {users.length}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium hidden md:table-cell">Joined</th>
              <th className="text-left p-4 font-medium">Plan</th>
              <th className="text-left p-4 font-medium hidden lg:table-cell">Profiles</th>
              <th className="text-left p-4 font-medium hidden lg:table-cell">Last active</th>
              <th className="text-left p-4 font-medium hidden xl:table-cell">Stripe</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {visible.map((u, i) => (
              <tr
                key={u._id}
                className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <td className="p-4">
                  <p className="font-medium">{u.name ?? "—"}</p>
                  <p className="text-caption text-muted-foreground">{u.email}</p>
                </td>
                <td className="p-4 hidden md:table-cell text-muted-foreground">
                  {formatDate(u._creationTime)}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AccessBadge
                      tier={deriveTier(u.subscription.plan)}
                      status={u.subscription.status}
                    />
                    {u.subscription.customAccess?.isActive && (
                      <Badge variant="success">Custom</Badge>
                    )}
                  </div>
                </td>
                <td className="p-4 hidden lg:table-cell text-muted-foreground">
                  {u.profileCount}
                </td>
                <td className="p-4 hidden lg:table-cell text-muted-foreground">
                  {formatDate(u.lastActiveAt)}
                </td>
                <td className="p-4 hidden xl:table-cell">
                  {u.subscription.stripeCustomerId ? (
                    <StripeLink customerId={u.subscription.stripeCustomerId} />
                  ) : (
                    <span className="text-caption text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <Link
                    href={`/admin/users/${u._id}`}
                    className="text-caption text-primary hover:opacity-80 transition-opacity"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-small">
                  No users match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-small">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          <span className="text-muted-foreground text-caption">
            Page {clampedPage + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={clampedPage >= pageCount - 1}
            className="px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
