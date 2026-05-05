"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/app/shared/ui/Dialog";
import { type PlanTier } from "@/app/components/app/shared/ui/PlanTierPicker";

const TIERS: PlanTier[] = ["free", "pro", "max"];

export type PackPickerTarget =
  | { mode: "create"; name: { eng: string }; tier: PlanTier }
  | { mode: "append"; packId: Id<"resourcePacks"> };

type ItemKind = "category" | "list" | "sentence";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  itemKind: ItemKind;
  /** Pre-fill for the "New pack" name field. Admin can edit before saving. */
  defaultName: string;
  onConfirm: (target: PackPickerTarget) => Promise<void>;
};

type Tab = "create" | "append";

/**
 * Shared modal for the admin Library save flow. Two tabs:
 *  - "New pack" → mints a new pack with custom name + tier
 *  - "Add to existing" → appends the source item to a pack the admin owns
 *
 * Used by the Library toggle button in CategoryDetailContent banner,
 * ListsModeContent + ListDetailContent toolbars, and SentencesModeContent
 * row toolbar. The dialogue is shown only when toggling Library ON; toggling
 * OFF still removes the item directly without prompting.
 */
export function LibraryPackPickerModal({
  isOpen,
  onClose,
  itemKind,
  defaultName,
  onConfirm,
}: Props) {
  const t = useTranslations("packPicker");

  const myPacks = useQuery(
    api.resourcePacks.getMyLibraryPacksForPicker,
    isOpen ? {} : "skip"
  );

  const hasExistingPacks = !!myPacks && myPacks.length > 0;

  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState(defaultName);
  const [tier, setTier] = useState<PlanTier>("free");
  const [selectedPackId, setSelectedPackId] = useState<
    Id<"resourcePacks"> | ""
  >("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset internal state each time the modal opens. Default tab depends on
  // whether the admin has any existing packs — first save lands on "create".
  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    setTier("free");
    setSelectedPackId("");
    setTab(hasExistingPacks ? "append" : "create");
  }, [isOpen, defaultName, hasExistingPacks]);

  const itemKindLabel = useMemo(() => {
    if (itemKind === "category") return t("itemCategory");
    if (itemKind === "list") return t("itemList");
    return t("itemSentence");
  }, [itemKind, t]);

  const trimmedName = name.trim();
  const canSubmit =
    !isSaving &&
    (tab === "create"
      ? trimmedName.length > 0
      : selectedPackId !== "");

  function handleOpenChange(open: boolean) {
    if (!open && !isSaving) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      if (tab === "create") {
        await onConfirm({
          mode: "create",
          name: { eng: trimmedName },
          tier,
        });
      } else {
        await onConfirm({
          mode: "append",
          packId: selectedPackId as Id<"resourcePacks">,
        });
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { kind: itemKindLabel })}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Tabs */}
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-theme-sm"
            style={{ background: "rgba(0,0,0,0.18)" }}
            role="tablist"
          >
            {(["create", "append"] as const).map((opt) => {
              const active = tab === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(opt)}
                  disabled={opt === "append" && !hasExistingPacks}
                  className="px-3 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity disabled:opacity-40"
                  style={
                    active
                      ? {
                          background: "var(--theme-button-highlight)",
                          color: "var(--theme-text)",
                        }
                      : {
                          background: "transparent",
                          color: "var(--theme-text-secondary)",
                        }
                  }
                >
                  {opt === "create" ? t("tabCreate") : t("tabAppend")}
                </button>
              );
            })}
          </div>

          {tab === "create" ? (
            <>
              {/* New pack name */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-theme-s font-medium"
                  style={{ color: "var(--theme-text)" }}
                >
                  {t("nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                  style={{
                    background: "var(--theme-symbol-bg)",
                    color: "var(--theme-text)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
              </div>

              {/* Tier — full-width three-pill segmented control */}
              <div
                className="grid grid-cols-3 gap-1 p-1 rounded-theme-sm"
                style={{ background: "rgba(0,0,0,0.18)" }}
                role="radiogroup"
                aria-label={t("tierLabel")}
              >
                {TIERS.map((opt) => {
                  const active = tier === opt;
                  const labelKey =
                    opt === "free"
                      ? "planTierFree"
                      : opt === "pro"
                        ? "planTierPro"
                        : "planTierMax";
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTier(opt)}
                      className="px-3 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity"
                      style={
                        active
                          ? {
                              background: "var(--theme-button-highlight)",
                              color: "var(--theme-text)",
                            }
                          : {
                              background: "transparent",
                              color: "var(--theme-text-secondary)",
                            }
                      }
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label
                className="text-theme-s font-medium"
                style={{ color: "var(--theme-text)" }}
              >
                {t("packSelectLabel")}
              </label>
              {hasExistingPacks ? (
                <select
                  value={selectedPackId}
                  onChange={(e) =>
                    setSelectedPackId(
                      e.target.value as Id<"resourcePacks"> | ""
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none"
                  style={{
                    background: "var(--theme-symbol-bg)",
                    color: "var(--theme-text)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <option value="" disabled>
                    {t("packSelectPlaceholder")}
                  </option>
                  {myPacks!.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name.eng} · {t(`planTier${capitalise(p.tier)}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <p
                  className="text-theme-s"
                  style={{ color: "var(--theme-text-secondary)" }}
                >
                  {t("noExistingPacks")}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="py-3 rounded-theme-sm text-theme-s font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--theme-symbol-bg)",
                color: "var(--theme-text)",
              }}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="py-3 rounded-theme-sm text-theme-s font-semibold transition-opacity disabled:opacity-40"
              style={{ background: "#16a34a", color: "#fff" }}
            >
              {isSaving ? t("saving") : t("save")}
            </button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
