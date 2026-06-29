"use client";

import { useMemo, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/app/components/app/shared/ui/Button";
import {
  LanguagePublishStatusBadge,
  LanguageTranslationStatusBadge,
} from "@/app/components/admin/ui/LanguageStatusBadges";
import { EditLanguageLifecycleModal } from "@/app/components/admin/modals/EditLanguageLifecycleModal";
import { ConfirmDeleteLanguageLifecycleModal } from "@/app/components/admin/modals/ConfirmDeleteLanguageLifecycleModal";
import { AddLanguageModal } from "@/app/components/admin/modals/AddLanguageModal";
import { TranslateSymbolsConfirmModal } from "@/app/components/admin/modals/TranslateSymbolsConfirmModal";
import { TranslationProgressBar } from "@/app/components/admin/ui/TranslationProgressBar";
import type {
  LanguagePublishStatus,
  LanguageTranslationStatus,
} from "@/app/components/admin/constants";
import { formatDate } from "@/lib/utils";
import { MoreHorizontal, Plus, Languages } from "lucide-react";

type LanguageRow = {
  code: string;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
  font: string;
  voiceCount: number;
  lifecycleId: string | null;
  publishedAt: number | null;
  expiresAt: number | null;
  tierOverride: "free" | "pro" | "max" | null;
  notes: string | null;
  updatedAt: number | null;
  createdBy: string | null;
  translationStatus: LanguageTranslationStatus;
  publishStatus: LanguagePublishStatus;
};

type Props = {
  initialLanguages: LanguageRow[];
};

type PublishFilter = "all" | LanguagePublishStatus;
type TranslationFilter = "all" | LanguageTranslationStatus;

/**
 * Phase 8.1 admin Languages section. Lists every language module in the
 * bundled registry joined with its `languageLifecycle` row, with per-row
 * actions for the full lifecycle.
 *
 * Layout cloned from `LibraryAdminTable`:
 *   - Filter row at the top (publish status + translation status).
 *   - One row per language, with publish + translation badges.
 *   - Per-row dropdown: Publish now / Unpublish, Promote, Translate UI
 *     strings, Edit lifecycle…, Unpublish (delete row).
 *
 * Translation pipeline call ("Translate UI strings") is fire-and-forget
 * from the client — POSTs to `/api/admin/translate-ui-strings`. Result
 * arrives in a toast (or here, an alert for now — proper toast hookup is
 * a follow-up).
 */
export function LanguagesAdminTable({ initialLanguages }: Props) {
  // Gate the live query on Convex auth readiness. On a hard refresh the Convex
  // client connects a beat before ConvexProviderWithClerk hands it the Clerk
  // JWT; firing an admin query in that window throws UNAUTHENTICATED (which
  // crashes this client component and prevents the row dropdowns from mounting).
  // `'skip'` until authenticated; the SSR `initialLanguages` shows meanwhile.
  const { isAuthenticated } = useConvexAuth();
  const liveLanguages = useQuery(
    api.languages.listAllLanguagesForAdmin,
    isAuthenticated ? {} : "skip"
  );
  const languages = (liveLanguages ?? initialLanguages) as LanguageRow[];

  const updateLifecycle = useMutation(api.languages.updateLanguageLifecycle);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");
  const [translationFilter, setTranslationFilter] = useState<TranslationFilter>("all");

  const [editTarget, setEditTarget] = useState<LanguageRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LanguageRow | null>(null);
  const [translateSymbolsTarget, setTranslateSymbolsTarget] =
    useState<LanguageRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    return languages.filter((l) => {
      if (publishFilter !== "all" && l.publishStatus !== publishFilter) return false;
      if (translationFilter !== "all" && l.translationStatus !== translationFilter)
        return false;
      return true;
    });
  }, [languages, publishFilter, translationFilter]);

  async function runQuickAction(
    code: string,
    patch: Parameters<typeof updateLifecycle>[0]
  ) {
    setBusyCode(code);
    startTransition(async () => {
      try {
        await updateLifecycle(patch);
      } finally {
        setBusyCode(null);
      }
    });
  }

  async function runTranslateModules(code: string) {
    setBusyCode(code);
    try {
      const res = await fetch("/api/admin/translate-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        modules?: number;
        translated?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        alert(`Module translation failed: ${body.error ?? `HTTP ${res.status}`}`);
        return;
      }
      alert(
        `Translated ${body.translated} module-copy strings to "${code}" ` +
          `across ${body.modules} modules. ${body.skipped} unchanged.`
      );
    } catch (err) {
      alert(`Module translation error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyCode(null);
    }
  }

  async function runTranslate(code: string) {
    setBusyCode(code);
    try {
      const res = await fetch("/api/admin/translate-ui-strings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        translated?: number;
        skipped?: number;
        removed?: number;
        total?: number;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        // Plain alert for now — full toast wiring is a follow-up.
        alert(`Translation failed: ${body.error ?? `HTTP ${res.status}`}`);
        return;
      }
      alert(
        `Translated ${body.translated}/${body.total} UI strings to "${code}". ` +
          `${body.skipped} unchanged, ${body.removed ?? 0} removed.`
      );
    } catch (err) {
      alert(`Translation error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-small text-muted-foreground">
          {filtered.length} of {languages.length} languages in the registry
        </p>
        <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add language
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border border-border rounded-lg p-3 bg-muted/20">
        <FilterSelect
          label="Publish status"
          value={publishFilter}
          onChange={(v) => setPublishFilter(v as PublishFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "live", label: "Live" },
            { value: "scheduled", label: "Scheduled" },
            { value: "draft", label: "Draft" },
            { value: "expired", label: "Expired" },
          ]}
        />
        <FilterSelect
          label="Translation status"
          value={translationFilter}
          onChange={(v) => setTranslationFilter(v as TranslationFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "stable", label: "Stable" },
            { value: "beta", label: "Beta" },
            { value: "machine-translated", label: "Machine" },
          ]}
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium">Language</th>
              <th className="text-left p-4 font-medium">Publish</th>
              <th className="text-left p-4 font-medium">Translation</th>
              <th className="text-left p-4 font-medium hidden md:table-cell">Window</th>
              <th className="text-left p-4 font-medium hidden lg:table-cell">Updated</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr
                key={l.code}
                className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">
                        {l.label}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({l.nativeLabel})
                        </span>
                      </p>
                      <p className="text-caption text-muted-foreground font-mono">
                        {l.code} · {l.voiceCount} voice{l.voiceCount === 1 ? "" : "s"}
                        {l.dir === "rtl" ? " · RTL" : ""}
                      </p>
                    </div>
                  </div>
                  {/* Phase 8.2 inline progress / completion banner — only
                      renders when a translation job exists for this row. */}
                  {l.code !== "en" && <TranslationProgressBar slug={l.code} />}
                </td>
                <td className="p-4">
                  <LanguagePublishStatusBadge status={l.publishStatus} />
                </td>
                <td className="p-4">
                  <LanguageTranslationStatusBadge status={l.translationStatus} />
                </td>
                <td className="p-4 hidden md:table-cell text-muted-foreground text-caption">
                  <WindowCell
                    publishedAt={l.publishedAt}
                    expiresAt={l.expiresAt}
                  />
                </td>
                <td className="p-4 hidden lg:table-cell text-muted-foreground text-caption">
                  {l.updatedAt ? formatDate(l.updatedAt) : "—"}
                </td>
                <td className="p-4 text-right">
                  <RowActions
                    lang={l}
                    busy={busyCode === l.code}
                    onPublishNow={() =>
                      runQuickAction(l.code, {
                        slug: l.code,
                        publishedAt: Date.now(),
                      })
                    }
                    onUnpublish={() =>
                      runQuickAction(l.code, {
                        slug: l.code,
                        publishedAt: null,
                      })
                    }
                    onPromoteToBeta={() =>
                      runQuickAction(l.code, { slug: l.code, status: "beta" })
                    }
                    onPromoteToStable={() =>
                      runQuickAction(l.code, { slug: l.code, status: "stable" })
                    }
                    onDemoteToMachine={() =>
                      runQuickAction(l.code, {
                        slug: l.code,
                        status: "machine-translated",
                      })
                    }
                    onTranslate={() => runTranslate(l.code)}
                    onTranslateModules={() => runTranslateModules(l.code)}
                    onTranslateSymbols={() => setTranslateSymbolsTarget(l)}
                    onEdit={() => setEditTarget(l)}
                    onDelete={() => setDeleteTarget(l)}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-muted-foreground text-small"
                >
                  No languages match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddLanguageModal
        open={addOpen}
        onOpenChange={setAddOpen}
        existingCodes={languages.map((l) => l.code)}
        onAdded={(code) => {
          alert(
            `Added language "${code}". Reload the dev server (or wait for Next to hot-reload) ` +
              `to see it in the registry, then click "Translate UI strings" to seed copy.`
          );
        }}
      />

      {editTarget && (
        <EditLanguageLifecycleModal
          lang={editTarget}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}

      {translateSymbolsTarget && (
        <TranslateSymbolsConfirmModal
          code={translateSymbolsTarget.code}
          label={translateSymbolsTarget.label}
          nativeLabel={translateSymbolsTarget.nativeLabel}
          open
          onOpenChange={(open) => !open && setTranslateSymbolsTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteLanguageLifecycleModal
          code={deleteTarget.code}
          label={deleteTarget.label}
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-small focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function WindowCell({
  publishedAt,
  expiresAt,
}: {
  publishedAt: number | null;
  expiresAt: number | null;
}) {
  if (publishedAt == null && expiresAt == null) return <>—</>;
  return (
    <div className="space-y-0.5">
      {publishedAt != null && <div>From {formatDate(publishedAt)}</div>}
      {expiresAt != null && <div>Until {formatDate(expiresAt)}</div>}
    </div>
  );
}

function RowActions({
  lang,
  busy,
  onPublishNow,
  onUnpublish,
  onPromoteToBeta,
  onPromoteToStable,
  onDemoteToMachine,
  onTranslate,
  onTranslateModules,
  onTranslateSymbols,
  onEdit,
  onDelete,
}: {
  lang: LanguageRow;
  busy: boolean;
  onPublishNow: () => void;
  onUnpublish: () => void;
  onPromoteToBeta: () => void;
  onPromoteToStable: () => void;
  onDemoteToMachine: () => void;
  onTranslate: () => void;
  onTranslateModules: () => void;
  onTranslateSymbols: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPublished =
    lang.publishStatus === "live" || lang.publishStatus === "scheduled";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={busy}
          aria-label="Row actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-[100] min-w-[14rem] rounded-md border border-border bg-card shadow-lg text-small overflow-hidden"
        >
          {isPublished ? (
            <MenuItem onSelect={onUnpublish}>Unpublish</MenuItem>
          ) : (
            <MenuItem onSelect={onPublishNow}>Publish now</MenuItem>
          )}

          <Separator />

          {/* Promote / demote — show the natural next step + the demote option. */}
          {lang.translationStatus === "machine-translated" && (
            <MenuItem onSelect={onPromoteToBeta}>Promote → Beta</MenuItem>
          )}
          {lang.translationStatus === "beta" && (
            <>
              <MenuItem onSelect={onPromoteToStable}>Promote → Stable</MenuItem>
              <MenuItem onSelect={onDemoteToMachine}>Demote → Machine</MenuItem>
            </>
          )}
          {lang.translationStatus === "stable" && (
            <MenuItem onSelect={onPromoteToBeta}>Demote → Beta</MenuItem>
          )}

          <Separator />

          <MenuItem onSelect={onTranslate}>Translate UI strings…</MenuItem>
          {lang.code !== "en" && (
            <>
              <MenuItem onSelect={onTranslateModules}>
                Translate module copy…
              </MenuItem>
              <MenuItem onSelect={onTranslateSymbols}>
                Translate symbols…
              </MenuItem>
            </>
          )}
          <MenuItem onSelect={onEdit}>Edit lifecycle…</MenuItem>

          {lang.lifecycleId && (
            <>
              <Separator />
              <MenuItem destructive onSelect={onDelete}>
                Remove from registry
              </MenuItem>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItem({
  children,
  onSelect,
  destructive = false,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`block w-full text-left px-3 py-2 hover:bg-muted focus:bg-muted focus:outline-none cursor-pointer transition-colors ${
        destructive ? "text-destructive" : ""
      }`}
    >
      {children}
    </DropdownMenu.Item>
  );
}

function Separator() {
  return <div className="h-px bg-border my-1" />;
}
