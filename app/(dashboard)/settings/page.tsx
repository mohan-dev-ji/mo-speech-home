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
import type { SubscriptionTier, SubscriptionPlan } from "@/types";

const plans: Record<"pro" | "max", {
  name: string;
  price: { monthly: string; yearly: string };
  features: string[];
}> = {
  pro: {
    name: "Pro",
    price: { monthly: "£9.99", yearly: "£79" },
    features: [
      "Categories + all four modes",
      "Modelling mode",
      "Resource library packs",
      "Create/edit custom symbols",
      "Natural voice sentences",
    ],
  },
  max: {
    name: "Max",
    price: { monthly: "£14.99", yearly: "£119" },
    features: [
      "Everything in Pro",
      "Premium themes",
      "Family member invitations",
      "Mo Speech School connection",
      "Voice cloning (coming soon)",
    ],
  },
};

function PlanCTA({
  targetTier,
  billingPlan,
  currentTier,
  currentStatus,
  currentPlan,
  onPortal,
  portalLoading,
}: {
  targetTier: "pro" | "max";
  billingPlan: SubscriptionPlan;
  currentTier: SubscriptionTier;
  currentStatus: string;
  currentPlan: SubscriptionPlan | null;
  onPortal: () => void;
  portalLoading: boolean;
}) {
  const [switchLoading, setSwitchLoading] = useState(false);

  const handleSwitch = async () => {
    setSwitchLoading(true);
    try {
      const res = await fetch("/api/stripe/switch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: targetTier, plan: billingPlan }),
      });
      if (!res.ok) console.error("Switch plan failed", await res.json());
    } finally {
      setSwitchLoading(false);
    }
  };

  const isFreeUser = currentStatus === "free";
  const isCurrentTier = currentTier === targetTier;
  const isActive = currentStatus === "active";
  const isCancelled = currentStatus === "cancelled";

  if (isFreeUser) {
    return <UpgradeButton tier={targetTier} plan={billingPlan} label={`Start ${plans[targetTier].name}`} />;
  }

  if (isCurrentTier && isActive) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" size="sm" disabled className="w-full cursor-default opacity-60">
          Current plan
        </Button>
        {currentPlan && currentPlan !== billingPlan && (
          <Button variant="secondary" size="sm" onClick={handleSwitch} loading={switchLoading} className="w-full">
            Switch to {billingPlan}
          </Button>
        )}
      </div>
    );
  }

  if (isCurrentTier && isCancelled) {
    return (
      <Button variant="secondary" size="sm" onClick={onPortal} loading={portalLoading} className="w-full">
        Resubscribe
      </Button>
    );
  }

  // Different tier — update subscription directly (Stripe handles proration)
  return (
    <Button size="sm" onClick={handleSwitch} loading={switchLoading} className="w-full">
      Switch to {plans[targetTier].name}
    </Button>
  );
}

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

      {/* Plan */}
      {isLoading ? (
        <CardSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Plan</CardTitle>
              <PricingToggle value={billingPlan} onChange={setBillingPlan} />
            </div>
          </CardHeader>
          <CardContent>
            {/* Current plan status — only shown when subscribed */}
            {isSubscribed && (
              <dl className="space-y-3 mb-6 pb-6 border-b border-border">
                <div className="flex justify-between text-small">
                  <dt className="text-muted-foreground">Current plan</dt>
                  <dd className="font-medium capitalize">{subscription.tier} · {subscription.plan}</dd>
                </div>
                <div className="flex justify-between text-small">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium capitalize">{subscription.status}</dd>
                </div>
                {subscription.status === "cancelled" && subscription.subscriptionEndsAt && (
                  <div className="flex justify-between text-small">
                    <dt className="text-muted-foreground">Access until</dt>
                    <dd className="font-medium text-warning">{formatDate(subscription.subscriptionEndsAt)}</dd>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" loading={portalLoading} onClick={handlePortal}>
                    Manage billing
                  </Button>
                </div>
              </dl>
            )}

            {/* Plan cards — always shown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["pro", "max"] as const).map((tier) => {
                const p = plans[tier];
                const isCurrentTier = subscription.tier === tier;
                return (
                  <Card key={tier} className={isCurrentTier && isSubscribed ? "ring-1 ring-primary" : ""}>
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
                      <PlanCTA
                        targetTier={tier}
                        billingPlan={billingPlan}
                        currentTier={subscription.tier}
                        currentStatus={subscription.status}
                        currentPlan={subscription.plan}
                        onPortal={handlePortal}
                        portalLoading={portalLoading}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
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
