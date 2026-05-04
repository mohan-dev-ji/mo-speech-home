"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

interface PricingCardProps {
  name: string;
  description: string;
  price: { monthly: string; yearly: string } | null;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  plan: "monthly" | "yearly";
  // Localised chrome — passed in from parent (PricingPage) which owns the translations.
  mostPopularLabel: string;
  perMonthSuffix: string;
  perYearSuffix: string;
  freePriceLabel: string;
}

export function PricingCard({
  name,
  description,
  price,
  features,
  cta,
  ctaHref,
  highlighted = false,
  plan,
  mostPopularLabel,
  perMonthSuffix,
  perYearSuffix,
  freePriceLabel,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-8 flex flex-col",
        highlighted
          ? "border-primary bg-primary/5 shadow-lg scale-105"
          : "border-border bg-card"
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-caption font-medium rounded-full">
          {mostPopularLabel}
        </span>
      )}

      <div className="mb-6">
        <h3 className="font-bold text-subheading mb-1">{name}</h3>
        <p className="text-small text-muted-foreground">{description}</p>
      </div>

      <div className="mb-8">
        {price ? (
          <>
            <span className="text-display font-bold">
              {plan === "monthly" ? price.monthly : price.yearly}
            </span>
            <span className="text-muted-foreground text-small ml-1">
              / {plan === "monthly" ? perMonthSuffix : perYearSuffix}
            </span>
          </>
        ) : (
          <span className="text-display font-bold">{freePriceLabel}</span>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-small">
            <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={cn(
          "block text-center px-6 py-3 rounded-lg font-medium text-small transition-opacity",
          highlighted
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "border border-border hover:bg-muted text-foreground"
        )}
      >
        {cta}
      </Link>
    </div>
  );
}
