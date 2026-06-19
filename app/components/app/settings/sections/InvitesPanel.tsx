"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Input } from "@/app/components/app/shared/ui/Input";
import { SettingsSection } from "@/app/components/app/settings/ui/SettingsSection";
import { UserPlus, Crown } from "lucide-react";

function UpgradePrompt({ onUpgrade }: { onUpgrade: () => void }) {
  const t = useTranslations("invites");
  return (
    <div className="flex flex-col items-center gap-theme-gap py-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-theme-primary-25">
        <Crown className="size-6 text-theme-primary" />
      </div>
      <div>
        <p className="text-theme-p font-semibold text-theme-alt-text">{t("upgradeTitle")}</p>
        <p className="mt-1 max-w-xs text-theme-s text-theme-secondary-alt-text">{t("upgradeMessage")}</p>
      </div>
      <Button onClick={onUpgrade}>{t("upgradeCta")}</Button>
    </div>
  );
}

function MemberRow({
  email,
  status,
  date,
  onRemove,
  removing,
}: {
  email: string;
  status: "pending" | "active";
  date: number;
  onRemove: () => void;
  removing: boolean;
}) {
  const t = useTranslations("invites");
  return (
    <tr className="border-b border-theme-line last:border-0">
      <td className="py-2.5 pr-3 text-theme-s text-theme-alt-text">{email}</td>
      <td className="py-2.5 pr-3">
        <span
          className={`rounded-theme-chip px-2 py-0.5 text-theme-xs font-medium ${
            status === "active" ? "text-theme-success" : "text-theme-warning"
          }`}
        >
          {status === "active" ? t("statusActive") : t("statusPending")}
        </span>
      </td>
      <td className="whitespace-nowrap py-2.5 pr-3 text-theme-s text-theme-secondary-alt-text">
        {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </td>
      <td className="py-2.5 text-right">
        <button
          onClick={onRemove}
          disabled={removing}
          className="text-theme-s text-theme-secondary-alt-text transition-colors hover:text-theme-warning disabled:opacity-40"
          aria-label="Remove"
        >
          {removing ? "…" : "×"}
        </button>
      </td>
    </tr>
  );
}

/**
 * Invites tab — ports `InvitesModal`. Max-tier gated: non-Max accounts see an
 * upgrade prompt (which jumps to the Account & Billing tab via `onOpenPlan`);
 * Max accounts get the invite form + member table. Invite flow is unchanged
 * (`inviteCollaborator` → `/api/invite`).
 */
export function InvitesPanel({ onOpenPlan }: { onOpenPlan: () => void }) {
  const t = useTranslations("invites");
  const { subscription } = useAppState();

  const members = useQuery(api.accountMembers.getMyAccountMembers);
  const inviteCollaborator = useMutation(api.accountMembers.inviteCollaborator);
  const removeMember = useMutation(api.accountMembers.removeMember);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isMax = subscription.tier === "max";

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("errorInvalidEmail"));
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      await inviteCollaborator({ email: trimmed });
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        console.warn("Invite email failed to send:", await res.text());
      }
      setEmail("");
      setSuccess(t("successInvited"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg === "Already invited" ? t("errorAlreadyInvited") : t("errorGeneric"));
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeMember({ memberId: memberId as Id<"accountMembers"> });
    } finally {
      setRemovingId(null);
    }
  };

  if (!isMax) {
    return (
      <SettingsSection title={t("title")}>
        <UpgradePrompt onUpgrade={onOpenPlan} />
      </SettingsSection>
    );
  }

  return (
    <div className="flex flex-col gap-theme-gap">
      <SettingsSection title={t("title")}>
        <p className="text-theme-s text-theme-secondary-alt-text">{t("newMemberLabel")}</p>
        <div className="flex gap-theme-elements">
          <Input
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); setSuccess(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
            placeholder={t("emailPlaceholder")}
            type="email"
            className="flex-1"
          />
          <Button
            onClick={handleInvite}
            loading={sending}
            disabled={!email.trim()}
            size="sm"
            icon={<UserPlus className="size-4" />}
            className="shrink-0"
          >
            {t("sendButton")}
          </Button>
        </div>
        {error && <p className="text-theme-s text-theme-warning">{error}</p>}
        {success && <p className="text-theme-s text-theme-success">{success}</p>}
      </SettingsSection>

      <SettingsSection title={t("invitedMembers")}>
        {!members || members.length === 0 ? (
          <p className="py-4 text-center text-theme-s text-theme-secondary-alt-text">{t("emptyState")}</p>
        ) : (
          <div className="max-h-56 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-theme-line">
                  <th className="pb-2 text-theme-xs font-medium text-theme-secondary-alt-text">{t("tableEmail")}</th>
                  <th className="pb-2 text-theme-xs font-medium text-theme-secondary-alt-text">{t("tableStatus")}</th>
                  <th className="pb-2 text-theme-xs font-medium text-theme-secondary-alt-text">{t("tableDate")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m._id}
                    email={m.email}
                    status={m.status}
                    date={m.invitedAt}
                    onRemove={() => handleRemove(m._id)}
                    removing={removingId === m._id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
