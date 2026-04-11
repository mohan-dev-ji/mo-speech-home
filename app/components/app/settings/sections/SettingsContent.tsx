"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent } from "@/app/components/shared/ui/Dialog";
import { ProfileModal }  from "@/app/components/app/settings/modals/ProfileModal";
import { PlanModal }     from "@/app/components/app/settings/modals/PlanModal";
import { VoiceModal }    from "@/app/components/app/settings/modals/VoiceModal";
import { ThemeModal }    from "@/app/components/app/settings/modals/ThemeModal";
import { ScaffoldModal } from "@/app/components/app/settings/modals/ScaffoldModal";

const SETTINGS_IDS = [
  "profile", "plan", "voice", "theme",
  "symbols", "grid", "navbar", "invites",
] as const;

type SettingId = typeof SETTINGS_IDS[number];

const MODAL_SIZE: Partial<Record<SettingId, string>> = {
  plan:    "max-w-3xl",
  profile: "max-w-md",
  theme:   "max-w-md",
  voice:   "max-w-sm",
};

export function SettingsContent() {
  const t = useTranslations("settings");
  const [activeModal, setActiveModal] = useState<SettingId | null>(null);

  const open  = (id: SettingId) => setActiveModal(id);
  const close = () => setActiveModal(null);

  const renderModal = () => {
    switch (activeModal) {
      case "profile": return <ProfileModal  onClose={close} />;
      case "plan":    return <PlanModal     onClose={close} />;
      case "voice":   return <VoiceModal    onClose={close} />;
      case "theme":   return <ThemeModal    onClose={close} />;
      case "symbols": return <ScaffoldModal title={t("symbols")} onClose={close} />;
      case "grid":    return <ScaffoldModal title={t("grid")}    onClose={close} />;
      case "navbar":  return <ScaffoldModal title={t("navbar")}  onClose={close} />;
      case "invites": return <ScaffoldModal title={t("invites")} onClose={close} />;
    }
  };

  return (
    <div className="p-theme-general flex flex-col gap-theme-gap">
      <div className="rounded-theme bg-theme-primary px-6 py-8">
        <h1 className="text-theme-h4 font-semibold text-theme-alt-text">{t("title")}</h1>
      </div>

      <div className="grid grid-cols-2 gap-theme-gap">
        {SETTINGS_IDS.map(id => (
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
