"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { Dialog, DialogContent } from "@/app/components/app/shared/ui/Dialog";
import { InstructorProfileModal } from "@/app/components/app/settings/modals/InstructorProfileModal";
import { ProfileModal }  from "@/app/components/app/settings/modals/ProfileModal";
import { PlanModal }     from "@/app/components/app/settings/modals/PlanModal";
import { InvitesModal }  from "@/app/components/app/settings/modals/InvitesModal";
import { PrivacyModal }  from "@/app/components/app/settings/modals/PrivacyModal";
import { ScaffoldModal } from "@/app/components/app/settings/modals/ScaffoldModal";
import { Users } from "lucide-react";

const OWNER_SETTINGS_IDS = [
  "instructor", "profile", "plan", "navbar", "invites", "privacy",
] as const;

const COLLABORATOR_SETTINGS_IDS = [
  "instructor", "navbar", "privacy",
] as const;

type SettingId = typeof OWNER_SETTINGS_IDS[number];

const MODAL_SIZE: Partial<Record<SettingId, string>> = {
  instructor: "max-w-lg",
  profile:    "max-w-lg",
  plan:       "max-w-3xl",
  invites:    "max-w-2xl",
  privacy:    "max-w-lg",
};

export function SettingsContent() {
  const t = useTranslations("settings");
  const { isCollaborator } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeModal, setActiveModal] = useState<SettingId | null>(null);

  const open  = (id: SettingId) => setActiveModal(id);
  const close = () => setActiveModal(null);

  const settingsIds = isCollaborator ? COLLABORATOR_SETTINGS_IDS : OWNER_SETTINGS_IDS;

  // Deep-link entry — open a specific modal via `?modal=<id>`. Used by the
  // UpgradeNudge "See plans" CTA (and any future external link) to land
  // straight on Account & Billing rather than requiring a second tap on
  // the Plan tile. Strips the param after opening so a page refresh
  // doesn't re-open the modal indefinitely.
  useEffect(() => {
    const requested = searchParams.get("modal");
    if (!requested) return;
    if ((settingsIds as readonly string[]).includes(requested)) {
      setActiveModal(requested as SettingId);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("modal");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, settingsIds, pathname, router]);

  const renderModal = () => {
    switch (activeModal) {
      case "instructor": return <InstructorProfileModal onClose={close} />;
      case "profile":    return <ProfileModal onClose={close} />;
      case "plan":       return <PlanModal    onClose={close} />;
      case "navbar":     return <ScaffoldModal title={t("navbar")} onClose={close} />;
      case "invites":    return <InvitesModal onClose={close} onOpenPlan={() => { close(); open("plan"); }} />;
      case "privacy":    return <PrivacyModal onClose={close} />;
    }
  };

  return (
    <div className="p-theme-general flex flex-col gap-theme-gap">
      <div className="rounded-theme bg-theme-primary px-6 py-8">
        <h1 className="text-theme-h4 font-semibold text-theme-alt-text">{t("title")}</h1>
      </div>

      {/*
        Language picker removed from Settings — it now lives inside both
        Instructor Profile and Student Profile modals where it's more compact
        and contextual. One place per concept: instructor locale in
        InstructorProfileModal, student-profile language in ProfileModal.
      */}

      {isCollaborator && (
        <div className="flex items-center gap-3 rounded-theme bg-theme-surface px-5 py-3">
          <Users className="w-4 h-4 text-theme-secondary-text shrink-0" />
          <p className="text-theme-s text-theme-secondary-text">{t("collaboratorNotice")}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-theme-gap">
        {settingsIds.map(id => (
          <button
            key={id}
            onClick={() => open(id)}
            className="rounded-theme bg-theme-surface text-left px-6 py-8 hover:bg-theme-banner transition-colors"
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

    </div>
  );
}
