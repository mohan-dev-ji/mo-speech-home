"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/app/components/shared/ui/Card";
import { SubscriptionBadge } from "@/app/components/app/shared/SubscriptionBadge";
import { formatDate } from "@/lib/utils";
import type { UserSubscription } from "@/types";

export function SubscriptionCard({ subscription }: { subscription: UserSubscription }) {
  const t  = useTranslations("subscriptionCard");
  const tp = useTranslations("plan");
  const { tier, status, plan, subscriptionEndsAt, hasFullAccess } = subscription;

  const planLabel =
    tier === "free" ? tp("freeName") :
    `${tier === "pro" ? tp("proName") : tp("maxName")} · ${plan?.includes("yearly") ? tp("billingYearly") : tp("billingMonthly")}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <SubscriptionBadge tier={tier} />
        </div>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">{t("plan")}</dt>
            <dd className="font-medium">{planLabel}</dd>
          </div>
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">{t("status")}</dt>
            <dd className="font-medium capitalize">{status}</dd>
          </div>
          {subscriptionEndsAt && (
            <div className="flex justify-between text-small">
              <dt className="text-muted-foreground">
                {status === "cancelled" ? t("accessUntil") : t("renews")}
              </dt>
              <dd className="font-medium">{formatDate(subscriptionEndsAt)}</dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter>
        <Link
          href="/en/settings"
          className="text-small text-primary hover:opacity-80 transition-opacity"
        >
          {hasFullAccess ? t("manageBilling") : t("upgradePlan")}
        </Link>
      </CardFooter>
    </Card>
  );
}
