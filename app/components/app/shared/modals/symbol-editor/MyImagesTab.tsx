"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { usePaginatedQuery, useQuery } from "convex/react";
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
  /**
   * R2 key of a row that should arrive already SELECTED — set by the modal
   * when an AI generation lands here (phase-36 Task 3). The highlight IS the
   * selection: the tile gets the same `aria-pressed` ring a tap gives it, so
   * the action bar is live for the new image the moment the tab switches, and
   * "Add to symbol" is one click rather than a hunt.
   *
   * It does not fade on a timer — an instructor who looked away for the eight
   * seconds the generation took must still be able to see which one is new.
   * It ends when the user interacts (taps another tile, Adds, or pages).
   */
  highlightKey?: string | null;
  /**
   * `draft.resolvedImagePath` from the modal — the R2 key currently on the
   * symbol being edited, saved or not. `usageCount` below only ever sees
   * SAVED rows (it walks committed symbol/list/sentence references), so a
   * brand-new "Add to symbol" that hasn't been saved yet is invisible to it:
   * the row would read `usageCount === 0` and Delete would light up even
   * though deleting it would strand the unsaved draft's own reference. This
   * prop lets Delete see what the query can't.
   */
  draftImageKey?: string;
};

export function MyImagesTab({ onImageReferenced, highlightKey, draftImageKey }: Props) {
  const t = useTranslations("symbolEditor");
  const { results, status, loadMore } = usePaginatedQuery(
    api.accountImages.listMine,
    {},
    { initialNumItems: PAGE_SIZE }
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The `highlightKey` the user has already taken over from. Derived selection
  // rather than an effect that writes `selectedId`: the new row arrives through
  // the reactive paginated query, which can land a beat after the tab switch,
  // and syncing that into state would mean a setState-in-effect firing on every
  // query update. Computing it here means the tile is selected on the very
  // render the row appears in, and no earlier.
  const [releasedHighlight, setReleasedHighlight] = useState<string | null>(null);
  // A NEW `highlightKey` always wins the selection, even over a manual tap the
  // user made while the ~8s generation was in flight: the spinner copy already
  // told them the result would land in My Images, so arrival should put them
  // exactly where they were told to look. The only thing a manual tap blocks
  // is the SAME key re-highlighting itself once released — that is what
  // `releasedHighlight` tracks, per key, below.
  const highlightRow =
    highlightKey && highlightKey !== releasedHighlight
      ? results.find((r) => r.imageKey === highlightKey)
      : undefined;
  const effectiveSelectedId = highlightRow ? highlightRow._id : selectedId;
  const selected = results.find((r) => r._id === effectiveSelectedId) ?? null;

  /**
   * The user is choosing for themselves now, so the highlight stops being
   * special — it becomes an ordinary selection they can keep or replace, and a
   * row that arrives late can no longer overwrite what they just did.
   */
  function releaseHighlight() {
    if (!highlightKey || highlightKey === releasedHighlight) return;
    setReleasedHighlight(highlightKey);
    if (highlightRow) setSelectedId(highlightRow._id);
  }

  /**
   * "Is anything still using this image?" — the gate on the one hard delete in
   * the image model. `"skip"` while nothing is selected so we don't run the
   * reference walk on every render of an idle tab.
   *
   * `undefined` means still loading, and that is NOT the same as 0: treating
   * it as 0 would enable Delete for a beat on an image a symbol uses, and a
   * fast tap would then hit a 409 it did not deserve to see.
   */
  const usage = useQuery(
    api.accountImages.usageCount,
    selected ? { imageKey: selected.imageKey } : "skip"
  );
  const [isDeleting, setIsDeleting] = useState(false);
  /**
   * What went wrong on the LAST delete attempt. `blocked` carries the count
   * the SERVER returned, which can differ from `usage` above — another tab may
   * have placed the image since this client last heard about it, and the
   * server's number is the true one.
   */
  const [deleteError, setDeleteError] = useState<
    { kind: "blocked"; count: number } | { kind: "failed" } | null
  >(null);

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isEmpty = !isLoadingFirstPage && results.length === 0;

  // The row currently on the symbol being edited — saved or not. `usage`
  // above only counts SAVED references, so a just-added, not-yet-saved
  // reference is invisible to it and would otherwise read as "unused".
  const isSelectedOnDraft =
    !!selected && !!draftImageKey && selected.imageKey === draftImageKey;

  // Delete is live ONLY at a known 0 AND not the symbol's own in-progress
  // image. Unknown (loading) and >0 both keep it disabled; the difference is
  // that >0 says why, below, and loading says nothing — a message that
  // flickers on every selection is worse than none.
  const canDelete = !!selected && usage === 0 && !isDeleting && !isSelectedOnDraft;
  // A remembered 409 count goes stale the instant the live count drops to 0 —
  // another tab, or a collaborator, may have removed the last reference since
  // the response landed. `canDelete` already follows live `usage`; the
  // message must too, or the button re-enables while the text underneath
  // still says it's blocked. Derived here rather than cleared in an effect —
  // same shape as `effectiveSelectedId` above — so the correction lands on
  // the render `usage` changes on, not one later.
  const blockedCount =
    deleteError?.kind === "blocked" && usage !== 0
      ? deleteError.count
      : selected && typeof usage === "number" && usage > 0
        ? usage
        : null;
  const deleteStatusId = useId();

  /**
   * The one call in the product that removes an image object from R2. Goes
   * through the API route because a Convex mutation cannot reach R2; the route
   * re-checks the reference count server-side, so this client-side gate is a
   * courtesy, not the protection.
   *
   * No confirm dialog on purpose: selecting a tile and then pressing Delete in
   * a separate bar IS the deliberate two-step (MOS-52). A modal on top of a
   * modal would be the third.
   */
  async function handleDelete() {
    if (!selected || !canDelete) return;
    const imageKey = selected.imageKey;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/delete-account-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageKey }),
      });
      if (res.ok) {
        // Nothing to remove from the grid by hand — `listMine` is reactive, so
        // the tile disappears on its own. Clearing the selection is what stops
        // the action bar pointing at a row that no longer exists.
        releaseHighlight();
        setSelectedId(null);
        return;
      }
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as
          | { count?: number }
          | null;
        setDeleteError({ kind: "blocked", count: data?.count ?? 0 });
        return;
      }
      setDeleteError({ kind: "failed" });
    } catch {
      setDeleteError({ kind: "failed" });
    } finally {
      setIsDeleting(false);
    }
  }

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
              const isSelected = effectiveSelectedId === row._id;
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
                  onClick={() => {
                    releaseHighlight();
                    // A "used by N items" / "couldn't delete" message belongs
                    // to the image it was raised for, not to the next one.
                    setDeleteError(null);
                    setSelectedId(isSelected ? null : row._id);
                  }}
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
              onClick={() => {
                releaseHighlight();
                loadMore(PAGE_SIZE);
              }}
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
        className="shrink-0 flex flex-col gap-2 px-3 py-3"
        style={{ borderTop: "1px solid var(--theme-alt-line)" }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!selected || isDeleting}
            onClick={() => {
              if (!selected) return;
              releaseHighlight();
              onImageReferenced(selected);
            }}
            className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
            style={{
              background: "var(--theme-brand-primary)",
              color: "var(--theme-alt-text)",
              opacity: selected && !isDeleting ? 1 : 0.5,
            }}
          >
            {t("myImagesAdd")}
          </button>
          {/* The one hard delete for images in the product. Enabled only at a
              known usage count of 0 — see `canDelete`. `aria-disabled` rather
              than `disabled` keeps it focusable so a screen-reader user can
              land on it and hear WHY via `aria-describedby`; the click is
              still guarded by `canDelete` inside `handleDelete`. */}
          <button
            type="button"
            aria-disabled={!canDelete}
            aria-describedby={deleteStatusId}
            onClick={handleDelete}
            className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
            style={{
              background: "var(--theme-symbol-bg)",
              color: "var(--theme-secondary-text)",
              border: "1px solid var(--theme-button-highlight)",
              opacity: canDelete ? 1 : 0.5,
            }}
          >
            {t("myImagesDelete")}
          </button>
        </div>
      </div>

      {/* Permanent footer, the same band the Image Search and AI Generate tabs
          end on (their quota lines). Always rendered so the layout never jumps
          and the Delete button's `aria-describedby` always resolves to a real
          node — a disabled button with no explanation is the worst of both.
          The text answers the one question the bar raises: can this image be
          deleted, and if not, why. `role="status"` so a screen reader hears
          the answer without focus leaving the button. */}
      <div
        id={deleteStatusId}
        role="status"
        className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 text-theme-xs text-center leading-snug"
        style={{
          color: "var(--theme-secondary-text)",
          borderTop: "1px solid var(--theme-alt-line)",
        }}
      >
        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          {blockedCount !== null
            ? t("myImagesDeleteBlocked", { count: blockedCount })
            : isSelectedOnDraft
              ? t("myImagesDeleteOnDraft")
              : deleteError?.kind === "failed"
                ? t("myImagesDeleteFailed")
                : selected && usage === 0
                  ? t("myImagesFooterUnused")
                  : t("myImagesFooterSelect")}
        </span>
      </div>
    </div>
  );
}
