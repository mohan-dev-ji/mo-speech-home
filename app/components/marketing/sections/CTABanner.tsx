"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";

export function CTABanner() {
  const t = useTranslations("marketingCta");
  const { isSignedIn } = useUser();
  const appHref = isSignedIn ? "/start?pick=true" : "/sign-in";

  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-heading font-bold mb-4">
          {t("heading")}
        </h2>
        <p className="text-muted-foreground mb-8">
          {t("body")}
        </p>
        <Link
          href={appHref}
          className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
