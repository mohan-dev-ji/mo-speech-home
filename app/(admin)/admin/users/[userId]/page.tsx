import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deriveTier } from "@/types";
import { AccessBadge } from "@/app/components/admin/ui/AccessBadge";
import { StripeLink } from "@/app/components/admin/ui/StripeLink";
import { GrantAccessForm } from "@/app/components/admin/sections/GrantAccessForm";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const user = await convex.query(api.users.getUserById, {
    userId: userId as Id<"users">,
  });

  if (!user) notFound();

  const sub = user.subscription;
  const tier = deriveTier(sub.plan);

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
        <h1 className="text-heading font-bold">{user.name ?? user.email}</h1>
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

      {/* Admin override */}
      <section className="border border-border rounded-lg">
        <div className="px-5 py-3">
          <p className="text-caption font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Override access
          </p>
          <p className="text-caption text-muted-foreground mb-4">
            Manually set tier and status. Use for comps, support cases, or testing. Stripe billing is unaffected.
          </p>
          <GrantAccessForm
            userId={user._id}
            currentTier={tier}
            currentStatus={sub.status}
          />
        </div>
      </section>
    </div>
  );
}
