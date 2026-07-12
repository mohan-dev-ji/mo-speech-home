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
 * Collapse sibling-variant rows to one visible row per group for `language`.
 * Pick order: the board-language variant → the source row → any sibling.
 * A legacy row with no `authoredLanguage` counts as DEFAULT_LOCALE.
 * Output order = first-seen order of each group in the input.
 */
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
