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
import type { LanguageTranslationStatus } from "@/app/components/admin/constants";

type LanguageRow = {
  code: string;
  label: string;
  nativeLabel: string;
  publishedAt: number | null;
  expiresAt: number | null;
  tierOverride: "free" | "pro" | "max" | null;
  notes: string | null;
  translationStatus: LanguageTranslationStatus;
};

type Props = {
  lang: LanguageRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Edit one language's lifecycle overlay — publish window, translation
 * status, tier override, notes. Clones the Library equivalent shape;
 * differs only in field set (no featured / tags — both are pack-specific
 * concepts). Per Phase 8.1 build doc.
 *
 * Translation status (`machine-translated` → `beta` → `stable`) is the
 * key ADR-009 §3 axis admins promote a language through. It's a dropdown
 * here for explicit edits; the table also exposes a one-click "Promote"
 * quick action via the row dropdown.
 */
export function EditLanguageLifecycleModal({
  lang,
  open,
  onOpenChange,
}: Props) {
  const updateLifecycle = useMutation(api.languages.updateLanguageLifecycle);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [publishedAt, setPublishedAt] = useState(timestampToLocalInput(lang.publishedAt));
  const [expiresAt, setExpiresAt] = useState(timestampToLocalInput(lang.expiresAt));
  const [status, setStatus] = useState<LanguageTranslationStatus>(lang.translationStatus);
  const [tierOverride, setTierOverride] = useState<string>(lang.tierOverride ?? "");
  const [notes, setNotes] = useState(lang.notes ?? "");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateLifecycle({
          slug: lang.code,
          publishedAt: localInputToTimestamp(publishedAt),
          expiresAt: localInputToTimestamp(expiresAt),
          status,
          tierOverride:
            tierOverride === "" ? null : (tierOverride as "free" | "pro" | "max"),
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
          <DialogTitle>
            Edit lifecycle — {lang.label} ({lang.nativeLabel})
          </DialogTitle>
          <DialogDescription>
            Code: <span className="font-mono">{lang.code}</span>
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

          <Field label="Translation status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LanguageTranslationStatus)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="machine-translated">Machine-translated (hidden in prod)</option>
              <option value="beta">Beta (preview pill in pickers)</option>
              <option value="stable">Stable (no pill)</option>
            </select>
          </Field>

          <Field label="Tier override">
            <select
              value={tierOverride}
              onChange={(e) => setTierOverride(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">— Default (free)</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
          </Field>

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
