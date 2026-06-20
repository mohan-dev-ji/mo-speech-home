"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { TabBar } from "@/app/components/app/settings/ui/TabBar";
import { InstructorProfilePanel } from "@/app/components/app/settings/sections/InstructorProfilePanel";
import { StudentProfilesPanel } from "@/app/components/app/settings/sections/StudentProfilesPanel";
import { AccountBillingPanel } from "@/app/components/app/settings/sections/AccountBillingPanel";
import { InvitesPanel } from "@/app/components/app/settings/sections/InvitesPanel";
import { PrivacyPanel } from "@/app/components/app/settings/sections/PrivacyPanel";
import { Users } from "lucide-react";

const OWNER_SETTINGS_IDS = [
  "instructor", "profile", "plan", "invites", "privacy",
] as const;

const COLLABORATOR_SETTINGS_IDS = [
  "instructor", "privacy",
] as const;

type SettingId = typeof OWNER_SETTINGS_IDS[number];

export function SettingsContent() {
  const t = useTranslations("settings");
  const { isCollaborator } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const settingsIds = isCollaborator ? COLLABORATOR_SETTINGS_IDS : OWNER_SETTINGS_IDS;
  const [activeTab, setActiveTab] = useState<SettingId>(settingsIds[0]);

  // Deep-link entry — open a specific tab via `?tab=<id>` (or the legacy
  // `?modal=<id>`, kept for the UpgradeNudge "See plans" CTA and any external
  // links). Strips the param after reading so a refresh doesn't re-pin the tab.
  useEffect(() => {
    const requested = searchParams.get("tab") ?? searchParams.get("modal");
    if (!requested) return;
    if ((settingsIds as readonly string[]).includes(requested)) {
      setActiveTab(requested as SettingId);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tab");
    next.delete("modal");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, settingsIds, pathname, router]);

  const tabs = settingsIds.map((id) => ({ id, label: t(id) }));

  const renderPanel = () => {
    switch (activeTab) {
      case "instructor": return <InstructorProfilePanel />;
      case "profile":    return <StudentProfilesPanel />;
      case "plan":       return <AccountBillingPanel />;
      case "invites":    return <InvitesPanel onOpenPlan={() => setActiveTab("plan")} />;
      case "privacy":    return <PrivacyPanel />;
    }
  };

  return (
    <div className="flex flex-col gap-theme-gap p-theme-general">
      <TabBar tabs={tabs} activeId={activeTab} onSelect={(id) => setActiveTab(id as SettingId)} />

      {isCollaborator && (
        <div className="flex items-center gap-3 rounded-theme-sm bg-theme-surface px-5 py-3">
          <Users className="h-4 w-4 shrink-0 text-theme-secondary-alt-text" />
          <p className="text-theme-s text-theme-secondary-alt-text">{t("collaboratorNotice")}</p>
        </div>
      )}

      {renderPanel()}
    </div>
  );
}
