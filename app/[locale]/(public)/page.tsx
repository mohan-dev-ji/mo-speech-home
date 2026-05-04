import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/app/components/marketing/sections/Hero";
import { Features } from "@/app/components/marketing/sections/Features";
import { CTABanner } from "@/app/components/marketing/sections/CTABanner";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketingHero" });
  return {
    title: t("titleLine1"),
    description: t("tagline"),
  };
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero />
      <Features />
      <CTABanner />
    </>
  );
}
