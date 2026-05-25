"use client";

import { useMemo, useState, useTransition } from "react";
// Note: useTransition's first tuple element (the pending flag) isn't used —
// busy state is tracked per-slug via `busySlug` so individual rows can show
// a spinner while sibling rows stay interactive.
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { PackStatusBadge } from "@/app/components/admin/ui/PackStatusBadge";
import { EditPackLifecycleModal } from "@/app/components/admin/modals/EditPackLifecycleModal";
import { ConfirmDeletePackLifecycleModal } from "@/app/components/admin/modals/ConfirmDeletePackLifecycleModal";
import type { PackLifecycleStatus } from "@/app/components/admin/constants";
import { formatDate } from "@/lib/utils";
import { Star, MoreHorizontal } from "lucide-react";

type PackRow = {
  slug: string;
  name: Record<string, string>;
  description: Record<string, string>;
  coverImagePath: string;
  defaultTier: "free" | "pro" | "max";
  isStarter: boolean;
  lifecycleId: string | null;
  publishedAt: number | null;
  expiresAt: number | null;
  featured: boolean;
  tierOverride: "free" | "pro" | "max" | null;
  seasonOverride: string | null;
  tags: string[];
  notes: string | null;
  updatedAt: number | null;
  createdBy: string | null;
  status: PackLifecycleStatus;
  effectiveTier: "free" | "pro" | "max";
  counts: { categories: number; lists: number; sentences: number };
};

type Props = {
  initialPacks: PackRow[];
};

type StatusFilter = "all" | PackLifecycleStatus;
type TierFilter = "all" | "free" | "pro" | "max";
type FeaturedFilter = "all" | "featured" | "not_featured";

/** For each pack: union of its tags + legacy seasonOverride for filter coverage. */
function packTagSet(p: PackRow): Set<string> {
  const s = new Set(p.tags.map((t) => t.toLowerCase()));
  if (p.seasonOverride) s.add(p.seasonOverride.toLowerCase().trim());
  return s;
}

/**
 * Phase 7 admin Library CMS. Lists every pack in the JSON catalogue joined
 * with its packLifecycle row, with filters and per-row dropdown actions.
 *
 * Quick actions (single-mutation, no modal):
 *   - Publish now / Unpublish
 *   - Toggle featured
 * Multi-field actions (open modal):
 *   - Edit lifecycle… → EditPackLifecycleModal
 *   - Remove from library → ConfirmDeletePackLifecycleModal
 *
 * Subscribes via `useQuery(listAllPacksForAdmin)` so every mutation
 * reflects in the table without a page refresh.
 */
export function LibraryAdminTable({ initialPacks }: Props) {
  // Subscribe live; fall back to initialPacks until the first hydration.
  const livePacks = useQuery(api.resourcePacks.listAllPacksForAdmin);
  const packs = (livePacks ?? initialPacks) as PackRow[];

  const updateLifecycle = useMutation(api.resourcePacks.updatePackLifecycle);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");
  /** Multi-select. Empty array = no tag filter. Match is OR (any selected). */
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const [editTarget, setEditTarget] = useState<PackRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PackRow | null>(null);

  // Catalogue-wide tag union. Subscribed once at the table level; passed
  // into both the filter chip row and the edit modal so they share one
  // source of truth and update live when an admin adds a brand-new tag.
  const tagSuggestions = useQuery(api.resourcePacks.getAllTagsInUse) ?? [];

  const filtered = useMemo(() => {
    return packs.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (tierFilter !== "all" && p.effectiveTier !== tierFilter) return false;
      if (featuredFilter === "featured" && !p.featured) return false;
      if (featuredFilter === "not_featured" && p.featured) return false;
      if (activeTags.length > 0) {
        const ts = packTagSet(p);
        const hit = activeTags.some((t) => ts.has(t.toLowerCase()));
        if (!hit) return false;
      }
      return true;
    });
  }, [packs, statusFilter, tierFilter, featuredFilter, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((curr) =>
      curr.includes(tag) ? curr.filter((t) => t !== tag) : [...curr, tag]
    );
  }

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
          {filtered.length} of {packs.length}
        </div>

        {tagSuggestions.length > 0 && (
          <div className="w-full space-y-1">
            <label className="text-caption font-medium text-muted-foreground uppercase tracking-wider block">
              Tags{" "}
              <span className="normal-case font-normal text-muted-foreground/70">
                (click to filter — multi-select, any-match)
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tagSuggestions.map((tag) => {
                const isActive = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTags([])}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-caption text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-small">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium">Pack</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Tier</th>
              <th className="text-left p-4 font-medium hidden md:table-cell">Window</th>
              <th className="text-left p-4 font-medium hidden lg:table-cell">Updated</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr
                key={p.slug}
                className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
              >
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.name.en ?? p.slug}</p>
                    {p.isStarter && <Badge variant="outline">Starter</Badge>}
                    {p.featured && (
                      <Star className="w-4 h-4 text-warning fill-current" />
                    )}
                  </div>
                  <p className="text-caption text-muted-foreground font-mono">
                    {p.slug}
                  </p>
                  {(p.tags.length > 0 || p.seasonOverride) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-primary/10 text-primary text-caption px-2 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                      {p.tags.length === 0 && p.seasonOverride && (
                        <span
                          className="inline-flex items-center rounded-full bg-warning/10 text-warning text-caption px-2 py-0.5"
                          title="Legacy season value — will migrate to tags on next edit"
                        >
                          {p.seasonOverride} (legacy)
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <PackStatusBadge status={p.status} />
                </td>
                <td className="p-4">
                  <TierCell
                    effective={p.effectiveTier}
                    defaultTier={p.defaultTier}
                    overridden={p.tierOverride !== null}
                  />
                </td>
                <td className="p-4 hidden md:table-cell text-muted-foreground text-caption">
                  <WindowCell
                    publishedAt={p.publishedAt}
                    expiresAt={p.expiresAt}
                  />
                </td>
                <td className="p-4 hidden lg:table-cell text-muted-foreground text-caption">
                  {p.updatedAt ? formatDate(p.updatedAt) : "—"}
                </td>
                <td className="p-4 text-right">
                  <RowActions
                    pack={p}
                    busy={busySlug === p.slug}
                    onPublishNow={() =>
                      runQuickAction(p.slug, {
                        slug: p.slug,
                        publishedAt: Date.now(),
                      })
                    }
                    onUnpublish={() =>
                      runQuickAction(p.slug, {
                        slug: p.slug,
                        publishedAt: null,
                      })
                    }
                    onToggleFeatured={() =>
                      runQuickAction(p.slug, {
                        slug: p.slug,
                        featured: !p.featured,
                      })
                    }
                    onEdit={() => setEditTarget(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground text-small">
                  No packs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditPackLifecycleModal
          pack={editTarget}
          tagSuggestions={tagSuggestions}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeletePackLifecycleModal
          slug={deleteTarget.slug}
          packName={deleteTarget.name.en ?? deleteTarget.slug}
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
  pack,
  busy,
  onPublishNow,
  onUnpublish,
  onToggleFeatured,
  onEdit,
  onDelete,
}: {
  pack: PackRow;
  busy: boolean;
  onPublishNow: () => void;
  onUnpublish: () => void;
  onToggleFeatured: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPublished = pack.status === "live" || pack.status === "scheduled";

  // Radix DropdownMenu portals to <body>, so the menu escapes the table
  // wrapper's `overflow-hidden` (which clips abs-positioned children).
  // `collisionPadding` + the default flip behaviour also keeps the menu
  // on-screen for rows near the viewport edge — fixes the bottom-row
  // clipping that the hand-rolled `absolute right-0 mt-1` had.
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
            {pack.featured ? "Unfeature" : "Feature"}
          </MenuItem>
          <MenuItem onSelect={onEdit}>Edit lifecycle…</MenuItem>
          {pack.lifecycleId && (
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
