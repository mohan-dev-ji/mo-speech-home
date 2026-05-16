"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/app/components/app/shared/ui/Toast";

type Props = {
  packSlug: string;
  /** Hint label, e.g. "Republish to JSON". Defaults to the i18n key. */
  label?: string;
  className?: string;
};

/**
 * Small admin affordance for re-running the JSON publish for a pack the
 * current row belongs to. Used on category / list / sentence detail pages
 * after the row is already linked to a `packLifecycle` via the modal flow —
 * lets the admin push subsequent content edits to the on-disk JSON without
 * un-toggling and re-toggling the Library state.
 *
 * POSTs to `/api/admin/pack-publish` (dev-only). Shows a toast on success
 * or failure. Hidden by the caller when not in admin viewMode or when
 * `packSlug` is unset.
 */
export function RepublishButton({ packSlug, label, className }: Props) {
  const t = useTranslations("packPicker");
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/pack-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: packSlug }),
      });
      if (!res.ok) {
        let message = t("publishGenericError");
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* ignore */
        }
        showToast({ tone: "warning", title: message });
        return;
      }
      showToast({ tone: "info", title: t("savedAndPublishedToast") });
    } catch (e) {
      console.error("[RepublishButton] publish failed", e);
      showToast({ tone: "warning", title: t("publishGenericError") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium",
        "transition-opacity hover:opacity-90 disabled:opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: "rgba(255,200,0,0.10)",
        border: "1px solid rgba(255,200,0,0.30)",
        color: "var(--theme-text-primary)",
      }}
      aria-label={label ?? "Republish pack to JSON"}
    >
      <RefreshCw
        className={`w-3.5 h-3.5 ${submitting ? "animate-spin" : ""}`}
      />
      {submitting ? t("saving") : (label ?? "Republish to JSON")}
    </button>
  );
}
