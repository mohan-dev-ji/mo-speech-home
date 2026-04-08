"use client";

import { useState } from "react";
import { PricingToggle } from "@/app/components/marketing/ui/PricingToggle";
import { PricingCard } from "@/app/components/marketing/ui/PricingCard";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Free",
    description: "Perfect for getting started.",
    price: null,
    features: [
      "Up to 100 [units] per month",
      "Core features",
      "Community support",
      "1 user",
    ],
    cta: "Get started free",
    ctaHref: "/sign-up",
    tier: "free",
  },
  {
    name: "Pro",
    description: "For individuals and small teams.",
    price: { monthly: "$12", yearly: "$96" },
    features: [
      "Unlimited [units]",
      "All core features",
      "Priority email support",
      "Up to 5 users",
      "Advanced analytics",
    ],
    cta: "Start Pro",
    ctaHref: "/sign-up",
    tier: "pro",
    highlighted: true,
  },
  {
    name: "Max",
    description: "For families who want everything.",
    price: { monthly: "£14.99", yearly: "£119" },
    features: [
      "Everything in Pro",
      "Premium themes",
      "Family member invitations",
      "Mo Speech School connection",
      "Voice cloning (coming soon)",
    ],
    cta: "Start Max",
    ctaHref: "/sign-up",
    tier: "max",
  },
];

const featureComparison = [
  { feature: "Core features", free: true, pro: true, max: true },
  { feature: "Unlimited [units]", free: false, pro: true, max: true },
  { feature: "Advanced analytics", free: false, pro: true, max: true },
  { feature: "Priority support", free: false, pro: true, max: true },
  { feature: "Unlimited users", free: false, pro: false, max: true },
  { feature: "Custom integrations", free: false, pro: false, max: true },
  { feature: "SLA guarantee", free: false, pro: false, max: true },
];

export default function PricingPage() {
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-heading font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-muted-foreground mb-8">
            Start free, upgrade when you&apos;re ready. No hidden fees.
          </p>
          <PricingToggle value={plan} onChange={setPlan} />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 items-start">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.name}
              {...tier}
              highlighted={tier.highlighted ?? false}
              plan={plan}
            />
          ))}
        </div>

        {/* Feature comparison */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-subheading font-bold text-center mb-8">
            Feature comparison
          </h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 font-medium">Feature</th>
                  <th className="text-center p-4 font-medium">Free</th>
                  <th className="text-center p-4 font-medium text-primary">Pro</th>
                  <th className="text-center p-4 font-medium">Business</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="p-4 text-foreground">{row.feature}</td>
                    {(["free", "pro", "max"] as const).map((t) => (
                      <td key={t} className="p-4 text-center">
                        {row[t] ? (
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
