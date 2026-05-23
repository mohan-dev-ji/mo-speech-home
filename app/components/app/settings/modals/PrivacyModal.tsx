"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/contexts/AppStateProvider";

/**
 * Data & Privacy settings — controls the user's analytics opt-out.
 *
 * Two writes happen in tandem:
 *   1. `setAnalyticsOptOut` mutation persists the choice to Convex so the
 *      opt-out follows the user across devices. AppStateProvider reads it
 *      on next session and respects the choice immediately.
 *   2. `posthog.opt_in_capturing()` / `opt_out_capturing()` toggles the
 *      client-side SDK so the change takes effect in this session without
 *      a reload.
 *
 * Default is opted in (analyticsOptOut absent or false) — see plan §1 and the
 * disclosure copy below for the privacy basis.
 */
export function PrivacyModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("privacy");
  const { userRecord } = useAppState();
  const setOptOut = useMutation(api.users.setAnalyticsOptOut);

  // Local state mirrors the saved value so the toggle reflects user input
  // immediately even before the Convex round-trip completes.
  const initialOptedIn = userRecord?.analyticsOptOut !== true;
  const [optedIn, setOptedIn] = useState<boolean>(initialOptedIn);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (next: boolean) => {
    setOptedIn(next);
    // Apply client-side immediately so the change takes effect in-session.
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
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="rounded-theme border border-theme-line p-4 mt-2">
        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div className="flex-1 min-w-0">
            <p className="text-theme-p font-medium text-theme-alt-text">
              {t("toggleLabel")}
            </p>
            <p className="text-theme-s text-theme-secondary-text mt-1">
              {optedIn ? t("toggleOnHint") : t("toggleOffHint")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={optedIn}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={saving}
            className="mt-1 w-5 h-5 accent-theme-button-highlight cursor-pointer disabled:opacity-50"
          />
        </label>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>
            {t("close")}
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
