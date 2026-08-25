"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { SettingsSection } from "@/app/components/app/settings/ui/SettingsSection";
import { CreditList } from "@/app/components/app/shared/ui/CreditList";

/**
 * Credits tab (Phase 31 Task 4) — where the app discharges the Creative
 * Commons attribution obligation for Image Search photos. Always present,
 * including when the registry is empty: a fixed, predictable location is
 * what makes a separate credits screen "reasonable to the medium" — hiding
 * it or gating its existence on having content would defeat that.
 *
 * Fetches `getAccountImageCredits` and owns the loading/empty states;
 * `CreditList` stays presentational (props in, markup out).
 */
export function CreditsPanel() {
  const t = useTranslations("credits");
  const credits = useQuery(api.imageCredits.getAccountImageCredits);

  return (
    <SettingsSection title={t("title")}>
      <p className="text-theme-s text-theme-secondary-alt-text">{t("description")}</p>
      {credits === undefined ? (
        <p className="py-4 text-center text-theme-s text-theme-secondary-alt-text">{t("loading")}</p>
      ) : credits.length === 0 ? (
        <p className="py-4 text-center text-theme-s text-theme-secondary-alt-text">{t("emptyState")}</p>
      ) : (
        <CreditList credits={credits} />
      )}
    </SettingsSection>
  );
}
