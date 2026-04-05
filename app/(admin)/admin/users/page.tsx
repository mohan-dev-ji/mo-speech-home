import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { UserRecord } from "@/types";
import { AccessBadge } from "@/app/components/admin/ui/AccessBadge";
import { StripeLink } from "@/app/components/admin/ui/StripeLink";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function AdminUsersPage() {
  const users = await convex.query(api.users.listAllUsers, { limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">{users.length} total users</p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium hidden md:table-cell">Joined</th>
              <th className="text-left p-4 font-medium">Plan</th>
              <th className="text-left p-4 font-medium hidden lg:table-cell">Stripe</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {(users as UserRecord[]).map((user, i) => (
              <tr
                key={user._id}
                className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <td className="p-4">
                  <p className="font-medium">{user.name ?? "—"}</p>
                  <p className="text-caption text-muted-foreground">{user.email}</p>
                </td>
                <td className="p-4 hidden md:table-cell text-muted-foreground">
                  {formatDate(user._creationTime)}
                </td>
                <td className="p-4">
                  <AccessBadge
                    tier={user.subscription.tier}
                    status={user.subscription.status}
                  />
                </td>
                <td className="p-4 hidden lg:table-cell">
                  {user.subscription.stripeCustomerId ? (
                    <StripeLink customerId={user.subscription.stripeCustomerId} />
                  ) : (
                    <span className="text-caption text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <Link
                    href={`/admin/users/${user._id}`}
                    className="text-caption text-primary hover:opacity-80 transition-opacity"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
