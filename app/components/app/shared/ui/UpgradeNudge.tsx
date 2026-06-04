"use client";

// Reusable modal shown when a free-tier user hits a Pro+ gated affordance.
// Mounted next to the gated trigger; the trigger flips `open` to true instead
// of running its normal action. CTA navigates the user to /settings where
// they can open the existing PlanModal via the Plan tile.
//
// Pattern mirrors the ImagesTab / AiGenerateTab inline upsell (lock icon +
// title + body) but in a centred Dialog so it works for in-place actions
// (Edit toggle, Create button) rather than full-tab takeovers.

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { track } from "@/lib/analytics";

type UpgradeNudgeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Translation key under `upgrade.*` for the body copy. Each feature maps to
   *  an `<feature>Body` key in the `upgrade` namespace. */
  feature?: "editAuthoring" | "multiLanguage";
  locale: string;
};

export function UpgradeNudge({
  open,
  onOpenChange,
  feature = "editAuthoring",
  locale,
}: UpgradeNudgeProps) {
  const t = useTranslations("upgrade");
  const router = useRouter();
  const { subscription } = useAppState();

  const bodyKey = `${feature}Body` as "editAuthoringBody" | "multiLanguageBody";

  const handleSeePlans = () => {
    // Fire BEFORE close so the event fires while the component is still
    // mounted (defensive — capture is fire-and-forget so it works either way).
    track("clicked_upgrade", {
      from_tier: subscription.tier,
      // V1: every UpgradeNudge instance is the edit-authoring Pro gate.
      // When we add additional gated features at Max-only surfaces, route
      // the target_tier from the `feature` prop accordingly.
      target_tier: "pro",
      source: feature,
    });
    onOpenChange(false);
    // Deep-link the Account & Billing modal via `?modal=plan` — SettingsContent
    // reads the param on mount, opens the PlanModal, then strips the query
    // so refresh doesn't re-open.
    router.push(`/${locale}/settings?modal=plan`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--theme-symbol-bg)" }}
            >
              <Lock
                className="w-5 h-5"
                style={{ color: "var(--theme-secondary-text)" }}
              />
            </div>
            <DialogTitle>{t("proFeatureTitle")}</DialogTitle>
          </div>
          <DialogDescription>{t(bodyKey)}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {t("ctaMaybeLater")}
          </Button>
          <Button onClick={handleSeePlans}>{t("ctaSeePlans")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
