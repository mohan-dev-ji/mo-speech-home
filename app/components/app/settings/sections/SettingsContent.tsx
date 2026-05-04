"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { Dialog, DialogContent } from "@/app/components/app/shared/ui/Dialog";
import { InstructorProfileModal } from "@/app/components/app/settings/modals/InstructorProfileModal";
import { ProfileModal }  from "@/app/components/app/settings/modals/ProfileModal";
import { PlanModal }     from "@/app/components/app/settings/modals/PlanModal";
import { InvitesModal }  from "@/app/components/app/settings/modals/InvitesModal";
import { ScaffoldModal } from "@/app/components/app/settings/modals/ScaffoldModal";
import { DevTestPanel }  from "@/app/components/app/settings/sections/DevTestPanel";
import { LanguageRow }   from "@/app/components/app/settings/sections/LanguageRow";
import { Users } from "lucide-react";

const OWNER_SETTINGS_IDS = [
  "instructor", "profile", "plan", "navbar", "invites",
] as const;

const COLLABORATOR_SETTINGS_IDS = [
  "instructor", "navbar",
] as const;

type SettingId = typeof OWNER_SETTINGS_IDS[number];

const MODAL_SIZE: Partial<Record<SettingId, string>> = {
  instructor: "max-w-lg",
  profile:    "max-w-lg",
  plan:       "max-w-3xl",
  invites:    "max-w-2xl",
};

export function SettingsContent() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const { isCollaborator } = useAppState();
  const [activeModal, setActiveModal] = useState<SettingId | null>(null);

  const open  = (id: SettingId) => setActiveModal(id);
  const close = () => setActiveModal(null);

  const settingsIds = isCollaborator ? COLLABORATOR_SETTINGS_IDS : OWNER_SETTINGS_IDS;

  const renderModal = () => {
    switch (activeModal) {
      case "instructor": return <InstructorProfileModal onClose={close} />;
      case "profile":    return <ProfileModal onClose={close} />;
      case "plan":       return <PlanModal    onClose={close} />;
      case "navbar":     return <ScaffoldModal title={t("navbar")} onClose={close} />;
      case "invites":    return <InvitesModal onClose={close} onOpenPlan={() => { close(); open("plan"); }} />;
    }
  };

  return (
    <div className="p-theme-general flex flex-col gap-theme-gap">
      <div className="rounded-theme bg-theme-primary px-6 py-8">
        <h1 className="text-theme-h4 font-semibold text-theme-alt-text">{t("title")}</h1>
      </div>

      <LanguageRow />

      {isCollaborator && (
        <div className="flex items-center gap-3 rounded-theme bg-theme-card px-5 py-3">
          <Users className="w-4 h-4 text-theme-secondary-text shrink-0" />
          <p className="text-theme-s text-theme-secondary-text">{t("collaboratorNotice")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-theme-gap">
        {settingsIds.map(id => (
          <button
            key={id}
            onClick={() => open(id)}
            className="rounded-theme bg-theme-card text-left px-6 py-8 hover:bg-theme-banner transition-colors"
          >
            <span className="text-theme-p text-theme-alt-text">{t(id)}</span>
          </button>
        ))}
      </div>

      <Dialog open={activeModal !== null} onOpenChange={isOpen => { if (!isOpen) close(); }}>
        <DialogContent className={MODAL_SIZE[activeModal ?? "instructor"] ?? "max-w-md"}>
          {renderModal()}
        </DialogContent>
      </Dialog>

      {!isCollaborator && <DevTestPanel currentLocale={locale} />}
    </div>
  );
}
