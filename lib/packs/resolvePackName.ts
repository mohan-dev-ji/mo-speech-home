/**
 * Client-safe helper for resolving a pack slug to its localised display name.
 *
 * The bundled `LIBRARY_PACKS` map is compile-time data (plain TS + JSON
 * imports) and safe to consume in `"use client"` components. Used by
 * row-level "From <Pack>" badges (LibrarySourceBadge) across category,
 * list, and sentence surfaces.
 *
 * Returns `undefined` when the slug isn't in the catalogue (e.g. a
 * brand-new pack whose JSON hasn't been published yet — the lifecycle
 * row exists but the JSON doesn't, so `LIBRARY_PACKS[slug]` is missing).
 * Callers should fall back to the raw slug or hide the badge.
 */
import { LIBRARY_PACKS } from "@/convex/data/library_packs/_index";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

export function resolvePackName(
  slug: string | undefined,
  language: string,
): string | undefined {
  if (!slug) return undefined;
  const pack = LIBRARY_PACKS[slug];
  if (!pack) return undefined;
  return displayString(pack.name, language, DEFAULT_LOCALE);
}
