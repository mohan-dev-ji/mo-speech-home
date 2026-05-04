"use client";

import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";

export function Hero() {
  const t = useTranslations("marketingHero");
  const { isSignedIn } = useUser();
  const appHref = isSignedIn ? "/start?pick=true" : "/sign-in";

  return (
    <section className="py-24 md:py-32 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-caption font-medium mb-6">
          {t("betaBadge")}
        </span>
        <h1 className="text-display font-bold tracking-tight mb-6">
          {t("titleLine1")}
          <br />
          <span className="text-primary">{t("titleLine2")}</span>
        </h1>
        <p className="text-subheading text-muted-foreground max-w-xl mx-auto mb-10">
          {t("tagline")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={appHref}
            className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto px-8 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors text-foreground"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
