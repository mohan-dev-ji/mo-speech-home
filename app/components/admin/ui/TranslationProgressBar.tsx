"use client";

import { useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Pause, Play, X } from "lucide-react";
import { SearchIndexReminderBanner } from "@/app/components/admin/ui/SearchIndexReminderBanner";

type Props = {
  slug: string;
};

/**
 * Live progress + control surface for the `symbols-words` translation
 * job. Subscribes to `getJob` so the bar ticks up as the action commits
 * each batch.
 *
 * Renders nothing when there's no job row for the language (the row's
 * dropdown still shows "Translate symbols…" — the modal creates the
 * row). Renders the bar + controls when status ∈ {`running`, `paused`,
 * `failed`}. When `completed`, renders the post-completion search-index
 * reminder.
 */
export function TranslationProgressBar({ slug }: Props) {
  const job = useQuery(api.translationJobs.getJob, {
    slug,
    kind: "symbols-words",
  });

  const pauseJob = useMutation(api.translationJobs.pauseJob);
  const resumeJob = useMutation(api.translationJobs.resumeJob);
  const cancelJob = useMutation(api.translationJobs.cancelJob);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  if (job === undefined || job === null) return null;

  // Completed jobs show the search-index reminder banner once.
  if (job.status === "completed") {
    return <SearchIndexReminderBanner slug={slug} job={job} />;
  }

  const percent =
    job.totalCount > 0
      ? Math.min(100, Math.round((job.processedCount / job.totalCount) * 100))
      : 0;

  const eta = computeEta(job);

  const isPaused = job.status === "paused";
  const isFailed = job.status === "failed";
  const isRunning = job.status === "running";

  function safe(label: string, fn: () => Promise<unknown>) {
    setActionError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setActionError(
          `${label}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    });
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-caption">
          <StatusDot status={job.status} />
          <span className="text-muted-foreground">
            Translating symbols —{" "}
          </span>
          <span className="font-medium tabular-nums">
            {job.processedCount.toLocaleString()} / {job.totalCount.toLocaleString()}
          </span>
          <span className="text-muted-foreground">({percent}%)</span>
          {eta && isRunning && (
            <span className="text-muted-foreground">· {eta} left</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isRunning && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={isPending}
              onClick={() =>
                safe("pause", () => pauseJob({ jobId: job._id as Id<"translationJobs"> }))
              }
              aria-label="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </Button>
          )}
          {(isPaused || isFailed) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={isPending}
              onClick={() =>
                safe("resume", () => resumeJob({ jobId: job._id as Id<"translationJobs"> }))
              }
              aria-label="Resume"
            >
              <Play className="w-3.5 h-3.5" />
            </Button>
          )}
          {!isFailed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={isPending}
              onClick={() =>
                safe("cancel", () => cancelJob({ jobId: job._id as Id<"translationJobs"> }))
              }
              aria-label="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${barColour(job.status)}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {job.lastError && (
        <p className="text-caption text-destructive break-words">
          {job.lastError}
        </p>
      )}
      {actionError && (
        <p className="text-caption text-destructive">{actionError}</p>
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colour =
    status === "running"
      ? "bg-primary animate-pulse"
      : status === "paused"
        ? "bg-warning"
        : status === "failed"
          ? "bg-destructive"
          : "bg-muted-foreground";
  return <span className={`w-2 h-2 rounded-full inline-block ${colour}`} />;
}

function barColour(status: string): string {
  if (status === "failed") return "bg-destructive";
  if (status === "paused") return "bg-warning";
  return "bg-primary";
}

function computeEta(job: {
  processedCount: number;
  totalCount: number;
  startedAt: number;
}): string | null {
  if (job.processedCount === 0) return null;
  const elapsed = Date.now() - job.startedAt;
  const remaining = job.totalCount - job.processedCount;
  if (remaining <= 0) return null;
  const msPerSymbol = elapsed / job.processedCount;
  const remainingMs = msPerSymbol * remaining;
  const remainingMin = Math.ceil(remainingMs / 60_000);
  if (remainingMin < 1) return "<1 min";
  if (remainingMin < 60) return `~${remainingMin} min`;
  const hrs = Math.floor(remainingMin / 60);
  const mins = remainingMin % 60;
  return `~${hrs}h ${mins}m`;
}
