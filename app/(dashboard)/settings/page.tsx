"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAppState } from "@/app/components/AppStateProvider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/shared/ui/Card";
import Link from "next/link";
import { CardSkeleton } from "@/app/components/shared/ui/Skeleton";
import { ThemeToggle } from "@/app/components/shared/ui/ThemeToggle";
import { UpgradeButton } from "@/app/components/dashboard/ui/UpgradeButton";
import { PricingToggle } from "@/app/components/marketing/ui/PricingToggle";
import { Button } from "@/app/components/shared/ui/Button";
import { formatDate } from "@/lib/utils";
import { Check } from "lucide-react";

const plans = {
  pro: {
    name: "Pro",
    price: { monthly: "$12", yearly: "$96" },
    features: ["Unlimited [units]", "All core features", "Priority support", "Up to 5 users"],
  },
  business: {
    name: "Business",
    price: { monthly: "$39", yearly: "$312" },
    features: ["Everything in Pro", "Unlimited users", "Dedicated support", "Custom integrations"],
  },
};

export default function SettingsPage() {
  const { user } = useUser();
  const { userRecord, subscription, isLoading } = useAppState();
  const [billingPlan, setBillingPlan] = useState<"monthly" | "yearly">("monthly");
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = async () => {
    if (!userRecord?.subscription.stripeCustomerId) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  const isSubscribed = subscription.status === "active" || subscription.status === "cancelled";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 mb-4 border-b border-border pb-4">
            <div className="flex justify-between text-small">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{user?.fullName ?? "—"}</dd>
            </div>
            <div className="flex justify-between text-small">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">
                {user?.primaryEmailAddress?.emailAddress ?? "—"}
              </dd>
            </div>
          </dl>
          <div className="flex justify-end">
            <Link
              href="/settings/account"
              className="inline-flex items-center justify-center gap-2 font-medium transition-all px-3 py-1.5 text-small rounded-sm bg-card text-foreground border border-border hover:bg-muted"
            >
              Manage account
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      {isLoading ? (
        <CardSkeleton />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 mb-4 border-b border-border pb-4">
                <div className="flex justify-between text-small">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium capitalize">{subscription.status}</dd>
                </div>
                <div className="flex justify-between text-small">
                  <dt className="text-muted-foreground">Tier</dt>
                  <dd className="font-medium capitalize">{subscription.tier}</dd>
                </div>
                {isSubscribed && subscription.plan && (
                  <div className="flex justify-between text-small">
                    <dt className="text-muted-foreground">Billing</dt>
                    <dd className="font-medium capitalize">{subscription.plan}</dd>
                  </div>
                )}
                {isSubscribed && subscription.subscriptionEndsAt && (
                  <div className="flex justify-between text-small">
                    <dt className="text-muted-foreground">
                      {subscription.status === "cancelled" ? "Cancels" : "Renews"}
                    </dt>
                    <dd className="font-medium">{formatDate(subscription.subscriptionEndsAt)}</dd>
                  </div>
                )}
              </dl>
              {isSubscribed && (
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={portalLoading}
                    onClick={handlePortal}
                  >
                    Manage billing
                  </Button>
                </div>
              )}
              {!isSubscribed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-subheading">Upgrade your plan</h2>
                <PricingToggle value={billingPlan} onChange={setBillingPlan} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["pro", "business"] as const).map((tier) => {
                  const p = plans[tier];
                  return (
                    <Card key={tier}>
                      <CardHeader>
                        <CardTitle>{p.name}</CardTitle>
                        <CardDescription>
                          <span className="text-heading font-bold text-foreground">
                            {billingPlan === "monthly" ? p.price.monthly : p.price.yearly}
                          </span>
                          <span className="text-muted-foreground text-small ml-1">
                            / {billingPlan === "monthly" ? "month" : "year"}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 mb-6">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-small">
                              <Check className="w-4 h-4 text-success shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <UpgradeButton tier={tier} plan={billingPlan} label={`Upgrade to ${p.name}`} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
            </CardContent>
          </Card>

          
        </>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-small">Dark mode</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
