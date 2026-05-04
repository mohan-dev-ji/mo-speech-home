"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/app/shared/ui/Dialog";
import type { Id } from "@/convex/_generated/dataModel";

const CONFIRM_PHRASE = "RELOAD";

export type ReloadDefaultsResult = {
  symbolsAdded: number;
  symbolsSkipped: number;
  filesDeleted: number;
  filesFailed: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileCategoryId: Id<"profileCategories">;
  categoryName: string;
  onSuccess: (result: ReloadDefaultsResult) => void;
};

/**
 * Destructive confirmation modal for the per-category Reload Defaults action.
 *
 * Mirrors DeleteAccountDialog's typed-confirm pattern: the user must type
 * "RELOAD" before the destructive button enables. Friction is justified
 * because custom audio (recordings) is irretrievable from R2 once deleted.
 *
 * On confirm POSTs to /api/reload-category-defaults which orchestrates the
 * Convex mutation + R2 file deletes.
 */
export function ReloadDefaultsDialog({
  open,
  onOpenChange,
  profileCategoryId,
  categoryName,
  onSuccess,
}: Props) {
  const t = useTranslations("categoryDetail");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = typed === CONFIRM_PHRASE && !busy;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reload-category-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileCategoryId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { code?: string }
          | null;
        const code = body?.code ?? "GENERIC";
        if (code === "PACK_NOT_FOUND") {
          setError(t("reloadDefaultsErrorPackGone"));
        } else if (code === "SNAPSHOT_MISSING") {
          setError(t("reloadDefaultsErrorSnapshotMissing"));
        } else {
          setError(t("reloadDefaultsErrorGeneric"));
        }
        setBusy(false);
        return;
      }
      const result = (await res.json()) as ReloadDefaultsResult;
      // Reset local state for a clean reopen.
      setTyped("");
      setBusy(false);
      onOpenChange(false);
      onSuccess(result);
    } catch {
      setError(t("reloadDefaultsErrorGeneric"));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reloadDefaultsTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-theme-elements">
          <p className="text-theme-s text-theme-text">
            {t("reloadDefaultsIntro", { name: categoryName })}
          </p>

          <ul className="space-y-1 text-theme-s text-theme-secondary-text list-disc pl-5">
            <li>{t("reloadDefaultsBulletLabels")}</li>
            <li>{t("reloadDefaultsBulletImages")}</li>
            <li>{t("reloadDefaultsBulletAudio")}</li>
            <li>{t("reloadDefaultsBulletDisplay")}</li>
            <li>{t("reloadDefaultsBulletExtras")}</li>
            <li>{t("reloadDefaultsBulletCategory")}</li>
            <li className="font-semibold text-theme-warning">
              {t("reloadDefaultsBulletIrreversible")}
            </li>
          </ul>

          <label className="block">
            <span className="text-theme-s text-theme-text font-medium">
              {t("reloadDefaultsConfirmInstruction")}
            </span>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t("reloadDefaultsConfirmPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              aria-required
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
            {t("reloadDefaultsCancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ready}
            className="px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-semibold bg-theme-warning text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? t("reloadDefaultsRunning") : t("reloadDefaultsConfirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
