"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { useAppState } from "@/app/contexts/AppStateProvider";

/**
 * Shown on Home when a pending family invite couldn't be accepted because this
 * account already has its own students (MOS-94). Same markup and tokens as the
 * collaborator notice in SettingsContent.
 */
export function InviteNotice() {
  const t = useTranslations("home");
  const { inviteNotice } = useAppState();
  if (inviteNotice !== "has_students") return null;

  return (
    <div className="flex items-center gap-3 rounded-theme-sm bg-theme-surface px-5 py-3">
      <Users className="h-4 w-4 shrink-0 text-theme-secondary-alt-text" />
      <p className="text-theme-s text-theme-secondary-alt-text">
        <strong className="block font-semibold">{t("inviteHasStudentsTitle")}</strong>
        {t("inviteHasStudentsBody")}
      </p>
    </div>
  );
}
