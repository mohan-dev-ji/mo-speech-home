"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAppState } from "@/app/components/AppStateProvider";
import { Dialog, DialogContent } from "@/app/components/shared/ui/Dialog";
import { ProfileModal }  from "@/app/components/app/settings/modals/ProfileModal";
import { PlanModal }     from "@/app/components/app/settings/modals/PlanModal";
import { VoiceModal }    from "@/app/components/app/settings/modals/VoiceModal";
import { ThemeModal }    from "@/app/components/app/settings/modals/ThemeModal";
import { GridModal }     from "@/app/components/app/settings/modals/GridModal";
import { SymbolsModal }  from "@/app/components/app/settings/modals/SymbolsModal";
import { InvitesModal }  from "@/app/components/app/settings/modals/InvitesModal";
import { ScaffoldModal } from "@/app/components/app/settings/modals/ScaffoldModal";
import { Users } from "lucide-react";

const OWNER_SETTINGS_IDS = [
  "profile", "plan", "voice", "theme",
  "symbols", "grid", "navbar", "invites",
] as const;

const COLLABORATOR_SETTINGS_IDS = [
  "profile", "voice", "theme",
  "symbols", "grid", "navbar",
] as const;

type SettingId = typeof OWNER_SETTINGS_IDS[number];

const MODAL_SIZE: Partial<Record<SettingId, string>> = {
  plan:    "max-w-3xl",
  profile: "max-w-lg",
  theme:   "max-w-md",
  voice:   "max-w-sm",
  invites: "max-w-2xl",
};

export function SettingsContent() {
  const t = useTranslations("settings");
  const { isCollaborator } = useAppState();
  const [activeModal, setActiveModal] = useState<SettingId | null>(null);

  const open  = (id: SettingId) => setActiveModal(id);
  const close = () => setActiveModal(null);

  const settingsIds = isCollaborator ? COLLABORATOR_SETTINGS_IDS : OWNER_SETTINGS_IDS;

  const renderModal = () => {
    switch (activeModal) {
      case "profile": return <ProfileModal  onClose={close} />;
      case "plan":    return <PlanModal     onClose={close} />;
      case "voice":   return <VoiceModal    onClose={close} />;
      case "theme":   return <ThemeModal    onClose={close} />;
      case "symbols": return <SymbolsModal onClose={close} />;
      case "grid":    return <GridModal onClose={close} />;
      case "navbar":  return <ScaffoldModal title={t("navbar")}  onClose={close} />;
      case "invites": return <InvitesModal onClose={close} onOpenPlan={() => { close(); open("plan"); }} />;
    }
  };

  return (
    <div className="p-theme-general flex flex-col gap-theme-gap">
      <div className="rounded-theme bg-theme-primary px-6 py-8">
        <h1 className="text-theme-h4 font-semibold text-theme-alt-text">{t("title")}</h1>
      </div>

      {/* Collaborator notice */}
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
        <DialogContent className={MODAL_SIZE[activeModal ?? "symbols"] ?? "max-w-md"}>
          {renderModal()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
