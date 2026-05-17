"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/app/shared/ui/Dialog";

const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("settings.deleteAccount");
  const { user } = useUser();
  const { signOut } = useClerk();

  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const ready = typed === CONFIRM_PHRASE && !busy;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      if (!res.ok) {
        if (res.status === 403) {
          setError(t("errorCollaborator"));
        } else {
          setError(t("errorGeneric"));
        }
        setBusy(false);
        return;
      }

      // The delete-account route has already removed the Clerk user
      // server-side, so the session's user no longer exists. Calling
      // `signOut` against a dead session can hang. Try the graceful path
      // first; fall back to a hard navigation so the tab can't end up
      // stuck holding a JWT for a deleted user.
      try {
        await signOut({ redirectUrl: "/" });
      } catch {
        // Fallthrough to hard redirect.
      }
      window.location.replace("/");
    } catch {
      setError(t("errorGeneric"));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-theme-elements">
          <div className="rounded-theme-sm bg-theme-alt-card p-3 text-theme-s">
            <p className="text-theme-secondary-text">{t("emailLabel")}</p>
            <p className="text-theme-text font-medium break-all">{email}</p>
          </div>

          <label className="block">
            <span className="text-theme-s text-theme-text font-medium">
              {t("confirmInstruction")}
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t("confirmPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-theme-sm border border-theme-line bg-theme-background px-3 py-2 text-theme-s text-theme-alt-text placeholder:text-theme-secondary-text outline-none focus:border-theme-warning"
            />
          </label>

          {error && (
            <p className="text-theme-s text-theme-warning" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium bg-theme-primary text-theme-alt-text hover:opacity-90 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready}
            className="px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-semibold bg-theme-warning text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? t("deleting") : t("confirmButton")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
