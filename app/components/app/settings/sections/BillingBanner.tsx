"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function BillingBanner() {
  const t = useTranslations("billing");
  const params   = useParams();
  const locale   = (params?.locale as string) ?? "en";
  const router   = useRouter();
  const searchParams = useSearchParams();
  const success   = searchParams.get("success")   === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  useEffect(() => {
    if (success || cancelled) {
      const timer = setTimeout(() => router.replace(`/${locale}/settings`), 4000);
      return () => clearTimeout(timer);
    }
  }, [success, cancelled, router, locale]);

  if (!success && !cancelled) return null;
  return success ? (
    <div className="rounded-theme bg-green-950 border border-green-800 px-4 py-3 text-small text-green-200">
      {t("activated")}
    </div>
  ) : (
    <div className="rounded-theme bg-muted border border-border px-4 py-3 text-small text-muted-foreground">
      {t("cancelled")}
    </div>
  );
}
