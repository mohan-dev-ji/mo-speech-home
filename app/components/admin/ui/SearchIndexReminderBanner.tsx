"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Check, Copy, CheckCircle2 } from "lucide-react";

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
    <div className="mt-2 rounded-md border border-success/40 bg-success/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <p className="text-small font-medium">
            Symbol translation complete — {job.processedCount.toLocaleString()}{" "}
            symbols translated into <span className="font-mono">{slug}</span>.
          </p>
          <p className="text-caption text-muted-foreground">
            To enable in-app search against the new translations, add this index
            to <span className="font-mono">convex/schema.ts</span> on the{" "}
            <span className="font-mono">symbols</span> table, then redeploy:
          </p>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <code className="flex-1 font-mono text-caption bg-background border border-border rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
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
  );
}
