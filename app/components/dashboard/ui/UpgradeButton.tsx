"use client";

import { useState } from "react";
import { Button } from "@/app/components/shared/ui/Button";
import type { SubscriptionTier, SubscriptionPlan } from "@/types";

interface UpgradeButtonProps {
  tier: Exclude<SubscriptionTier, "free">;
  plan: SubscriptionPlan;
  label?: string;
}

export function UpgradeButton({ tier, plan, label }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleUpgrade} loading={loading}>
      {label ?? `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`}
    </Button>
  );
}
