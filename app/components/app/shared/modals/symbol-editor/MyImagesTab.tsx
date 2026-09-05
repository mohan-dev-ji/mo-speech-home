"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

/**
 * One row of the account's image library, as `accountImages.listMine` returns
 * it — the library row plus the joined `imageCredits` fields. Derived from the
 * query's own return type so the two can never drift.
 */
export type LibraryImage =
  FunctionReturnType<typeof api.accountImages.listMine>["page"][number];

/**
 * Page size, and it is not arbitrary: it must be a multiple of BOTH column
 * counts in the grid below (2 and 4), or every "Show more" leaves a ragged
 * part-row and the grid reads as broken rather than paginated.
 */
const PAGE_SIZE = 8;

type Props = {
  /**
   * Add the selected library image to the symbol BY REFERENCE — the caller
   * points the draft at `row.imageKey` rather than re-uploading the bytes.
   * Copying would mint a second R2 object per Add and leave the symbol
   * referencing a key the library doesn't know about, which is exactly what
   * the "used by N other items" delete gate needs to be able to count.
   */
  onImageReferenced: (row: LibraryImage) => void;
};

export function MyImagesTab({ onImageReferenced }: Props) {
  const t = useTranslations("symbolEditor");
  const { results, status, loadMore } = usePaginatedQuery(
    api.accountImages.listMine,
    {},
    { initialNumItems: PAGE_SIZE }
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = results.find((r) => r._id === selectedId) ?? null;

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isEmpty = !isLoadingFirstPage && results.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isEmpty && (
          <div className="flex items-center justify-center h-32">
            <p
              className="text-theme-s text-center max-w-xs"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              {t("myImagesEmpty")}
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {results.map((row, index) => {
              const isSelected = selectedId === row._id;
              // The prompt is the only human-readable thing a library row
              // carries, and only AI generations have one. User content, not
              // UI copy — so it is not a translation key.
              const caption = row.prompt ?? row.imageTitle ?? "";
              // Most rows (uploads) have no caption, which would otherwise
              // leave the tile button's only text as `alt=""` — no accessible
              // name. Fall back to a 1-based position label; the visible
              // caption (when there is one) is unaffected.
              const altText = caption || t("myImagesTileLabel", { index: index + 1 });
              return (
                <button
                  key={row._id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={altText}
                  onClick={() => setSelectedId(isSelected ? null : row._id)}
                  className="flex flex-col items-center gap-1 rounded-theme-sm p-2"
                  style={{
                    background: isSelected
                      ? "color-mix(in srgb, var(--theme-brand-primary) 12%, transparent)"
                      : "var(--theme-symbol-bg)",
                    border: `2px solid ${isSelected ? "var(--theme-brand-primary)" : "transparent"}`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/assets?key=${row.imageKey}`}
                    alt={altText}
                    loading="lazy"
                    className="w-full aspect-square object-contain rounded-theme-sm"
                  />
                  {caption && (
                    <span
                      className="text-theme-xs text-center leading-tight truncate w-full"
                      style={{ color: "var(--theme-secondary-text)" }}
                      title={caption}
                    >
                      {caption}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Show more — a BUTTON, not infinite scroll: scroll-triggered loading
            fights the modal's own scroll container, has no keyboard
            equivalent, and gives the user no way to stop. */}
        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <div className="flex justify-center pt-3">
            <button
              type="button"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(PAGE_SIZE)}
              className="px-4 py-2 rounded-theme-sm text-theme-s font-semibold"
              style={{
                background: "var(--theme-symbol-bg)",
                color: "var(--theme-secondary-text)",
                border: "1px solid var(--theme-button-highlight)",
                opacity: status === "LoadingMore" ? 0.5 : 1,
              }}
            >
              {t("myImagesLoadMore")}
            </button>
          </div>
        )}
      </div>

      {/* Action bar — one bar BELOW the grid, never on the tiles. A tappable
          Delete on every thumbnail is a mis-tap waiting to happen on the
          tablets families use, and hover doesn't exist there to hide it. */}
      <div
        className="shrink-0 flex gap-2 px-3 py-3"
        style={{ borderTop: "1px solid var(--theme-button-highlight)" }}
      >
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onImageReferenced(selected)}
          className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
          style={{
            background: "var(--theme-brand-primary)",
            color: "var(--theme-alt-text)",
            opacity: selected ? 1 : 0.5,
          }}
        >
          {t("myImagesAdd")}
        </button>
        {/* Disabled until phase-36 Task 4 wires the delete gate — it is the one
            hard delete in the image model, so it does not ship half-built. */}
        <button
          type="button"
          disabled
          className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
          style={{
            background: "var(--theme-symbol-bg)",
            color: "var(--theme-secondary-text)",
            border: "1px solid var(--theme-button-highlight)",
            opacity: 0.5,
          }}
        >
          {t("myImagesDelete")}
        </button>
      </div>
    </div>
  );
}
