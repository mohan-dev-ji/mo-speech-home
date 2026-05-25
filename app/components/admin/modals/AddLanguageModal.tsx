"use client";

import { useState, useTransition } from "react";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Codes already present in the registry — used to block duplicates. */
  existingCodes: string[];
  /** Called after the publish API + Convex mutation both succeed. Parent
   *  can fire a toast and prompt the admin to redeploy so the registry
   *  picks up the new JSON. */
  onAdded: (code: string) => void;
};

/**
 * Add a new language to the registry. Two-step flow (single click for the
 * admin):
 *
 *   1. POST /api/admin/language-publish → writes
 *      `convex/data/languages/<code>.json` + regenerates the barrel.
 *   2. Lifecycle row is created lazily on the first lifecycle edit (or
 *      via the table's "Publish now" quick action). We don't insert a
 *      row here on purpose — admin probably wants to run the translation
 *      pipeline before publishing.
 *
 * After step 1 the JSON exists on disk but the next.js bundle still
 * references the old barrel. A redeploy (or hot reload in dev) picks up
 * the new file. The toast prompts for that.
 *
 * Voices start empty — Phase 8.4 adds the seeding flow. Empty voices is
 * valid (typed `VoiceEntry[]`); the language is just unusable for TTS
 * until voices land.
 */
export function AddLanguageModal({ open, onOpenChange, existingCodes, onAdded }: Props) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [nativeLabel, setNativeLabel] = useState("");
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  const [font, setFont] = useState("notoSans");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setLabel("");
    setNativeLabel("");
    setDir("ltr");
    setFont("notoSans");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim().toLowerCase();
    if (!/^[a-z]{2,3}(-[a-z]{2})?$/.test(cleanCode)) {
      setError(
        "Code must be an ISO 639-1 code (2–3 lowercase letters, optionally region-tagged like 'pt-br')."
      );
      return;
    }
    if (existingCodes.includes(cleanCode)) {
      setError(`Language "${cleanCode}" already exists. Use the table to edit it.`);
      return;
    }
    if (label.trim() === "" || nativeLabel.trim() === "") {
      setError("Label and native label are required.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/language-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: cleanCode,
            label: label.trim(),
            nativeLabel: nativeLabel.trim(),
            dir,
            font: font.trim() || "notoSans",
            voices: [],
          }),
        });
        const body = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? `Publish failed (HTTP ${res.status})`);
        }
        onAdded(cleanCode);
        reset();
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Publish failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a language</DialogTitle>
          <DialogDescription>
            Writes <span className="font-mono">convex/data/languages/&lt;code&gt;.json</span>{" "}
            and regenerates the registry barrel. Reload the dev server (or
            redeploy) to pick up the new entry.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ISO code">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="es, ko, pt-BR"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-small font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </Field>
            <Field label="Direction">
              <select
                value={dir}
                onChange={(e) => setDir(e.target.value as "ltr" | "rtl")}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="ltr">LTR</option>
                <option value="rtl">RTL (Arabic / Hebrew)</option>
              </select>
            </Field>
          </div>

          <Field label="English label">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Spanish"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </Field>

          <Field label="Native label">
            <input
              value={nativeLabel}
              onChange={(e) => setNativeLabel(e.target.value)}
              placeholder="Español"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </Field>

          <Field label="Font loader id">
            <input
              value={font}
              onChange={(e) => setFont(e.target.value)}
              placeholder="notoSans"
              spellCheck={false}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-small font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-caption text-muted-foreground mt-1">
              Map this id to a <code className="font-mono">next/font</code> loader
              entry in Phase 8.5. Default <code>notoSans</code> covers most scripts.
            </p>
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
              Add language
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
