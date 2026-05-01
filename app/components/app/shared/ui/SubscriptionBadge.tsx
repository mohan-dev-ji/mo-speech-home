"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import type { SubscriptionTier } from "@/types";

const BADGE_VARIANT: Record<SubscriptionTier, "default" | "warning" | "success" | "outline"> = {
  free: "outline",
  pro: "default",
  max: "success",
};

export function SubscriptionBadge({ tier }: { tier: SubscriptionTier }) {
  const t = useTranslations("plan");
  const label =
    tier === "free" ? t("freeName") :
    tier === "pro"  ? t("proName")  :
                      t("maxName");
  return <Badge variant={BADGE_VARIANT[tier]}>{label}</Badge>;
}
