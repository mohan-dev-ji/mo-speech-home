"use client";

// Admin curation modal (ADR-014 Task B/C) — publish a category, list group or
// sentence group as a content module into the `libraryModules` table. Pure
// mutation, no deploy. The "Default" classification marks a core module that is
// auto-installed for new accounts and free to access.

import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/app/components/app/shared/ui/Toast";
import { track } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/app/components/app/shared/ui/Dialog";

type Kind = "category" | "lists" | "sentences" | "phrases";
type Classification = "default" | "free" | "pro" | "max";
const CLASSES: Classification[] = ["default", "free", "pro", "max"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PublishModuleModal({
  kind,
  targetId,
  defaultName,
  publishedSlug,
  publishedClass,
  onClose,
}: {
  kind: Kind;
  /** profileCategories id (kind="category") or profileFolders id (kind=lists/sentences). */
  targetId: string;
  defaultName: string;
  /** Set when the source was already published — opens the modal in Update mode. */
  publishedSlug?: string;
  publishedClass?: Classification;
  onClose: () => void;
}) {
  const t = useTranslations("publishModule");
  const { showToast } = useToast();
  const publishFolder = useMutation(api.contentModules.publish.publishFolderAsModule);
  const publishCategory = useMutation(api.contentModules.publish.publishCategoryAsModule);

  // Update mode: the source already maps to a module — lock its slug and
  // preselect its current classification so re-publishing can't duplicate or
  // silently downgrade it.
  const isUpdate = !!publishedSlug;

  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(publishedSlug ?? slugify(defaultName));
  const [slugTouched, setSlugTouched] = useState(false);
  const [classification, setClassification] = useState<Classification>(
    publishedClass ?? "default"
  );
  const [saving, setSaving] = useState(false);

  const effectiveSlug = isUpdate
    ? (publishedSlug as string)
    : slugTouched
      ? slug
      : slugify(name);
  const slugValid = SLUG_RE.test(effectiveSlug);
  const tree = kind === "category" ? "categories" : kind;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slugValid || saving) return;
    setSaving(true);
    try {
      const trimmed = name.trim();
      const isDefault = classification === "default";
      const tier = isDefault ? "free" : classification;
      const nameArg =
        trimmed && trimmed !== defaultName ? { name: trimmed } : {};
      if (kind === "category") {
        await publishCategory({
          profileCategoryId: targetId as Id<"profileCategories">,
          slug: effectiveSlug,
          tier,
          isDefault,
          ...nameArg,
        });
      } else {
        await publishFolder({
          folderId: targetId as Id<"profileFolders">,
          slug: effectiveSlug,
          tier,
          isDefault,
          ...nameArg,
        });
      }
      track("module_published", { slug: effectiveSlug, tree, tier: classification });
      showToast({
        tone: "info",
        title: t(isUpdate ? "updatedToast" : "publishedToast", { slug: effectiveSlug }),
      });
      onClose();
    } catch (err) {
      let msg = t("errorToast");
      if (
        err instanceof ConvexError &&
        typeof err.data === "object" &&
        err.data !== null &&
        "code" in err.data &&
        (err.data as { code: string }).code === "EMPTY_FOLDER"
      ) {
        msg = t("emptyFolderError");
      }
      showToast({ tone: "warning", title: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isUpdate ? t("titleUpdate") : t("title")}</DialogTitle>
          <DialogDescription>
            {isUpdate ? t("descriptionUpdate") : t("description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-theme-s font-medium text-theme-text">{t("nameLabel")}</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-theme-sm px-3 py-2 text-theme-s outline-none"
              style={{ background: "var(--theme-symbol-bg)", color: "var(--theme-text)" }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-theme-s font-medium text-theme-text">{t("slugLabel")}</span>
            <input
              value={effectiveSlug}
              readOnly={isUpdate}
              disabled={isUpdate}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
              className="rounded-theme-sm px-3 py-2 text-theme-s font-mono outline-none disabled:opacity-60"
              style={{ background: "var(--theme-symbol-bg)", color: "var(--theme-text)" }}
            />
            <span className="text-theme-xs text-theme-secondary-alt-text">
              {isUpdate ? t("slugLocked") : slugValid ? t("slugHelp") : t("slugInvalid")}
            </span>
          </label>

          <fieldset className="flex flex-col gap-1">
            <span className="text-theme-s font-medium text-theme-text">{t("tierLabel")}</span>
            <div className="grid grid-cols-4 gap-2">
              {CLASSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setClassification(c)}
                  className="px-2 py-2 rounded-theme-sm text-theme-s font-medium transition-opacity"
                  style={
                    classification === c
                      ? { background: "var(--theme-primary)", color: "#fff" }
                      : { background: "var(--theme-symbol-bg)", color: "var(--theme-text)" }
                  }
                >
                  {t(`class_${c}`)}
                </button>
              ))}
            </div>
            {classification === "default" && (
              <span className="text-theme-xs text-theme-secondary-alt-text">
                {t("defaultHelp")}
              </span>
            )}
          </fieldset>

          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-theme-sm text-theme-s font-medium"
                style={{ background: "var(--theme-symbol-bg)", color: "var(--theme-text)" }}
              >
                {t("cancel")}
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={!slugValid || saving}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-medium text-white transition-opacity disabled:opacity-50"
              style={{ background: "var(--theme-primary)" }}
            >
              {saving
                ? isUpdate
                  ? t("updating")
                  : t("publishing")
                : isUpdate
                  ? t("update")
                  : t("publish")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
