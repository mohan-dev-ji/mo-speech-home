import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/app/components/shared/ui/Card";
import { SubscriptionBadge } from "@/app/components/dashboard/ui/SubscriptionBadge";
import { formatDate } from "@/lib/utils";
import type { UserSubscription } from "@/types";

export function SubscriptionCard({ subscription }: { subscription: UserSubscription }) {
  const { tier, status, plan, subscriptionEndsAt, hasFullAccess } = subscription;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription</CardTitle>
          <SubscriptionBadge tier={tier} />
        </div>
        <CardDescription>Your current plan</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium capitalize">
              {tier === "free" ? "Free" : `${tier} (${plan ?? "—"})`}
            </dd>
          </div>
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{status}</dd>
          </div>
          {subscriptionEndsAt && (
            <div className="flex justify-between text-small">
              <dt className="text-muted-foreground">
                {status === "cancelled" ? "Access until" : "Renews"}
              </dt>
              <dd className="font-medium">{formatDate(subscriptionEndsAt)}</dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter>
        <Link
          href="/billing"
          className="text-small text-primary hover:opacity-80 transition-opacity"
        >
          {hasFullAccess ? "Manage billing →" : "Upgrade plan →"}
        </Link>
      </CardFooter>
    </Card>
  );
}
