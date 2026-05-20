import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deriveTier } from "@/types";
import { AccessBadge } from "@/app/components/admin/ui/AccessBadge";
import { StripeLink } from "@/app/components/admin/ui/StripeLink";
import { CustomAccessCard } from "@/app/components/admin/sections/CustomAccessCard";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Phase 7 admin user detail page. Renders:
 *   - Account info (joined, last active, Clerk + Convex IDs)
 *   - Subscription info (plan, billing, Stripe IDs)
 *   - Profiles list (read-only summary)
 *   - Custom access card (current grant + audit history, Grant / Revoke
 *     buttons that open the new modal pair)
 *
 * R2 usage and "Recent activity" mentioned in the spec are deferred —
 * they need data layers (R2 quota tracking, recentSymbols) that don't
 * exist yet. See plan §3.7.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const [user, profiles] = await Promise.all([
    convex.query(api.users.getUserById, { userId: userId as Id<"users"> }),
    convex.query(api.studentProfiles.listProfilesForAccount, {
      accountId: userId as Id<"users">,
    }),
  ]);

  if (!user) notFound();

  const sub = user.subscription;
  const tier = deriveTier(sub.plan);
  const userLabel = user.name ?? user.email;

  // Compute grant effectiveness server-side so the client CustomAccessCard
  // never reads Date.now() during render (which trips React's
  // useSyncExternalStore / purity rules). Re-evaluated on every server
  // render — modals call router.refresh() after grant/revoke.
  //
  // The react-hooks/purity rule below is safe to suppress: this file is an
  // async server component, not a client component. It runs once per
  // request and `Date.now()` is the standard way to derive request-time
  // values (cf. cookies, headers).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const customAccessIsActive =
    sub.customAccess?.isActive === true &&
    (sub.customAccess.expiresAt == null || sub.customAccess.expiresAt > now);
  const customAccessIsExpired =
    sub.customAccess?.isActive === true &&
    sub.customAccess.expiresAt != null &&
    sub.customAccess.expiresAt <= now;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="text-caption text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Users
        </Link>
      </div>

      <div>
        <h1 className="text-heading font-bold">{userLabel}</h1>
        <p className="text-muted-foreground mt-1 text-small">{user.email}</p>
      </div>

      {/* Account info */}
      <section className="border border-border rounded-lg divide-y divide-border">
        <div className="px-5 py-3">
          <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Account
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-small">
            <dt className="text-muted-foreground">Joined</dt>
            <dd>{formatDate(user._creationTime)}</dd>

            <dt className="text-muted-foreground">Last active</dt>
            <dd>{formatDate(user.lastActiveAt)}</dd>

            <dt className="text-muted-foreground">Clerk ID</dt>
            <dd className="font-mono text-caption truncate">{user.clerkUserId}</dd>

            <dt className="text-muted-foreground">Convex ID</dt>
            <dd className="font-mono text-caption truncate">{user._id}</dd>
          </dl>
        </div>
      </section>

      {/* Subscription info */}
      <section className="border border-border rounded-lg divide-y divide-border">
        <div className="px-5 py-3">
          <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Subscription
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-small">
            <dt className="text-muted-foreground">Plan</dt>
            <dd>
              <AccessBadge tier={tier} status={sub.status} />
            </dd>

            <dt className="text-muted-foreground">Billing</dt>
            <dd>{sub.plan ? `${sub.plan.charAt(0).toUpperCase()}${sub.plan.slice(1)}` : "—"}</dd>

            <dt className="text-muted-foreground">Renews / ends</dt>
            <dd>
              {sub.subscriptionEndsAt ? formatDate(sub.subscriptionEndsAt) : "—"}
            </dd>

            {sub.stripeCustomerId && (
              <>
                <dt className="text-muted-foreground">Stripe customer</dt>
                <dd>
                  <StripeLink customerId={sub.stripeCustomerId} />
                </dd>
              </>
            )}

            {sub.stripeSubscriptionId && (
              <>
                <dt className="text-muted-foreground">Stripe subscription</dt>
                <dd className="font-mono text-caption truncate">
                  {sub.stripeSubscriptionId}
                </dd>
              </>
            )}
          </dl>
        </div>
      </section>

      {/* Profiles */}
      <section className="border border-border rounded-lg">
        <div className="px-5 py-3">
          <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Profiles ({profiles.length})
          </p>
          {profiles.length === 0 ? (
            <p className="text-caption text-muted-foreground">
              No student profiles on this account yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {profiles.map((p) => (
                <li
                  key={p._id}
                  className="flex items-center justify-between text-small border border-border rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{p.name}</span>
                    <Badge variant="outline">{p.language}</Badge>
                    {p.themeSlug && (
                      <Badge variant="outline">{p.themeSlug}</Badge>
                    )}
                    {p.studentViewLocked && (
                      <Badge variant="warning">Locked</Badge>
                    )}
                  </div>
                  <span className="text-caption text-muted-foreground ml-3 shrink-0">
                    {formatDate(p.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Custom access (with grant/revoke + audit history) */}
      <CustomAccessCard
        userId={user._id}
        userLabel={userLabel}
        customAccess={sub.customAccess}
        history={user.customAccessHistory}
        isActive={customAccessIsActive}
        isExpired={customAccessIsExpired}
      />
    </div>
  );
}
