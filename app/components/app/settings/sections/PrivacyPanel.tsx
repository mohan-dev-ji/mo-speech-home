"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { SettingsSection } from "@/app/components/app/settings/ui/SettingsSection";

/**
 * Data & Privacy tab — ports `PrivacyModal`. Analytics opt-out toggle: persists
 * to Convex (`setAnalyticsOptOut`) and flips the PostHog client SDK in tandem so
 * the change takes effect in-session. Default is opted in.
 */
export function PrivacyPanel() {
  const t = useTranslations("privacy");
  const { userRecord } = useAppState();
  const setOptOut = useMutation(api.users.setAnalyticsOptOut);

  const initialOptedIn = userRecord?.analyticsOptOut !== true;
  const [optedIn, setOptedIn] = useState<boolean>(initialOptedIn);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (next: boolean) => {
    setOptedIn(next);
    if (next) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
    setSaving(true);
    try {
      await setOptOut({ optOut: !next });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection title={t("title")}>
      <p className="text-theme-s text-theme-secondary-alt-text">{t("description")}</p>
      <label className="flex cursor-pointer items-start justify-between gap-theme-gap rounded-theme-sm border border-theme-line p-theme-general">
        <div className="min-w-0 flex-1">
          <p className="text-theme-p font-medium text-theme-alt-text">{t("toggleLabel")}</p>
          <p className="mt-1 text-theme-s text-theme-secondary-alt-text">
            {optedIn ? t("toggleOnHint") : t("toggleOffHint")}
          </p>
        </div>
        <input
          type="checkbox"
          checked={optedIn}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={saving}
          className="mt-1 size-5 cursor-pointer accent-theme-button-highlight disabled:opacity-50"
        />
      </label>
    </SettingsSection>
  );
}
