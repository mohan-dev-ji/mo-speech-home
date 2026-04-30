"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/components/AppStateProvider";
import { Dialog, DialogContent } from "@/app/components/shared/ui/Dialog";
import { InstructorProfileModal } from "@/app/components/app/settings/modals/InstructorProfileModal";
import { ProfileModal }  from "@/app/components/app/settings/modals/ProfileModal";
import { PlanModal }     from "@/app/components/app/settings/modals/PlanModal";
import { InvitesModal }  from "@/app/components/app/settings/modals/InvitesModal";
import { ScaffoldModal } from "@/app/components/app/settings/modals/ScaffoldModal";
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
  const { isCollaborator } = useAppState();
  const [activeModal, setActiveModal] = useState<SettingId | null>(null);

  const migrate = useMutation(api.migrations.migrateContentToAccount);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);

  async function handleMigrate() {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const result = await migrate({});
      setMigrateResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setMigrateResult(e instanceof Error ? e.message : String(e));
    } finally {
      setMigrating(false);
    }
  }

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

      {/* DEV — one-shot content migration (remove before production) */}
      {!isCollaborator && (
        <div className="rounded-theme-sm border-2 border-dashed border-theme-enter-mode p-4 mt-2">
          <p className="text-theme-enter-mode text-theme-s font-semibold tracking-widest uppercase mb-2">
            Dev — content migration
          </p>
          <p className="text-theme-secondary-text text-theme-s mb-3">
            Backfills <code>accountId</code> on all categories, symbols, lists, sentences. Recovers orphans (rows whose profile was deleted) by attributing them to your account. Idempotent — safe to re-run.
          </p>
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium bg-theme-primary text-theme-alt-text hover:opacity-90 disabled:opacity-50"
          >
            {migrating ? "Migrating…" : "Backfill accountId & recover orphans"}
          </button>
          {migrateResult && (
            <pre
              className="mt-3 p-2 rounded-theme-sm bg-theme-alt-card text-theme-s overflow-auto whitespace-pre-wrap"
              style={{ maxHeight: 240 }}
            >
              {migrateResult}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
