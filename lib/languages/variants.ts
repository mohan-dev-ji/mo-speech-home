/**
 * Per-language variant collapse (ADR-016 §1/§2).
 *
 * Composed content (sentences, phrases) can hold sibling per-language variants:
 * one logical item = N rows of the same shape, each tagged with its own
 * `authoredLanguage`, linked by a shared `variantGroupId` = the SOURCE row's
 * `_id`. A row with no `variantGroupId` (or `variantGroupId === _id`) is the
 * source / a singleton group.
 *
 * Resolution is client-side (the board `language` is client context — the same
 * reactive mechanism live text translation uses). `collapseVariants` reduces a
 * flat list of rows to one visible row per group: the sibling authored in the
 * board language if one exists, else the source (whose composition shows with a
 * "Made in <authoredLang>" badge). Group order follows the source's position.
 */

import { DEFAULT_LOCALE } from "./registry";
import { resolvedLocale } from "./displayValue";

export type VariantRow = {
  _id: string;
  variantGroupId?: string;
  authoredLanguage?: string;
};

/** The group key all siblings share: the source row's `_id`. */
export function variantGroupKey(row: VariantRow): string {
  return row.variantGroupId ?? row._id;
}

/**
 * A collapsed row is revertable iff it is a NON-SOURCE sibling variant — i.e. the
 * board is showing a real board-language version over a surviving origin. Hidden
 * on the origin board and on an untranslated fallback (both show the source).
 */
export function isRevertableVariant(row: { _id: string; variantGroupId?: string }): boolean {
  return row.variantGroupId != null && row.variantGroupId !== row._id;
}

/**
 * Whether a variant still needs translating for `boardLang` — i.e. its PRIMARY
 * localised field (fluent → `text`, phrase → `name`, else `name`) has no
 * board-language entry, so it would fall back to another language.
 *
 * This drives the "Made in <lang>" badge off actual translation STATE, not the
 * `authoredLanguage` tag: a manually-created but untranslated variant
 * (authoredLanguage = board, content still the source language) still reports
 * `true`, so the badge — and the way back to the translate modal — persists.
 * `undefined`/empty primary counts as needing translation.
 */
export function needsTranslation(
  primary: Record<string, string> | undefined,
  boardLang: string,
): boolean {
  if (!primary || Object.keys(primary).length === 0) return true;
  return resolvedLocale(primary, boardLang, DEFAULT_LOCALE) !== boardLang;
}

/**
 * Collapse sibling-variant rows to one visible row per group for `language`.
 * Pick order: the board-language variant → the source row → any sibling.
 * A legacy row with no `authoredLanguage` counts as DEFAULT_LOCALE.
 * Output order = first-seen order of each group in the input.
 */
/**
 * Reconcile a local drag-order (list of row ids) with the current collapsed set,
 * tracking the stable variant GROUP rather than the raw id. Authoring a variant
 * swaps a group's visible representative (source → new variant id), so a plain
 * "keep known ids, append new ids" would jump the item to the bottom. Instead:
 * map each prior id to its group's CURRENT representative (holding position), then
 * append only genuinely new groups. `allRows` (uncollapsed) resolves a now-hidden
 * source id back to its group; `collapsedRows` gives each group's current rep.
 */
export function reconcileVariantOrder(
  prev: readonly string[],
  allRows: readonly VariantRow[],
  collapsedRows: readonly VariantRow[],
): string[] {
  const groupOfId = new Map<string, string>();
  for (const r of allRows) groupOfId.set(r._id, variantGroupKey(r));
  const repByGroup = new Map<string, string>();
  for (const r of collapsedRows) repByGroup.set(variantGroupKey(r), r._id);

  const next: string[] = [];
  const placed = new Set<string>();
  for (const id of prev) {
    const g = groupOfId.get(id) ?? id;
    const rep = repByGroup.get(g);
    if (rep && !placed.has(g)) { next.push(rep); placed.add(g); }
  }
  for (const r of collapsedRows) {
    const g = variantGroupKey(r);
    if (!placed.has(g)) { next.push(r._id); placed.add(g); }
  }
  return next;
}

export function collapseVariants<T extends VariantRow>(
  rows: readonly T[],
  language: string,
): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const r of rows) {
    const key = variantGroupKey(r);
    const sibs = groups.get(key);
    if (sibs) {
      sibs.push(r);
    } else {
      groups.set(key, [r]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const sibs = groups.get(key)!;
    return (
      sibs.find((r) => (r.authoredLanguage ?? DEFAULT_LOCALE) === language) ??
      sibs.find((r) => r._id === key) ?? // the source row
      sibs[0]
    );
  });
}
