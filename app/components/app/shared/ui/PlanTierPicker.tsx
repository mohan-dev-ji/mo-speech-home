"use client";

import { useTranslations } from "next-intl";

export type PlanTier = "free" | "pro" | "max";

const TIERS: PlanTier[] = ["free", "pro", "max"];

type PlanTierPickerProps = {
  value: PlanTier;
  onChange: (tier: PlanTier) => void;
  disabled?: boolean;
  // Translation namespace for tier labels — defaults to common namespace
  // ("planTierFree" / "planTierPro" / "planTierMax"). Pass a different
  // namespace to use editor-specific translations.
  translationNamespace?: string;
};

/**
 * Three small inline buttons for picking a pack's plan tier.
 *
 * Used inside the admin row of editor toolbars (BannerEdit, ListDetailContent,
 * SortableSentenceRow). The active tier is highlighted with the existing
 * --theme-button-highlight token; inactive tiers are muted text.
 *
 * Disabled when the parent's Library toggle is off.
 */
export function PlanTierPicker({
  value,
  onChange,
  disabled = false,
  translationNamespace = "common",
}: PlanTierPickerProps) {
  const t = useTranslations(translationNamespace);
  const labelKey: Record<PlanTier, string> = {
    free: "planTierFree",
    pro: "planTierPro",
    max: "planTierMax",
  };

  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-1 rounded-theme-sm"
      style={{
        background: "rgba(0,0,0,0.18)",
        opacity: disabled ? 0.4 : 1,
      }}
      role="radiogroup"
      aria-label="Plan tier"
    >
      {TIERS.map((tier) => {
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={disabled ? undefined : () => onChange(tier)}
            disabled={disabled}
            className="px-2 py-0.5 rounded-theme-sm text-caption font-medium transition-opacity"
            style={
              active
                ? {
                    background: "var(--theme-button-highlight)",
                    color: "var(--theme-text)",
                  }
                : {
                    background: "transparent",
                    color: "var(--theme-text-secondary)",
                    opacity: 0.7,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }
            }
          >
            {t(labelKey[tier])}
          </button>
        );
      })}
    </div>
  );
}
