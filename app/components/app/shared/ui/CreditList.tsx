"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { CreditRow } from "@/convex/imageCredits";

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

function CreditRowItem({ row }: { row: CreditRow }) {
  const t = useTranslations("credits");
  const textParts = [row.imageTitle, row.attribution, row.license].filter(
    (part): part is string => Boolean(part)
  );
  const hasText = textParts.length > 0;

  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/assets?key=${row.imageKey}`}
        alt=""
        loading="lazy"
        className="size-12 shrink-0 rounded-theme-sm bg-theme-surface object-contain"
      />
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={row.imageKey}
              src={`/api/assets?key=${row.imageKey}`}
              alt=""
              loading="lazy"
              className="size-12 shrink-0 rounded-theme-sm bg-theme-surface object-contain"
            />
          ))}
        </div>
      )}
    </div>
  );
}
