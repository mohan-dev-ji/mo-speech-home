"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/app/shared/ui/Dialog";
import { type PlanTier } from "@/app/components/app/shared/ui/PlanTierPicker";
import { useToast } from "@/app/components/app/shared/ui/Toast";

const TIERS: PlanTier[] = ["free", "pro", "max"];

/**
 * Target passed to the consumer's `onConfirm` after the modal Save click.
 * Per ADR-010 Phase 6, packs are identified by slug (URL-safe string) and
 * lifecycle metadata lives on `packLifecycle`. JSON file content is written
 * by the `/api/admin/pack-publish` route after the consumer's mutation
 * resolves.
 */
export type PackPickerTarget =
  | {
      mode: "create";
      slug: string;
      name: { eng: string };
      tier: PlanTier;
    }
  | {
      mode: "append";
      slug: string;
    };

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
 * Underscore-only slug derived from a name. Mirrors `slugify` in
 * `convex/migrations.ts` (kept in sync because both produce filenames
 * for `convex/data/library_packs/<slug>.json`).
 */
function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/;

/**
 * Shared modal for the admin Library save flow. Two tabs:
 *  - "New pack" → admin enters name + slug + tier; creates a `packLifecycle`
 *    row and writes the pack to JSON.
 *  - "Add to existing" → admin picks an existing pack they own; appends the
 *    source row to it and republishes the JSON.
 *
 * Used by the Library toggle button in CategoryDetailContent banner,
 * ListsModeContent + ListDetailContent toolbars, and SentencesModeContent
 * row toolbar. The dialogue is shown only when toggling Library ON; toggling
 * OFF still removes the item directly without prompting.
 *
 * On Save: calls the consumer's `onConfirm` (which runs the appropriate V2
 * Convex mutation), then POSTs to `/api/admin/pack-publish` with the
 * resolved slug to write the JSON to disk. Both steps complete before the
 * modal closes; a failure on either shows a toast and leaves the modal open
 * so the admin can retry.
 */
export function LibraryPackPickerModal({
  isOpen,
  onClose,
  itemKind,
  defaultName,
  onConfirm,
}: Props) {
  const t = useTranslations("packPicker");
  const { showToast } = useToast();

  const myPacks = useQuery(
    api.resourcePacks.getMyLifecyclePacksForPicker,
    isOpen ? {} : "skip"
  );

  const hasExistingPacks = !!myPacks && myPacks.length > 0;

  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(slugFromName(defaultName));
  // Tracks whether the admin has manually edited the slug input. Once true,
  // changes to the name don't auto-overwrite the slug.
  const slugDirtyRef = useRef(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [tier, setTier] = useState<PlanTier>("free");
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset internal state each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    setSlug(slugFromName(defaultName));
    slugDirtyRef.current = false;
    setSlugError(null);
    setTier("free");
    setSelectedSlug("");
    setTab(hasExistingPacks ? "append" : "create");
  }, [isOpen, defaultName, hasExistingPacks]);

  // Auto-derive slug from name unless the admin has manually edited it.
  useEffect(() => {
    if (slugDirtyRef.current) return;
    setSlug(slugFromName(name));
  }, [name]);

  const itemKindLabel = useMemo(() => {
    if (itemKind === "category") return t("itemCategory");
    if (itemKind === "list") return t("itemList");
    return t("itemSentence");
  }, [itemKind, t]);

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();
  const slugValid = SLUG_PATTERN.test(trimmedSlug) && trimmedSlug !== "_starter";
  const canSubmit =
    !isSaving &&
    (tab === "create"
      ? trimmedName.length > 0 && slugValid
      : selectedSlug !== "");

  function handleOpenChange(open: boolean) {
    if (!open && !isSaving) onClose();
  }

  function handleSlugChange(next: string) {
    slugDirtyRef.current = true;
    setSlug(next);
    if (!next) {
      setSlugError(t("slugRequired"));
    } else if (!SLUG_PATTERN.test(next)) {
      setSlugError(t("slugInvalid"));
    } else if (next === "_starter") {
      setSlugError(t("slugReserved"));
    } else {
      setSlugError(null);
    }
  }

  async function publishToJson(targetSlug: string) {
    const res = await fetch("/api/admin/pack-publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: targetSlug }),
    });
    if (!res.ok) {
      let message = "Pack saved to library, but JSON publish failed.";
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* ignore parse error */
      }
      throw new Error(message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      const target: PackPickerTarget =
        tab === "create"
          ? {
              mode: "create",
              slug: trimmedSlug,
              name: { eng: trimmedName },
              tier,
            }
          : { mode: "append", slug: selectedSlug };

      // Step 1: run the consumer's Convex mutation (create / link).
      await onConfirm(target);

      // Step 2: write the JSON file on disk via the dev-only API route.
      try {
        await publishToJson(target.slug);
      } catch (publishErr: unknown) {
        const message =
          publishErr instanceof Error
            ? publishErr.message
            : t("publishGenericError");
        showToast({ tone: "warning", title: message });
        // Leave the modal open so the admin can review / retry. The
        // Convex side already committed; the JSON write is the only thing
        // that didn't.
        return;
      }

      showToast({ tone: "info", title: t("savedAndPublishedToast") });
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

              {/* Slug — Convex-path-safe identifier; auto-derived from name */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-theme-s font-medium"
                  style={{ color: "var(--theme-text)" }}
                >
                  {t("slugLabel")}
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder={t("slugPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-theme-sm text-theme-s outline-none font-mono"
                  style={{
                    background: "var(--theme-symbol-bg)",
                    color: "var(--theme-text)",
                    border: `1px solid ${
                      slugError ? "var(--theme-warning)" : "rgba(255,255,255,0.12)"
                    }`,
                  }}
                />
                <p
                  className="text-theme-xs"
                  style={{
                    color: slugError
                      ? "var(--theme-warning)"
                      : "var(--theme-text-secondary)",
                  }}
                >
                  {slugError ?? t("slugHelp")}
                </p>
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
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
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
                    <option key={p.slug} value={p.slug}>
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
