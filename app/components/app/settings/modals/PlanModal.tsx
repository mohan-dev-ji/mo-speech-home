"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAppState } from "@/app/components/AppStateProvider";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";
import { PricingToggle } from "@/app/components/marketing/ui/PricingToggle";
import { Check, AlertCircle, CheckCircle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingInterval = "monthly" | "yearly";

type ActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ name, price, features, highlighted, children }: {
  name: string;
  price: string;
  features: string[];
  highlighted: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-theme border p-4 flex flex-col",
      highlighted ? "border-primary ring-1 ring-primary" : "border-theme-line"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-theme-p font-semibold text-theme-text">{name}</span>
        <span className="font-bold text-theme-text">{price}</span>
      </div>
      <ul className="space-y-1 mb-4 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-theme-s text-theme-secondary-text">
            <Check className="w-3.5 h-3.5 text-success shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

// ─── PlanModal ───────────────────────────────────────────────────────────────

export function PlanModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("plan");
  const { subscription } = useAppState();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

  const { tier, status, plan, subscriptionEndsAt } = subscription;
  const isActive    = status === "active";
  const isCancelled = status === "cancelled";
  const isExpired   = status === "expired";
  const isSubscribed = isActive || isCancelled;

  // Derive the current billing interval from the stored plan ID
  const currentInterval: BillingInterval | null =
    plan?.includes("yearly") ? "yearly" : plan ? "monthly" : null;

  const isLoading = actionState.status === "loading";

  // ─── API helper ──────────────────────────────────────────────────────────────

  const callApi = async (url: string, body?: object, successMsg?: string) => {
    setActionState({ status: "loading" });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setActionState({ status: "error", message: t("errorGeneric") });
        return;
      }
      // Stripe checkout returns a redirect URL
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setActionState({ status: "success", message: successMsg ?? "" });
    } catch {
      setActionState({ status: "error", message: t("errorGeneric") });
    }
  };

  // ─── Free card CTA ───────────────────────────────────────────────────────────

  const renderFreeCTA = () => {
    if (tier === "free" || isExpired) {
      return (
        <Button variant="secondary" size="sm" disabled className="w-full opacity-60 cursor-default">
          {t("ctaCurrentPlan")}
        </Button>
      );
    }
    if (isCancelled && subscriptionEndsAt) {
      return (
        <p className="text-theme-s text-theme-secondary-text text-center py-1">
          {t("ctaCancellingOn", { date: formatDate(subscriptionEndsAt) })}
        </p>
      );
    }
    if (isActive) {
      return (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => callApi("/api/stripe/cancel", undefined, t("cancelSuccess"))}
          loading={isLoading}
          className="w-full"
        >
          {t("ctaCancelSubscription")}
        </Button>
      );
    }
    return null;
  };

  // ─── Paid tier CTA ───────────────────────────────────────────────────────────

  const renderPaidCTA = (targetTier: "pro" | "max") => {
    const tierName = targetTier === "pro" ? t("proName") : t("maxName");
    const isCurrentTier = tier === targetTier;

    // Free or expired: go to checkout (need payment details)
    if (tier === "free" || isExpired) {
      return (
        <Button
          size="sm"
          onClick={() => callApi("/api/stripe/checkout", { tier: targetTier, plan: billingInterval })}
          loading={isLoading}
          className="w-full"
        >
          {targetTier === "pro" ? t("ctaStartPro") : t("ctaStartMax")}
        </Button>
      );
    }

    // Currently on this tier
    if (isCurrentTier) {
      if (isActive) {
        // Same billing interval as toggle — already on this plan
        if (currentInterval === billingInterval) {
          return (
            <Button variant="secondary" size="sm" disabled className="w-full opacity-60 cursor-default">
              {t("ctaCurrentPlan")}
            </Button>
          );
        }
        // Different billing interval — offer seamless switch
        return (
          <Button
            size="sm"
            onClick={() => callApi(
              "/api/stripe/switch-plan",
              { tier: targetTier, plan: billingInterval },
              t("switchSuccess")
            )}
            loading={isLoading}
            className="w-full"
          >
            {billingInterval === "yearly" ? t("ctaSwitchToYearly") : t("ctaSwitchToMonthly")}
          </Button>
        );
      }
      // Cancelling — reactivate, or reactivate + switch interval in one step
      if (isCancelled) {
        if (currentInterval === billingInterval) {
          // Same interval: simple reactivate (remove cancel_at_period_end)
          return (
            <Button
              size="sm"
              onClick={() => callApi("/api/stripe/reactivate", undefined, t("reactivateSuccess"))}
              loading={isLoading}
              className="w-full"
            >
              {t("ctaReactivate")}
            </Button>
          );
        }
        // Different interval: switch-plan clears cancel_at_period_end AND changes interval
        return (
          <Button
            size="sm"
            onClick={() => callApi(
              "/api/stripe/switch-plan",
              { tier: targetTier, plan: billingInterval },
              t("switchSuccess")
            )}
            loading={isLoading}
            className="w-full"
          >
            {billingInterval === "yearly" ? t("ctaSwitchToYearly") : t("ctaSwitchToMonthly")}
          </Button>
        );
      }
    }

    // Different tier — seamless upgrade or downgrade (no Stripe redirect)
    const isUpgrade = tier === "pro" && targetTier === "max";
    return (
      <Button
        size="sm"
        variant={isUpgrade ? "primary" : "secondary"}
        onClick={() => callApi(
          "/api/stripe/switch-plan",
          { tier: targetTier, plan: billingInterval },
          t("switchSuccess")
        )}
        loading={isLoading}
        className="w-full"
      >
        {isUpgrade
          ? t("ctaUpgradeTo", { name: tierName })
          : t("ctaDowngradeTo", { name: tierName })}
      </Button>
    );
  };

  // ─── Price display ────────────────────────────────────────────────────────────

  const proPrice = billingInterval === "monthly"
    ? `${t("proMonthlyPrice")} ${t("perMonth")}`
    : `${t("proYearlyPrice")} ${t("perYear")}`;

  const maxPrice = billingInterval === "monthly"
    ? `${t("maxMonthlyPrice")} ${t("perMonth")}`
    : `${t("maxYearlyPrice")} ${t("perYear")}`;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle>{t("heading")}</DialogTitle>
          <PricingToggle value={billingInterval} onChange={setBillingInterval} />
        </div>
        {isSubscribed && (
          <p className="text-theme-s text-theme-secondary-text mt-1">{t("changeNotice")}</p>
        )}
      </DialogHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
        <PlanCard
          name={t("freeName")}
          price={t("freePrice")}
          features={[
            t("freeFeature0"),
            t("freeFeature1"),
            t("freeFeature2"),
            t("freeFeature3"),
          ]}
          highlighted={tier === "free" || isExpired}
        >
          {renderFreeCTA()}
        </PlanCard>

        <PlanCard
          name={t("proName")}
          price={proPrice}
          features={[
            t("proFeature0"),
            t("proFeature1"),
            t("proFeature2"),
            t("proFeature3"),
            t("proFeature4"),
          ]}
          highlighted={tier === "pro" && isSubscribed}
        >
          {renderPaidCTA("pro")}
        </PlanCard>

        <PlanCard
          name={t("maxName")}
          price={maxPrice}
          features={[
            t("maxFeature0"),
            t("maxFeature1"),
            t("maxFeature2"),
            t("maxFeature3"),
            t("maxFeature4"),
          ]}
          highlighted={tier === "max" && isSubscribed}
        >
          {renderPaidCTA("max")}
        </PlanCard>
      </div>

      {actionState.status === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-small text-success">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {actionState.message}
        </div>
      )}
      {actionState.status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-small text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionState.message}
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
