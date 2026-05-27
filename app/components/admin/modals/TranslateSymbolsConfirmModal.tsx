"use client";

import { useEffect, useState, useTransition } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

type Props = {
  code: string;
  label: string;
  nativeLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Phase 8.2 dry-run + start modal for the symbol translation pipeline.
 *
 * Subscribes to `estimateSymbolTranslation` for live cost / time / count
 * estimates. The dry-run scans the table once (cheap; rare) — never
 * dispatches a Gemini call. The "Start translation" button fires the
 * mutation that kicks off the background action.
 *
 * Closes the modal on successful start — the live progress bar on the
 * row takes over from there.
 */
export function TranslateSymbolsConfirmModal({
  code,
  label,
  nativeLabel,
  open,
  onOpenChange,
}: Props) {
  // Estimate is an action (not a query) because Convex caps each query to
  // one paginate() call and we scan the symbols table across ~15 pages.
  // We trigger it once when the modal opens; the result is captured in
  // local state. No reactive subscription — if you re-open the modal, the
  // estimate refreshes.
  const runEstimate = useAction(api.translationJobs.estimateSymbolTranslation);
  const startTranslation = useMutation(
    api.translationJobs.startSymbolTranslation,
  );

  type EstimateResult = Awaited<ReturnType<typeof runEstimate>>;
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset on close so a re-open re-fetches.
      setEstimate(null);
      setEstimateError(null);
      return;
    }
    let cancelled = false;
    runEstimate({ slug: code })
      .then((result) => {
        if (!cancelled) setEstimate(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setEstimateError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, code, runEstimate]);

  function handleStart() {
    if (!estimate) return;
    setError(null);
    startTransition(async () => {
      try {
        await startTranslation({
          slug: code,
          totalCount: estimate.toTranslate,
          estimatedTokens:
            estimate.estimatedInputTokens + estimate.estimatedOutputTokens,
        });
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Start failed");
      }
    });
  }

  const loading = estimate === null && !estimateError;
  const nothingToDo = estimate !== null && estimate.toTranslate === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Translate symbols — {label} ({nativeLabel})
          </DialogTitle>
          <DialogDescription>
            One-time AI translation of the symbol catalogue. Runs in the
            background; you can close this tab and come back.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-6 text-center text-small text-muted-foreground">
            Calculating estimate…
          </div>
        )}

        {estimateError && (
          <p className="text-caption text-destructive py-2">
            Estimate failed: {estimateError}
          </p>
        )}

        {estimate && (
          <div className="space-y-3 py-2">
            <Stat label="Total symbols" value={estimate.totalSymbols.toLocaleString()} />
            <Stat
              label="Already translated"
              value={estimate.alreadyTranslated.toLocaleString()}
              dim={estimate.alreadyTranslated === 0}
            />
            <Stat
              label="To translate this run"
              value={estimate.toTranslate.toLocaleString()}
              emphasis={estimate.toTranslate > 0}
            />
            <div className="border-t border-border pt-3 space-y-3">
              <Stat
                label="Estimated cost (Gemini 2.5 Flash)"
                value={`$${estimate.estimatedCostUsd.toFixed(2)}`}
              />
              <Stat
                label="Estimated time"
                value={formatDuration(estimate.estimatedSeconds)}
              />
              <Stat
                label="Estimated Gemini batches"
                value={estimate.estimatedBatches.toLocaleString()}
                dim
              />
            </div>
          </div>
        )}

        {nothingToDo && (
          <p className="text-caption text-muted-foreground py-2">
            Every symbol already has a translation for{" "}
            <span className="font-mono">{code}</span>. Nothing to do.
          </p>
        )}

        {error && <p className="text-caption text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            loading={isPending}
            disabled={loading || nothingToDo}
            onClick={handleStart}
          >
            Start translation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  dim = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  dim?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-small text-muted-foreground">{label}</span>
      <span
        className={
          emphasis
            ? "text-body font-semibold tabular-nums"
            : dim
              ? "text-small text-muted-foreground tabular-nums"
              : "text-small font-medium tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}
