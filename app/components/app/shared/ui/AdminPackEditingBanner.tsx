"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  /** Render only when this is true. Caller decides — typically
   *  `showAdminButtons && (isDefault || isInLibrary)`. */
  visible: boolean;
  /** Optional pack name shown after the disclaimer (e.g. "Default" /
   *  "Religion Pack"). Helps the admin remember which pack they're
   *  affecting. */
  packLabel?: string;
};

/**
 * Disclaimer shown above the edit toolbar when an admin is editing
 * default/starter-origin content (`librarySourceId === "_starter"`).
 *
 * Acts as a constant reminder that admin-view edits to this default content
 * will be seen by every new sign-up that installs it. Only rendered in admin
 * view; instructor / student views never see it.
 *
 * Yellow/amber tint matches the existing admin-chrome styling on toggle
 * rows. Text is i18n-keyed under `adminPackEditing.*`.
 */
export function AdminPackEditingBanner({ visible, packLabel }: Props) {
  const t = useTranslations("adminPackEditing");
  if (!visible) return null;

  return (
    <div
      className="flex items-start gap-2 rounded-theme px-3 py-2"
      style={{
        background: "rgba(255,200,0,0.10)",
        border: "1px solid rgba(255,200,0,0.30)",
        color: "var(--theme-warning)",
      }}
      role="status"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <p className="text-theme-s leading-snug" style={{ color: "var(--theme-text-primary)" }}>
        {packLabel ? t("withPack", { pack: packLabel }) : t("default")}
      </p>
    </div>
  );
}
