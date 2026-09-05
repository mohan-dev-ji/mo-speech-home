"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ImageOff } from "lucide-react";
// Type-only, erased at build — but it still points at `convex/schema.ts`, the
// module that defines the validator this type mirrors, NOT at
// `convex/imageCredits.ts` (review fix, 2026-08-25). That file is a Convex
// FUNCTION module; routing even a type-only import from a frontend component
// through one is the drift `convex/data/_shared/types.ts:22-30` documents.
import type { CreditRow } from "@/convex/schema";

/**
 * Renders one account's image-credit rows (Phase 31 Task 4). Presentational
 * only — props in, markup out, no data fetching. `CreditsPanel` owns the
 * `useQuery` and the loading/empty states; this component only ever sees a
 * non-empty array.
 *
 * Grouping: `imageSearch` rows carry the Creative Commons attribution
 * obligation, so they list in full (thumbnail, title, artist, licence).
 * `aiGenerated` rows carry no attribution requirement — collapsing them
 * under one expandable count line keeps the credits that matter from being
 * buried under an AI-image list that exists only for completeness.
 */
export function CreditList({ credits }: { credits: CreditRow[] }) {
  const thirdParty = credits.filter((row) => row.imageSourceType === "imageSearch");
  const aiGenerated = credits.filter((row) => row.imageSourceType === "aiGenerated");

  return (
    <div className="flex flex-col gap-theme-gap">
      {thirdParty.length > 0 && (
        <ul className="flex flex-col gap-theme-elements">
          {thirdParty.map((row) => (
            <CreditRowItem key={row.imageKey} row={row} />
          ))}
        </ul>
      )}
      {aiGenerated.length > 0 && <AiGeneratedGroup rows={aiGenerated} />}
    </div>
  );
}

/** Shared box geometry for a credit thumbnail and its fallback, so a 404
 * cannot change the row's height or the AI grid's wrapping. */
const THUMB_CLASS = "size-12 shrink-0 rounded-theme-sm bg-theme-surface object-contain";

/**
 * One credit thumbnail that degrades to a visible placeholder when the object
 * is gone (phase-31 whole-phase review, Finding 3b).
 *
 * A credit row outlives the object it points at: an `imageCredits` row is only
 * ever removed alongside its object, by the My Images Delete
 * (`accountImages.deleteIfUnused` — the product's one hard delete for an
 * image, ADR-024 §2), and nothing else collects them; a module's `credits`
 * array is append-only; and the `library_packs/` prefix is scheduled for
 * deletion. So `/api/assets?key=…`
 * returning 404 is an expected state, not a bug — and a bare `<img alt="">`
 * renders it as a blank box next to a photographer's name, on the one screen
 * whose entire job is to look trustworthy. The glyph says "thumbnail
 * unavailable" without claiming the app is broken.
 *
 * `aria-hidden` on the fallback deliberately matches `alt=""` on the image it
 * replaces: the credit text sits right beside it, so announcing the thumbnail
 * twice — or announcing its absence — adds nothing. Failure state and success
 * state therefore read identically to a screen reader. No copy string is
 * introduced, so nothing here can drift out of `en.json`.
 */
function CreditThumb({ imageKey }: { imageKey: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-hidden="true"
        className={`${THUMB_CLASS} flex items-center justify-center border border-theme-line`}
      >
        <ImageOff className="size-5 text-theme-secondary-alt-text" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/assets?key=${imageKey}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={THUMB_CLASS}
    />
  );
}

function CreditRowItem({ row }: { row: CreditRow }) {
  const t = useTranslations("credits");
  const textParts = [row.imageTitle, row.attribution, row.license].filter(
    (part): part is string => Boolean(part)
  );
  const hasText = textParts.length > 0;

  const body = (
    <>
      <CreditThumb imageKey={row.imageKey} />
      <div className="min-w-0 flex-1">
        {hasText && (
          <p className="text-theme-s text-theme-alt-text">
            <span className="font-medium">{textParts[0]}</span>
            {textParts.slice(1).map((part, i) => (
              <span key={i}> — {part}</span>
            ))}
          </p>
        )}
        {row.firstUsedFor && (
          <p className="mt-0.5 text-theme-xs text-theme-secondary-alt-text">
            {t("usedFor", { label: row.firstUsedFor })}
          </p>
        )}
      </div>
    </>
  );

  const rowClassName = "flex items-center gap-theme-elements rounded-theme-sm p-theme-item";

  if (row.imageSourceUrl) {
    return (
      <li>
        <a
          href={row.imageSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={hasText ? undefined : t("viewSource")}
          className={`${rowClassName} transition-colors hover:bg-theme-surface`}
        >
          {body}
        </a>
      </li>
    );
  }

  return <li className={rowClassName}>{body}</li>;
}

function AiGeneratedGroup({ rows }: { rows: CreditRow[] }) {
  const t = useTranslations("credits");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-theme-sm border border-theme-line">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-theme-elements p-theme-item text-left"
      >
        <span className="text-theme-s font-medium text-theme-alt-text">
          {t("aiGeneratedCount", { count: rows.length })}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-theme-secondary-alt-text transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-theme-elements border-t border-theme-line p-theme-item">
          {rows.map((row) => (
            <CreditThumb key={row.imageKey} imageKey={row.imageKey} />
          ))}
        </div>
      )}
    </div>
  );
}
