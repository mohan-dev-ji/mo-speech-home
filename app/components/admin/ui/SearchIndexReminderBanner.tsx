"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Check, Copy, CheckCircle2, ChevronRight } from "lucide-react";

type Props = {
  slug: string;
  job: Doc<"translationJobs">;
};

/**
 * Phase 8.2 post-completion banner — Convex doesn't support dynamic
 * search indexes, so promoting a freshly-translated language to
 * searchable status still requires a schema PR. This banner generates
 * the exact one-line snippet so the admin can paste it straight into
 * `convex/schema.ts`.
 *
 * Renders for translation jobs in `completed` status. The snippet is
 * idempotent — pasting it twice or pasting after the index already
 * exists fails the schema push with a clear error from Convex, so no
 * data risk.
 */
export function SearchIndexReminderBanner({ slug, job }: Props) {
  const [copied, setCopied] = useState(false);

  const snippet = `.searchIndex("search_words_${slug}", { searchField: "words.${slug}", filterFields: ["priority"] })`;

  function copySnippet() {
    navigator.clipboard.writeText(snippet).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard API failed (Safari permissions etc.) — fall back to alert.
        window.prompt("Copy this snippet:", snippet);
      },
    );
  }

  return (
    // Collapsed by default so the completion detail can't widen the table cell
    // and push the Publish/Translation/actions columns off-screen. `max-w` caps
    // it; `<details>` keeps the verbose snippet one click away under "Seed details".
    <details className="group mt-2 max-w-md rounded-md border border-success/40 bg-success/5">
      <summary className="flex items-center gap-2 p-2 cursor-pointer list-none select-none">
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <span className="text-caption font-medium truncate">
          Seed details — {job.processedCount.toLocaleString()} symbols → {slug}
        </span>
      </summary>

      <div className="px-3 pb-3 pt-1 space-y-2">
        <p className="text-caption text-muted-foreground">
          To enable in-app search against the new translations, add this index
          to <span className="font-mono">convex/schema.ts</span> on the{" "}
          <span className="font-mono">symbols</span> table, then redeploy:
        </p>

        <div className="flex items-stretch gap-2">
          <code className="flex-1 min-w-0 font-mono text-caption bg-background border border-border rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
            {snippet}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copySnippet}
            aria-label="Copy snippet"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>

        {job.actualInputTokens !== undefined && (
          <p className="text-caption text-muted-foreground tabular-nums">
            Tokens used: {(job.actualInputTokens ?? 0).toLocaleString()} input ·{" "}
            {(job.actualOutputTokens ?? 0).toLocaleString()} output
          </p>
        )}
      </div>
    </details>
  );
}
