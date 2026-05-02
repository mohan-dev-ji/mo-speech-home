"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

type Props = {
  profileId: Id<"studentProfiles">;
  profileCategoryId: Id<"profileCategories">;
  language: string;
  onClose: () => void;
};

export function ModellingPickerModal({
  profileId,
  profileCategoryId,
  language,
  onClose,
}: Props) {
  const t = useTranslations("modelling.picker");
  const symbols = useQuery(api.profileCategories.getProfileSymbolsWithImages, {
    profileCategoryId,
  });
  const createSession = useMutation(api.modellingSessions.createModellingSession);

  const [selectedId, setSelectedId] = useState<Id<"profileSymbols"> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSession({ profileId, profileSymbolId: selectedId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
        {symbols === undefined && (
          <div className="flex items-center justify-center py-8">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{
                borderColor: "var(--theme-primary)",
                borderTopColor: "transparent",
              }}
            />
          </div>
        )}

        {symbols && symbols.length === 0 && (
          <p className="text-theme-s text-theme-secondary-text text-center py-8">
            {t("empty")}
          </p>
        )}

        {symbols && symbols.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-theme-elements">
            {symbols.map((sym) => {
              const label =
                language === "hin" && sym.label.hin ? sym.label.hin : sym.label.eng;
              const imageUrl = sym.imagePath
                ? `/api/assets?key=${sym.imagePath}`
                : undefined;
              const symbolId = sym._id as Id<"profileSymbols">;
              const active = selectedId === symbolId;

              return (
                <button
                  key={sym._id}
                  type="button"
                  onClick={() => setSelectedId(symbolId)}
                  className={`flex flex-col items-center gap-1 p-theme-symbol rounded-theme-sm transition-all bg-theme-symbol-bg ${
                    active ? "" : "hover:opacity-90"
                  }`}
                  style={
                    active
                      ? {
                          outline: "3px solid var(--theme-brand-primary)",
                          outlineOffset: 2,
                        }
                      : undefined
                  }
                >
                  {imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-full aspect-square object-contain"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full aspect-square" />
                  )}
                  <span className="text-theme-xs font-semibold text-theme-text text-center break-words leading-tight">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p className="text-theme-s text-theme-warning mt-3 text-center">{error}</p>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
        </DialogClose>
        <Button
          onClick={handleConfirm}
          disabled={!selectedId || submitting}
          loading={submitting}
        >
          {t("confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
