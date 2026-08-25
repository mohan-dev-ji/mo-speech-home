/**
 * Git-export support (ADR-014 Task F). Dumps every `libraryModules` row to its
 * stable content shape so `scripts/export-library-modules.mjs` can write the
 * committed JSON artifact (audit trail + rollback), the same snapshot-to-git
 * discipline used for the symbols table.
 *
 * The artifact is a BACKUP / review copy, NOT the live source — the live source
 * is the table. Volatile fields (`_id`, timestamps, `createdBy`, publish window) are omitted
 * so committed diffs reflect real content/curation changes, not churn.
 *
 * Deliberately NOT round-tripped, and why:
 *   - `provenance`  — no column on `libraryModules`; the legacy pack JSONs that
 *                     carry it all hold identical boilerplate. Per-symbol
 *                     `attribution`/`license`/`imageSourceUrl` ARE round-tripped,
 *                     and those are the ones that carry obligation.
 *   - `lastPublishedAt` / `publishedAt` / `createdBy` — volatile.
 *   - `tags` / `tierOverride` / `expiresAt` / `translationSnapshot` — unset on
 *     every live row; add here if that ever changes.
 *
 * NOTE: Convex's value encoding returns object fields key-sorted, so the
 * "fixed key order" below governs which keys are present, not their order on
 * disk. Compare artifacts structurally (scripts/verify-module-roundtrip.mjs),
 * never byte-wise.
 *
 * Ungated (same as `symbols:dumpSymbolsPage`); module content is the
 * public catalogue anyway, and `npx convex run` has no caller identity.
 */

import { query } from "../_generated/server";

export const dumpAllModules = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("libraryModules").collect();
    rows.sort(
      (a, b) => a.tree.localeCompare(b.tree) || a.slug.localeCompare(b.slug)
    );
    // Fixed key order → stable, reviewable git diffs.
    return rows.map((m) => ({
      slug: m.slug,
      tree: m.tree,
      name: m.name,
      ...(m.description ? { description: m.description } : {}),
      ...(m.icon ? { icon: m.icon } : {}),
      ...(m.colour ? { colour: m.colour } : {}),
      ...(m.coverImagePath ? { coverImagePath: m.coverImagePath } : {}),
      defaultTier: m.defaultTier,
      // ADR-015 §6/§7 — content-defining, not lifecycle: without it a restored
      // `core-*` module stops being a core-word module.
      ...(m.surface ? { surface: m.surface } : {}),
      ...(m.isDefault ? { isDefault: true } : {}),
      // Admin's arranged position — drives default-seed order (seedDefaultAccount),
      // so it must survive the git export/import round-trip.
      ...(m.defaultOrder !== undefined ? { defaultOrder: m.defaultOrder } : {}),
      // Curated-library featuring. Round-tripped (restored by
      // seedLibraryModulesFromJSON) so a wipe/restore keeps the shelf layout.
      ...(m.featured ? { featured: true } : {}),
      // Image credits travelling with the module (phase-31 §2). NOT carried by
      // `items` — it is its own column, so it needs carrying explicitly here and
      // in `migrations.seedLibraryModulesFromJSON` on the way back. Without both
      // hops, a wipe/restore silently strips the licence obligation off every
      // module. Omitted when empty so the 38 pre-phase-31 artifacts are unchanged.
      ...(m.credits?.length ? { credits: m.credits } : {}),
      items: m.items,
    }));
  },
});
