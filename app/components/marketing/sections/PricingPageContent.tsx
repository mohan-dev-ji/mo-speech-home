"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { PricingToggle } from "@/app/components/marketing/ui/PricingToggle";
import { PricingCard } from "@/app/components/marketing/ui/PricingCard";
import { track } from "@/lib/analytics";

type TierKey = "free" | "pro" | "max";

const tiers: ReadonlyArray<{
  key: TierKey;
  ctaHref: string;
  highlighted: boolean;
  hasPrice: boolean;
  features: ReadonlyArray<string>;
}> = [
  {
    key: "free",
    ctaHref: "/sign-up",
    highlighted: false,
    hasPrice: false,
    features: ["freeFeature1", "freeFeature2", "freeFeature3", "freeFeature4"],
  },
  {
    key: "pro",
    ctaHref: "/sign-up",
    highlighted: true,
    hasPrice: true,
    features: [
      "proFeature1",
      "proFeature2",
      "proFeature3",
      "proFeature4",
      "proFeature5",
    ],
  },
  {
    key: "max",
    ctaHref: "/sign-up",
    highlighted: false,
    hasPrice: true,
    features: [
      "maxFeature1",
      "maxFeature2",
      "maxFeature3",
      "maxFeature4",
      "maxFeature5",
    ],
  },
];

// Rows are ordered so universals appear first, then Pro+ unlocks, then
// Max-only. Reads top-to-bottom as a progression of what each tier adds.
const comparisonRows: ReadonlyArray<{
  labelKey: string;
  free: boolean;
  pro: boolean;
  max: boolean;
}> = [
  { labelKey: "compareSymbolSearch",      free: true,  pro: true, max: true },
  { labelKey: "compareStarterPack",       free: true,  pro: true, max: true },
  { labelKey: "compareCategories",        free: false, pro: true, max: true },
  { labelKey: "compareModelling",         free: false, pro: true, max: true },
  { labelKey: "compareProPacks",          free: false, pro: true, max: true },
  { labelKey: "compareCustomSymbols",     free: false, pro: true, max: true },
  { labelKey: "compareImageAi",           free: false, pro: false, max: true },
  { labelKey: "comparePremiumThemes",     free: false, pro: false, max: true },
  { labelKey: "compareFamilyInvites",     free: false, pro: false, max: true },
  { labelKey: "compareUnlimitedProfiles", free: false, pro: false, max: true },
];

export function PricingPageContent() {
  const t = useTranslations("marketingPricing");
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");

  // Fire viewed_pricing once on mount. Anonymous visitors get a PostHog-
  // generated distinctId; the alias-to-Clerk-userId happens automatically on
  // signup, preserving the viewed_pricing → signed_up funnel.
  useEffect(() => {
    track("viewed_pricing", { source: "nav" });
  }, []);

  return (
    <div className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-heading font-bold mb-4">{t("pageTitle")}</h1>
          <p className="text-muted-foreground mb-8">{t("pageSubtitle")}</p>
          <PricingToggle value={plan} onChange={setPlan} />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 items-start">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.key}
              name={t(`${tier.key}Name`)}
              description={t(`${tier.key}Desc`)}
              price={
                tier.hasPrice
                  ? {
                      monthly: t(`${tier.key}PriceMonthly`),
                      yearly: t(`${tier.key}PriceYearly`),
                    }
                  : null
              }
              features={tier.features.map((f) => t(f))}
              cta={t(`${tier.key}Cta`)}
              ctaHref={tier.ctaHref}
              highlighted={tier.highlighted}
              plan={plan}
              mostPopularLabel={t("mostPopular")}
              perMonthSuffix={t("perMonthSuffix")}
              perYearSuffix={t("perYearSuffix")}
              freePriceLabel={t("freePriceLabel")}
            />
          ))}
        </div>

        {/* Feature comparison */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-subheading font-bold text-center mb-8">
            {t("comparisonHeading")}
          </h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 font-medium">{t("comparisonColFeature")}</th>
                  <th className="text-center p-4 font-medium">{t("comparisonColFree")}</th>
                  <th className="text-center p-4 font-medium text-primary">{t("comparisonColPro")}</th>
                  <th className="text-center p-4 font-medium">{t("comparisonColMax")}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.labelKey} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="p-4 text-foreground">{t(row.labelKey)}</td>
                    {(["free", "pro", "max"] as const).map((tier) => (
                      <td key={tier} className="p-4 text-center">
                        {row[tier] ? (
                          <Check className="w-4 h-4 text-success mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
