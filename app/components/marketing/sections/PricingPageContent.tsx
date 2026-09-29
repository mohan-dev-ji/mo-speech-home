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
  /** Price keys; null for Free, which shows the free price label. */
  priceKeys: { monthly: string; yearly: string } | null;
  features: ReadonlyArray<string>;
}> = [
  {
    key: "free",
    ctaHref: "/sign-up",
    highlighted: false,
    priceKeys: null,
    features: [
      "freeListBoards",
      "freeListSearch",
      "freeListTalker",
      "freeListModules",
      "freeListThemes",
    ],
  },
  {
    key: "pro",
    ctaHref: "/sign-up",
    highlighted: true,
    priceKeys: { monthly: "proPricePerMonth", yearly: "proPricePerYear" },
    features: [
      "proListEverythingFree",
      "proListEdit",
      "proListSaveSentences",
      "proListAudio",
      "proListModelling",
      "proListLanguages",
      "proListModules",
    ],
  },
  {
    key: "max",
    ctaHref: "/sign-up",
    highlighted: false,
    priceKeys: { monthly: "maxPricePerMonth", yearly: "maxPricePerYear" },
    features: [
      "maxListEverythingPro",
      "maxListUpload",
      "maxListImageSearch",
      "maxListAi",
      "maxListMyImages",
      "maxListTones",
      "maxListThemes",
      "maxListInvites",
      "maxListModules",
    ],
  },
];

// One row per FEAT-108 plan line. Ordered as a progression: what every plan
// gets (using it), then what Pro adds (shaping it with SymbolStix), then what
// Max adds (going beyond SymbolStix, plus the extras).
const comparisonRows: ReadonlyArray<{
  labelKey: string;
  free: boolean;
  pro: boolean;
  max: boolean;
}> = [
  { labelKey: "compareRowBoards",        free: true,  pro: true,  max: true },
  { labelKey: "compareRowSearch",        free: true,  pro: true,  max: true },
  { labelKey: "compareRowTalker",        free: true,  pro: true,  max: true },
  { labelKey: "compareRowFreeModules",   free: true,  pro: true,  max: true },
  { labelKey: "compareRowBaseThemes",    free: true,  pro: true,  max: true },
  { labelKey: "compareRowEdit",          free: false, pro: true,  max: true },
  { labelKey: "compareRowSaveSentences", free: false, pro: true,  max: true },
  { labelKey: "compareRowAudio",         free: false, pro: true,  max: true },
  { labelKey: "compareRowModelling",     free: false, pro: true,  max: true },
  { labelKey: "compareRowLanguages",     free: false, pro: true,  max: true },
  { labelKey: "compareRowProModules",    free: false, pro: true,  max: true },
  { labelKey: "compareRowUpload",        free: false, pro: false, max: true },
  { labelKey: "compareRowImageSearch",   free: false, pro: false, max: true },
  { labelKey: "compareRowAi",            free: false, pro: false, max: true },
  { labelKey: "compareRowMyImages",      free: false, pro: false, max: true },
  { labelKey: "compareRowTones",         free: false, pro: false, max: true },
  { labelKey: "compareRowPremiumThemes", free: false, pro: false, max: true },
  { labelKey: "compareRowInvites",       free: false, pro: false, max: true },
  { labelKey: "compareRowMaxModules",    free: false, pro: false, max: true },
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
          <p className="text-muted-foreground mb-8">{t("pageSubtitleTiers")}</p>
          <PricingToggle value={plan} onChange={setPlan} />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.key}
              name={t(`${tier.key}Name`)}
              description={t(`${tier.key}Tagline`)}
              price={
                tier.priceKeys
                  ? {
                      monthly: t(tier.priceKeys.monthly),
                      yearly: t(tier.priceKeys.yearly),
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
