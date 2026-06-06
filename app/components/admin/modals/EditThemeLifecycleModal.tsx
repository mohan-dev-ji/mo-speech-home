"use client";

import { useState, useTransition } from "react";
import { useMutation } from "convex/react";
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

type ThemeRow = {
  slug: string;
  name: Record<string, string>;
  defaultTier: "free" | "pro" | "max";
  builtin: boolean;
  publishedAt: number | null;
  expiresAt: number | null;
  featured: boolean;
  tierOverride: "free" | "pro" | "max" | null;
  notes: string | null;
};

type Props = {
  theme: ThemeRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Edit the lifecycle overlay for one theme (ADR-011 §2.4) — publish window,
 * featured flag, tier override, notes. Never touches token values (JSON in
 * convex/data/themes/); those change by code deploy. On Save a single
 * `updateThemeLifecycle` mutation patches every changed field; cleared inputs
 * write `null` to clear the override.
 */
export function EditThemeLifecycleModal({ theme, open, onOpenChange }: Props) {
  const updateLifecycle = useMutation(api.themes.updateThemeLifecycle);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [publishedAt, setPublishedAt] = useState(timestampToLocalInput(theme.publishedAt));
  const [expiresAt, setExpiresAt] = useState(timestampToLocalInput(theme.expiresAt));
  const [featured, setFeatured] = useState(theme.featured);
  const [tierOverride, setTierOverride] = useState<string>(theme.tierOverride ?? "");
  const [notes, setNotes] = useState(theme.notes ?? "");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateLifecycle({
          slug: theme.slug,
          publishedAt: localInputToTimestamp(publishedAt),
          expiresAt: localInputToTimestamp(expiresAt),
          featured,
          tierOverride: tierOverride === "" ? null : (tierOverride as "free" | "pro" | "max"),
          notes: notes.trim() === "" ? null : notes.trim(),
        });
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit lifecycle — {theme.name.en ?? theme.slug}</DialogTitle>
          <DialogDescription>
            Slug: <span className="font-mono">{theme.slug}</span> · Default tier:{" "}
            <span className="uppercase">{theme.defaultTier}</span>
            {theme.builtin && " · Built-in (always visible regardless of publish state)"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publish at">
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </Field>

            <Field label="Expires at">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </Field>
          </div>

          <Field label="Tier override">
            <select
              value={tierOverride}
              onChange={(e) => setTierOverride(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Use default ({theme.defaultTier})</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
          </Field>

          <div className="flex items-center gap-2">
            <input
              id="featured"
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="featured" className="text-small font-medium">
              Featured
            </label>
          </div>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          </Field>

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
            <Button type="submit" size="sm" loading={isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function timestampToLocalInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToTimestamp(s: string): number | null {
  if (!s) return null;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}
