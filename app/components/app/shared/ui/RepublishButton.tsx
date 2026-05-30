"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/app/components/app/shared/ui/Toast";
import { SavePackChangesConfirmModal } from "@/app/components/app/shared/modals/SavePackChangesConfirmModal";

type Props = {
  packSlug: string;
  /**
   * Display name of the pack, used in the confirmation modal title.
   * Falls back to the slug when omitted — passing the localised display
   * string keeps the modal copy friendly.
   */
  packName?: string;
  /** Button label override. Defaults to "Republish to JSON". */
  label?: string;
  className?: string;
  /**
   * When `true`, the button is rendered disabled and skips the modal.
   * Driven by `hasPackEdits` upstream — disable when there are no edits
   * to save since the last successful Republish. Cancel-state, not
   * loading-state (the spinner during the actual fetch is separate).
   */
  disabled?: boolean;
  /**
   * Tooltip (HTML `title`) shown when `disabled` is true. Caller is
   * expected to localise — e.g. "No unsaved edits" or "Filter by pack
   * to enable" depending on context.
   */
  disabledTooltip?: string;
};

/**
 * Small admin affordance for re-running the JSON publish for a pack the
 * current row belongs to. Used on category / list / sentence detail pages
 * after the row is already linked to a `packLifecycle` via the modal flow —
 * lets the admin push subsequent content edits to the on-disk JSON without
 * un-toggling and re-toggling the Library state.
 *
 * Click flow: button → SavePackChangesConfirmModal (destructive warning) →
 * on confirm, POSTs to `/api/admin/pack-publish` (dev-only). Toast on
 * success/failure. Modal stays open during the fetch (busy spinner on the
 * confirm button); closes on success.
 *
 * Hidden by the caller when not in admin viewMode. The dirty-state gate
 * (`hasPackEdits` → `disabled` prop) is also caller-driven so each surface
 * decides whether to subscribe.
 */
export function RepublishButton({
  packSlug,
  packName,
  label,
  className,
  disabled = false,
  disabledTooltip,
}: Props) {
  const t = useTranslations("packPicker");
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function runPublish() {
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
      setModalOpen(false);
    } catch (e) {
      console.error("[RepublishButton] publish failed", e);
      showToast({ tone: "warning", title: t("publishGenericError") });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClick() {
    if (disabled || submitting) return;
    setModalOpen(true);
  }

  const isInteractiveDisabled = disabled || submitting;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isInteractiveDisabled}
        title={disabled ? disabledTooltip : undefined}
        className={[
          "flex items-center gap-1.5 px-3 py-1.5 rounded-theme-sm text-theme-s font-medium",
          "transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          background: "rgba(255,200,0,0.10)",
          border: "1px solid rgba(255,200,0,0.30)",
          color: "var(--theme-text-primary)",
        }}
        aria-label={label ?? t("republishAria")}
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${submitting ? "animate-spin" : ""}`}
        />
        {submitting ? t("saving") : (label ?? t("republishLabel"))}
      </button>

      <SavePackChangesConfirmModal
        slug={packSlug}
        packName={packName ?? packSlug}
        open={modalOpen}
        onOpenChange={(next) => {
          // Don't allow closing the modal mid-fetch — confirm button shows
          // the spinner, but the dialog's overlay-click / ESC could
          // otherwise leave a dangling fetch with no UI indication.
          if (submitting && !next) return;
          setModalOpen(next);
        }}
        onConfirm={runPublish}
        busy={submitting}
      />
    </>
  );
}
