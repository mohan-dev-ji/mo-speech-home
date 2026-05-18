import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PricingPageContent } from "@/app/components/marketing/sections/PricingPageContent";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketingPricing" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
  };
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Pricing page is a marketing surface for anonymous visitors only.
  // Authenticated users get the canonical billing surface (PlanModal in
  // settings), where the current plan, upgrade/downgrade and Stripe
  // checkout/portal already live. Server-side redirect keeps the
  // two surfaces from drifting (single source of truth for in-app billing).
  const { userId } = await auth();
  if (userId) {
    redirect(`/${locale}/settings?modal=plan`);
  }

  return <PricingPageContent />;
}
