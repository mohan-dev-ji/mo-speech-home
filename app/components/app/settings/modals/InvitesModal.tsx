"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/contexts/AppStateProvider";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Input } from "@/app/components/app/shared/ui/Input";
import { UserPlus, Crown } from "lucide-react";

// ─── Upgrade prompt (non-Max users) ──────────────────────────────────────────

function UpgradePrompt({ onUpgrade }: { onUpgrade: () => void }) {
  const t = useTranslations("invites");
  return (
    <div className="flex flex-col items-center text-center py-6 gap-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Crown className="w-6 h-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-theme-p text-theme-text">{t("upgradeTitle")}</p>
        <p className="text-theme-s text-theme-secondary-text mt-1 max-w-xs">{t("upgradeMessage")}</p>
      </div>
      <Button onClick={onUpgrade}>{t("upgradeCta")}</Button>
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  email,
  name,
  status,
  date,
  onRemove,
  removing,
}: {
  email: string;
  name?: string;
  status: "pending" | "active";
  date: number;
  onRemove: () => void;
  removing: boolean;
}) {
  const t = useTranslations("invites");
  return (
    <tr className="border-b border-theme-line last:border-0">
      <td className="py-2.5 pr-3 text-theme-s text-theme-text">{email}</td>
      <td className="py-2.5 pr-3 text-theme-s text-theme-secondary-text">{name ?? "—"}</td>
      <td className="py-2.5 pr-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          status === "active"
            ? "bg-success/10 text-success"
            : "bg-warning/10 text-warning"
        }`}>
          {status === "active" ? t("statusActive") : t("statusPending")}
        </span>
      </td>
      <td className="py-2.5 pr-3 text-theme-s text-theme-secondary-text whitespace-nowrap">
        {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </td>
      <td className="py-2.5 text-right">
        <button
          onClick={onRemove}
          disabled={removing}
          className="text-xs text-theme-secondary-text hover:text-destructive transition-colors disabled:opacity-40"
          aria-label="Remove"
        >
          {removing ? "…" : "×"}
        </button>
      </td>
    </tr>
  );
}

// ─── InvitesModal ─────────────────────────────────────────────────────────────

export function InvitesModal({
  onClose,
  onOpenPlan,
}: {
  onClose: () => void;
  onOpenPlan: () => void;
}) {
  const t = useTranslations("invites");
  const { subscription } = useAppState();

  const members = useQuery(api.accountMembers.getMyAccountMembers);
  const inviteCollaborator = useMutation(api.accountMembers.inviteCollaborator);
  const removeMember = useMutation(api.accountMembers.removeMember);

  const [email, setEmail]     = useState("");
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError]     = useState("");
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
      // 1. Create the pending accountMember record in Convex
      await inviteCollaborator({ email: trimmed });

      // 2. Send the Clerk invitation email
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        // Record was created — email failed. Not fatal: user appears in list.
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
      await removeMember({ memberId: memberId as any });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      {!isMax ? (
        <UpgradePrompt onUpgrade={() => { onClose(); onOpenPlan(); }} />
      ) : (
        <div className="space-y-5">
          {/* Invite input row */}
          <div>
            <p className="text-theme-s text-theme-secondary-text mb-2">{t("newMemberLabel")}</p>
            <div className="flex gap-2">
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
                className="shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t("sendButton")}
              </Button>
            </div>
            {error   && <p className="text-small text-destructive mt-1.5">{error}</p>}
            {success && <p className="text-small text-success mt-1.5">{success}</p>}
          </div>

          {/* Invited members table */}
          <div>
            <p className="text-theme-s font-medium text-theme-text mb-2">{t("invitedMembers")}</p>
            {!members || members.length === 0 ? (
              <p className="text-theme-s text-theme-secondary-text py-4 text-center">{t("emptyState")}</p>
            ) : (
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-theme-line">
                      <th className="pb-2 text-xs font-medium text-theme-secondary-text">{t("tableEmail")}</th>
                      <th className="pb-2 text-xs font-medium text-theme-secondary-text">{t("tableName")}</th>
                      <th className="pb-2 text-xs font-medium text-theme-secondary-text">{t("tableStatus")}</th>
                      <th className="pb-2 text-xs font-medium text-theme-secondary-text">{t("tableDate")}</th>
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
          </div>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
