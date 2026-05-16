/**
 * Library pack readers — the canonical access point for pack content.
 *
 * All reads of pack content (catalogue listing, pack load, starter seed)
 * go through these helpers. They consume the bundled JSON map in
 * `convex/data/library_packs/_index.ts`; no Convex DB reads. Per ADR-010,
 * JSON is the source of truth for pack content.
 *
 * Use these wherever the old code reached for the `resourcePacks` table.
 */

import { LIBRARY_PACKS, type LibraryPack } from "../data/library_packs/_index";

/**
 * Look up a pack by slug. Returns `null` if no JSON file exists for the slug.
 *
 * Callers should also check `packLifecycle` separately to confirm visibility
 * (publishedAt / expiresAt window). A pack with a JSON file but no lifecycle
 * row is treated as "unpublished" by the catalogue.
 */
export function getLibraryPackBySlug(slug: string): LibraryPack | null {
  return LIBRARY_PACKS[slug] ?? null;
}

/**
 * Every slug in the catalogue, in stable alphabetical order. Use this when
 * merging with `packLifecycle` rows to assemble the public catalogue.
 */
export function getAllLibraryPackSlugs(): string[] {
  return Object.keys(LIBRARY_PACKS).sort();
}

/**
 * Every pack in the catalogue. Order matches `getAllLibraryPackSlugs`.
 */
export function getAllLibraryPacks(): LibraryPack[] {
  return getAllLibraryPackSlugs().map((slug) => LIBRARY_PACKS[slug]);
}

/**
 * The canonical starter pack (the single entry with `isStarter: true`), or
 * `null` if no starter pack is present in the catalogue. Used by
 * `loadStarterTemplate` during `seedDefaultAccount`.
 *
 * Invariant: at most one pack should have `isStarter: true` at any time.
 * If multiple are marked, the first by alphabetical slug wins — this is a
 * defensive choice; the migration / authoring tooling should keep the
 * invariant true at write time.
 */
export function getStarterLibraryPack(): LibraryPack | null {
  for (const slug of getAllLibraryPackSlugs()) {
    const pack = LIBRARY_PACKS[slug];
    if (pack.isStarter) return pack;
  }
  return null;
}
