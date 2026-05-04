"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";

// See Hero.tsx for the dual-Link rationale.

export function CTABanner() {
  const t = useTranslations("marketingCta");
  const { isSignedIn } = useUser();

  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-heading font-bold mb-4">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground mb-8">
          {t("body")}
        </p>
        {isSignedIn ? (
          <Link
            href="/home"
            className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {t("ctaGoToApp")}
          </Link>
        ) : (
          <NextLink
            href="/sign-up"
            className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {t("cta")}
          </NextLink>
        )}
      </div>
    </section>
  );
}
