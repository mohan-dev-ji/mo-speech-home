/**
 * Git-export support (ADR-014 Task F). Dumps every `libraryModules` row to its
 * stable content shape so `scripts/export-library-modules.mjs` can write the
 * committed JSON artifact (audit trail + rollback), the same snapshot-to-git
 * discipline used for the symbols table.
 *
 * The artifact is a BACKUP / review copy, NOT the live source — the live source
 * is the table. Volatile fields (`_id`, timestamps, `createdBy`, publish window)
 * are omitted so committed diffs reflect real content/curation changes, not
 * churn. Ungated (same as `symbols:dumpSymbolsPage`); module content is the
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
      ...(m.isDefault ? { isDefault: true } : {}),
      ...(m.isStarter ? { isStarter: true } : {}),
      ...(m.provenance ? { provenance: m.provenance } : {}),
      items: m.items,
    }));
  },
});
