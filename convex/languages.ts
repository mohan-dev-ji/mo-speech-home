import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireCallerIsAdmin } from "./lib/account";
import { LANGUAGE_MODULES } from "./data/languages/_index";

/**
 * Phase 8.1 admin Languages section + visibility helper. Mirrors the
 * Phase 7 Library admin layer (`resourcePacks.ts` §2300+):
 *
 *   - `listAllLanguagesForAdmin` — registry ⨝ `languageLifecycle`, every
 *     known language regardless of publish window. Powers
 *     `/admin/languages`.
 *   - `updateLanguageLifecycle` — single consolidated patch mutation,
 *     insert-on-write so admins can publish a draft language in one click.
 *   - `deleteLanguageLifecycle` — removes the row, returning the language
 *     to draft state. JSON module in `convex/data/languages/` is NOT
 *     touched — language disappears from pickers but stays in the repo.
 *   - `getVisibleLanguages` — picker-side filter. Returns languages with a
 *     live publish window AND a status that matches the caller's filter
 *     (`includeBeta` / `includeMachine`). The locale switcher, settings
 *     profile language picker, and talker dropdown all share this query.
 *
 * Per ADR-009 §3 / ADR-011 §3. Status (`machine-translated` | `beta` |
 * `stable`) lives on the lifecycle row, not the JSON — admins promote a
 * language through the stages without a code deploy.
 */

const STATUS_VALIDATOR = v.union(
  v.literal("machine-translated"),
  v.literal("beta"),
  v.literal("stable")
);

const TIER_VALIDATOR = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("max")
);

type LangLifecycleStatus = "draft" | "scheduled" | "live" | "expired";

/**
 * Derive the table's "publish status" column. This is the lifecycle's
 * publish-window position — independent of the language's translation
 * status (`machine-translated` | `beta` | `stable`), which lives on
 * `lifecycle.status` and is surfaced separately in the admin UI.
 */
function derivePublishStatus(
  lifecycle: Doc<"languageLifecycle"> | null,
  now: number
): LangLifecycleStatus {
  if (!lifecycle || lifecycle.publishedAt == null) return "draft";
  if (lifecycle.publishedAt > now) return "scheduled";
  if (lifecycle.expiresAt != null && lifecycle.expiresAt <= now) return "expired";
  return "live";
}

/**
 * Admin dashboard list. Returns EVERY language from the bundled JSON
 * catalogue joined with its `languageLifecycle` row (when present),
 * regardless of publish window — drafts and expired languages are
 * deliberately included so admins can promote them in-place.
 *
 * Sorted alphabetically by code for stable rendering.
 */
export const listAllLanguagesForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireCallerIsAdmin(ctx);
    const lifecycleRows = await ctx.db.query("languageLifecycle").collect();
    const lifecycleBySlug = new Map(lifecycleRows.map((r) => [r.slug, r]));
    const now = Date.now();
    return LANGUAGE_MODULES.map((mod) => {
      const lifecycle = lifecycleBySlug.get(mod.code) ?? null;
      return {
        // Registry fields (static)
        code: mod.code,
        label: mod.label,
        nativeLabel: mod.nativeLabel,
        dir: mod.dir,
        font: mod.font,
        voiceCount: mod.voices.length,
        // Lifecycle overlay — null when no row exists (draft)
        lifecycleId: lifecycle?._id ?? null,
        publishedAt: lifecycle?.publishedAt ?? null,
        expiresAt: lifecycle?.expiresAt ?? null,
        tierOverride: lifecycle?.tierOverride ?? null,
        notes: lifecycle?.notes ?? null,
        updatedAt: lifecycle?.updatedAt ?? null,
        createdBy: lifecycle?.createdBy ?? null,
        // Translation status — defaults to machine-translated for languages
        // without a lifecycle row (admin promotes after running pipelines).
        translationStatus: lifecycle?.status ?? "machine-translated",
        // Derived for the UI
        publishStatus: derivePublishStatus(lifecycle, now),
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  },
});

/**
 * Update a `languageLifecycle` row in place — single consolidated mutation
 * for every dashboard lifecycle action. Fields are optional; pass `null`
 * to clear a field, omit to leave it alone. If no row exists for the slug
 * yet, a new one is inserted (the slug is "promoted" from draft on first
 * write).
 *
 * Mirrors `updatePackLifecycle` exactly — same tri-state semantics, same
 * insert-on-write behaviour.
 */
export const updateLanguageLifecycle = mutation({
  args: {
    slug: v.string(),
    publishedAt: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
    status: v.optional(STATUS_VALIDATOR),
    tierOverride: v.optional(v.union(TIER_VALIDATOR, v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { clerkUserId } = await requireCallerIsAdmin(ctx);

    // Refuse writes to slugs that aren't in the bundled registry.
    const mod = LANGUAGE_MODULES.find((m) => m.code === args.slug);
    if (!mod) {
      throw new ConvexError({
        code: "LANGUAGE_NOT_FOUND",
        message: `No language module found for code "${args.slug}". Add the JSON via /api/admin/language-publish first.`,
      });
    }

    const existing = await ctx.db
      .query("languageLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    const now = Date.now();

    // Convert tri-state inputs (undefined / null / value) into a patch.
    // `undefined` = leave alone; `null` = clear; value = set.
    const patch: Partial<Doc<"languageLifecycle">> & { updatedAt: number } = {
      updatedAt: now,
    };
    if (args.publishedAt !== undefined) patch.publishedAt = args.publishedAt ?? undefined;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt ?? undefined;
    if (args.status !== undefined) patch.status = args.status;
    if (args.tierOverride !== undefined) patch.tierOverride = args.tierOverride ?? undefined;
    if (args.notes !== undefined) patch.notes = args.notes ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { slug: args.slug, lifecycleId: existing._id };
    }

    const lifecycleId = await ctx.db.insert("languageLifecycle", {
      slug: args.slug,
      // Status is required on the row — default to machine-translated for
      // newly-promoted-from-draft languages.
      status: patch.status ?? "machine-translated",
      createdBy: clerkUserId,
      updatedAt: now,
      ...(patch.publishedAt !== undefined && { publishedAt: patch.publishedAt }),
      ...(patch.expiresAt !== undefined && { expiresAt: patch.expiresAt }),
      ...(patch.tierOverride !== undefined && { tierOverride: patch.tierOverride }),
      ...(patch.notes !== undefined && { notes: patch.notes }),
    });
    return { slug: args.slug, lifecycleId };
  },
});

/**
 * Delete a `languageLifecycle` row, returning the slug to draft state.
 * The JSON module in `convex/data/languages/` is NOT touched — the
 * language disappears from `/admin/languages` lifecycle column and from
 * pickers (no longer "live"), but its module stays in the repo and can be
 * republished by inserting a fresh lifecycle row.
 *
 * Mirrors `deletePackLifecycle`. No-op when no row exists.
 */
export const deleteLanguageLifecycle = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireCallerIsAdmin(ctx);
    const row = await ctx.db
      .query("languageLifecycle")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (row) {
      await ctx.db.delete(row._id);
    }
    return { slug };
  },
});

/**
 * Picker-side visibility query. Returns languages that are:
 *   - in the bundled registry (`LANGUAGE_MODULES`),
 *   - have a `languageLifecycle` row with a live publish window
 *     (`publishedAt <= now` AND `expiresAt` unset or in the future),
 *   - AND have a `status` that matches the caller's filter.
 *
 * Always includes `stable` languages. `beta` and `machine-translated`
 * gate on the optional flags — the locale switcher passes `includeBeta:
 * true` in production; the admin preview view passes both true for full
 * visibility.
 *
 * Public (no admin guard) — every picker in the app calls this.
 */
export const getVisibleLanguages = query({
  args: {
    includeBeta: v.optional(v.boolean()),
    includeMachine: v.optional(v.boolean()),
  },
  handler: async (ctx, { includeBeta = false, includeMachine = false }) => {
    const lifecycleRows = await ctx.db.query("languageLifecycle").collect();
    const lifecycleBySlug = new Map(lifecycleRows.map((r) => [r.slug, r]));
    const now = Date.now();

    return LANGUAGE_MODULES.map((mod) => {
      const lifecycle = lifecycleBySlug.get(mod.code);
      // Window: must have a row AND publishedAt <= now AND
      // (expiresAt unset OR expiresAt > now). Drafts and scheduled
      // languages are hidden from pickers.
      const live =
        !!lifecycle &&
        lifecycle.publishedAt !== undefined &&
        lifecycle.publishedAt <= now &&
        (lifecycle.expiresAt === undefined || lifecycle.expiresAt > now);
      if (!live) return null;
      const status = lifecycle!.status;
      if (status === "beta" && !includeBeta) return null;
      if (status === "machine-translated" && !includeMachine) return null;
      return {
        code: mod.code,
        label: mod.label,
        nativeLabel: mod.nativeLabel,
        dir: mod.dir,
        status,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  },
});
