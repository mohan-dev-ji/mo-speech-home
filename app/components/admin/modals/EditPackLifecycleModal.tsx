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
import { TagPicker } from "@/app/components/admin/ui/TagPicker";

type PackRow = {
  slug: string;
  name: { eng: string; hin?: string };
  defaultTier: "free" | "pro" | "max";
  publishedAt: number | null;
  expiresAt: number | null;
  featured: boolean;
  tierOverride: "free" | "pro" | "max" | null;
  seasonOverride: string | null;
  tags: string[];
  notes: string | null;
};

type Props = {
  pack: PackRow;
  /** Catalogue-wide tag union, drives the TagPicker autocomplete. */
  tagSuggestions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Edit the lifecycle overlay for one pack — publish window, featured flag,
 * tier override, season override, notes. This modal never touches pack
 * content (JSON in convex/data/library_packs/); content authoring lives in
 * the main app under viewMode === 'admin'. Per plan §2.6.
 *
 * On Save, a single `updatePackLifecycle` mutation patches every changed
 * field. Cleared fields (empty inputs) write `null` to clear the override.
 */
export function EditPackLifecycleModal({
  pack,
  tagSuggestions,
  open,
  onOpenChange,
}: Props) {
  const updateLifecycle = useMutation(api.resourcePacks.updatePackLifecycle);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Datetime-local inputs need ISO-ish strings; convert ms timestamps both
  // ways. Empty string in either direction means "no value".
  const [publishedAt, setPublishedAt] = useState(timestampToLocalInput(pack.publishedAt));
  const [expiresAt, setExpiresAt] = useState(timestampToLocalInput(pack.expiresAt));
  const [featured, setFeatured] = useState(pack.featured);
  const [tierOverride, setTierOverride] = useState<string>(pack.tierOverride ?? "");

  // Pre-fill the picker with existing tags. If a pack only has the legacy
  // `seasonOverride` value, surface it as the first tag so saving the
  // modal migrates it forward — zero data loss with no migration script.
  const initialTags =
    pack.tags.length > 0
      ? pack.tags
      : pack.seasonOverride
      ? [pack.seasonOverride.toLowerCase().trim()]
      : [];
  const [tags, setTags] = useState<string[]>(initialTags);
  const hadLegacySeason =
    pack.tags.length === 0 && pack.seasonOverride != null;

  const [notes, setNotes] = useState(pack.notes ?? "");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateLifecycle({
          slug: pack.slug,
          publishedAt: localInputToTimestamp(publishedAt),
          expiresAt: localInputToTimestamp(expiresAt),
          featured,
          tierOverride: tierOverride === "" ? null : (tierOverride as "free" | "pro" | "max"),
          tags,
          // Clear the legacy field on save once we've folded it into tags.
          // If the admin had nothing in seasonOverride this is a no-op.
          ...(hadLegacySeason && { seasonOverride: null }),
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
          <DialogTitle>Edit lifecycle — {pack.name.eng}</DialogTitle>
          <DialogDescription>
            Slug: <span className="font-mono">{pack.slug}</span> · Default tier:{" "}
            <span className="uppercase">{pack.defaultTier}</span>
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
              <option value="">— Use default ({pack.defaultTier})</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
          </Field>

          <Field label="Tags">
            <TagPicker
              value={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              placeholder="halloween, sports, sensory-friendly…"
            />
            {hadLegacySeason && (
              <p className="text-caption text-muted-foreground mt-1">
                Pre-filled from legacy season{" "}
                <span className="font-mono">
                  &ldquo;{pack.seasonOverride}&rdquo;
                </span>
                . Saving will migrate it.
              </p>
            )}
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

          {error && (
            <p className="text-caption text-destructive">{error}</p>
          )}

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

/**
 * Convert a unix ms timestamp into the `YYYY-MM-DDTHH:mm` shape expected
 * by `<input type="datetime-local">`. Uses local-timezone formatting so
 * the displayed datetime matches what the admin sees on their clock.
 */
function timestampToLocalInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Inverse of `timestampToLocalInput`. Empty string → null (clear field).
 */
function localInputToTimestamp(s: string): number | null {
  if (!s) return null;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}
