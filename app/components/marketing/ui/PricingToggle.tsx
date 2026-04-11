"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface PricingToggleProps {
  value: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
}

export function PricingToggle({ value, onChange }: PricingToggleProps) {
  const t = useTranslations("plan");
  return (
    <div className="inline-flex items-center gap-3">
      <span className={cn("text-small", value === "monthly" ? "text-foreground font-medium" : "text-muted-foreground")}>
        {t("billingMonthly")}
      </span>
      <button
        onClick={() => onChange(value === "monthly" ? "yearly" : "monthly")}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors overflow-hidden",
          value === "yearly" ? "bg-primary" : "bg-border"
        )}
        aria-label="Toggle billing period"
      >
        <span
          className={cn(
            "absolute left-0 top-1 w-4 h-4 rounded-full bg-white transition-transform",
            value === "yearly" ? "translate-x-7" : "translate-x-1"
          )}
        />
      </button>
      <span className={cn("text-small", value === "yearly" ? "text-foreground font-medium" : "text-muted-foreground")}>
        {t("billingYearly")}
        <span className="ml-1.5 px-1.5 py-0.5 bg-success/10 text-success text-caption rounded-full font-medium">
          {t("save20")}
        </span>
      </span>
    </div>
  );
}
