"use client";

import { useMemo, useState, useTransition } from "react";
// busy state is tracked per-slug via `busySlug` so individual rows can show a
// spinner while sibling rows stay interactive (the useTransition pending flag
// isn't used).
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { PackStatusBadge } from "@/app/components/admin/ui/PackStatusBadge";
import { EditThemeLifecycleModal } from "@/app/components/admin/modals/EditThemeLifecycleModal";
import { ConfirmDeleteThemeLifecycleModal } from "@/app/components/admin/modals/ConfirmDeleteThemeLifecycleModal";
import type { PackLifecycleStatus } from "@/app/components/admin/constants";
import { formatDate } from "@/lib/utils";
import { Star, MoreHorizontal } from "lucide-react";

type ThemeRow = {
  slug: string;
  name: Record<string, string>;
  description: Record<string, string> | null;
  previewColour: string;
  coverImagePath: string | null;
  type: "flat" | "tiled" | "animated";
  defaultTier: "free" | "pro" | "max";
  builtin: boolean;
  lifecycleId: string | null;
  publishedAt: number | null;
  expiresAt: number | null;
  featured: boolean;
  tierOverride: "free" | "pro" | "max" | null;
  notes: string | null;
  updatedAt: number | null;
  createdBy: string | null;
  status: PackLifecycleStatus;
  effectiveTier: "free" | "pro" | "max";
};

type Props = {
  initialThemes: ThemeRow[];
};

type StatusFilter = "all" | PackLifecycleStatus;
type TierFilter = "all" | "free" | "pro" | "max";
type FeaturedFilter = "all" | "featured" | "not_featured";

/**
 * Builtin themes are always visible in pickers regardless of lifecycle
 * (`isThemeVisible` short-circuits on `builtin`), so their lifecycle-derived
 * "draft" status is misleading in the dashboard. Surface them as "always-on"
 * instead — used for both the badge and the status filter so the two agree.
 */
function effectiveStatus(t: ThemeRow): "always-on" | PackLifecycleStatus {
  return t.builtin ? "always-on" : t.status;
}

/**
 * Phase 9 admin Themes CMS (ADR-011 §2). Lists every theme in the JSON
 * catalogue joined with its themeLifecycle row, with filters and per-row
 * dropdown actions. Lifecycle only — token values are JSON.
 *
 * Quick actions (single mutation, no modal): Publish now / Unpublish, Toggle
 * featured. Multi-field: Edit lifecycle… / Remove from library.
 *
 * Builtin themes are always visible in pickers regardless of lifecycle; a
 * lifecycle row on a builtin only adds featured/tier/scheduling on top.
 */
export function ThemesAdminTable({ initialThemes }: Props) {
  // Gate live admin queries on Convex auth readiness (see LibraryAdminTable).
  const { isAuthenticated } = useConvexAuth();
  const liveThemes = useQuery(
    api.themes.listAllThemesForAdmin,
    isAuthenticated ? {} : "skip"
  );
  const themes = (liveThemes ?? initialThemes) as ThemeRow[];

  const updateLifecycle = useMutation(api.themes.updateThemeLifecycle);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");

  const [editTarget, setEditTarget] = useState<ThemeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ThemeRow | null>(null);

  const filtered = useMemo(() => {
    return themes.filter((t) => {
      if (statusFilter !== "all" && effectiveStatus(t) !== statusFilter) return false;
      if (tierFilter !== "all" && t.effectiveTier !== tierFilter) return false;
      if (featuredFilter === "featured" && !t.featured) return false;
      if (featuredFilter === "not_featured" && t.featured) return false;
      return true;
    });
  }, [themes, statusFilter, tierFilter, featuredFilter]);

  async function runQuickAction(
    slug: string,
    patch: Parameters<typeof updateLifecycle>[0]
  ) {
    setBusySlug(slug);
    startTransition(async () => {
      try {
        await updateLifecycle(patch);
      } finally {
        setBusySlug(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border border-border rounded-lg p-3 bg-muted/20">
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "live", label: "Live" },
            { value: "scheduled", label: "Scheduled" },
            { value: "draft", label: "Draft" },
            { value: "expired", label: "Expired" },
          ]}
        />
        <FilterSelect
          label="Tier"
          value={tierFilter}
          onChange={(v) => setTierFilter(v as TierFilter)}
          options={[
            { value: "all", label: "All tiers" },
            { value: "free", label: "Free" },
            { value: "pro", label: "Pro" },
            { value: "max", label: "Max" },
          ]}
        />
        <FilterSelect
          label="Featured"
          value={featuredFilter}
          onChange={(v) => setFeaturedFilter(v as FeaturedFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "featured", label: "Featured only" },
            { value: "not_featured", label: "Not featured" },
          ]}
        />
        <div className="ml-auto text-caption text-muted-foreground">
          {filtered.length} of {themes.length}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium">Theme</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Tier</th>
              <th className="text-left p-4 font-medium hidden md:table-cell">Window</th>
              <th className="text-left p-4 font-medium hidden lg:table-cell">Updated</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr
                key={t.slug}
                className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: t.previewColour }}
                    />
                    <p className="font-medium">{t.name.en ?? t.slug}</p>
                    {t.builtin && <Badge variant="outline">Built-in</Badge>}
                    {t.type !== "flat" && (
                      <Badge variant="default">{t.type}</Badge>
                    )}
                    {t.featured && (
                      <Star className="w-4 h-4 text-warning fill-current" />
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground font-mono">
                    {t.slug}
                  </p>
                </td>
                <td className="p-4">
                  {t.builtin ? (
                    <Badge variant="success">Always on</Badge>
                  ) : (
                    <PackStatusBadge status={t.status} />
                  )}
                </td>
                <td className="p-4">
                  <TierCell
                    effective={t.effectiveTier}
                    defaultTier={t.defaultTier}
                    overridden={t.tierOverride !== null}
                  />
                </td>
                <td className="p-4 hidden md:table-cell text-muted-foreground text-caption">
                  <WindowCell publishedAt={t.publishedAt} expiresAt={t.expiresAt} />
                </td>
                <td className="p-4 hidden lg:table-cell text-muted-foreground text-caption">
                  {t.updatedAt ? formatDate(t.updatedAt) : "—"}
                </td>
                <td className="p-4 text-right">
                  <RowActions
                    theme={t}
                    busy={busySlug === t.slug}
                    onPublishNow={() =>
                      runQuickAction(t.slug, {
                        slug: t.slug,
                        publishedAt: Date.now(),
                      })
                    }
                    onUnpublish={() =>
                      runQuickAction(t.slug, {
                        slug: t.slug,
                        publishedAt: null,
                      })
                    }
                    onToggleFeatured={() =>
                      runQuickAction(t.slug, {
                        slug: t.slug,
                        featured: !t.featured,
                      })
                    }
                    onEdit={() => setEditTarget(t)}
                    onDelete={() => setDeleteTarget(t)}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground text-small">
                  No themes match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditThemeLifecycleModal
          theme={editTarget}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteThemeLifecycleModal
          slug={deleteTarget.slug}
          themeName={deleteTarget.name.en ?? deleteTarget.slug}
          builtin={deleteTarget.builtin}
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

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

function TierCell({
  effective,
  defaultTier,
  overridden,
}: {
  effective: "free" | "pro" | "max";
  defaultTier: "free" | "pro" | "max";
  overridden: boolean;
}) {
  const variant =
    effective === "max" ? "success" : effective === "pro" ? "default" : "outline";
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={variant}>
        {effective.charAt(0).toUpperCase() + effective.slice(1)}
      </Badge>
      {overridden && effective !== defaultTier && (
        <span className="text-caption text-muted-foreground">
          (default: {defaultTier})
        </span>
      )}
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
  theme,
  busy,
  onPublishNow,
  onUnpublish,
  onToggleFeatured,
  onEdit,
  onDelete,
}: {
  theme: ThemeRow;
  busy: boolean;
  onPublishNow: () => void;
  onUnpublish: () => void;
  onToggleFeatured: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPublished = theme.status === "live" || theme.status === "scheduled";

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
          className="z-[100] min-w-[12rem] rounded-md border border-border bg-card shadow-lg text-small overflow-hidden"
        >
          {isPublished ? (
            <MenuItem onSelect={onUnpublish}>Unpublish</MenuItem>
          ) : (
            <MenuItem onSelect={onPublishNow}>Publish now</MenuItem>
          )}
          <MenuItem onSelect={onToggleFeatured}>
            {theme.featured ? "Unfeature" : "Feature"}
          </MenuItem>
          <MenuItem onSelect={onEdit}>Edit lifecycle…</MenuItem>
          {theme.lifecycleId && (
            <MenuItem destructive onSelect={onDelete}>
              Remove from library
            </MenuItem>
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
