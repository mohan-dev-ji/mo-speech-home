/**
 * Plan the install of composed module items (ADR-016 §1) so a seeded account
 * reproduces the authoring account's variant groups. Buckets items by
 * `variantGroupKey` (absent → its own singleton group), assigns ONE shared
 * order slot per group, and picks the source (the collapse fallback) as the
 * `en` member, else the lowest-`order` member. Pure — no ctx; the caller does
 * the table-specific inserts and links siblings to the source's new _id.
 */
const DEFAULT_LOCALE = "en";

export type VariantPlanItem = {
  order: number;
  authoredLanguage?: string;
  variantGroupKey?: string;
};

export type PlannedVariantGroup<T> = {
  /** Shared list-order slot for the whole group. */
  order: number;
  /** Fallback row shown on boards without a matching-language variant. */
  source: T;
  /** Non-source siblings (empty for a singleton). */
  siblings: T[];
};

export function planVariantGroups<T extends VariantPlanItem>(
  items: readonly T[],
  startOrder: number,
): { groups: PlannedVariantGroup<T>[]; nextOrder: number } {
  const buckets = new Map<string, T[]>();
  let singletonSeq = 0;
  for (const item of items) {
    const key = item.variantGroupKey ?? `__singleton_${singletonSeq++}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const groups: PlannedVariantGroup<T>[] = [];
  let order = startOrder;
  for (const members of buckets.values()) {
    const sorted = [...members].sort((a, b) => a.order - b.order);
    const source =
      sorted.find(
        (m) => (m.authoredLanguage ?? DEFAULT_LOCALE) === DEFAULT_LOCALE,
      ) ?? sorted[0];
    groups.push({
      order: order++,
      source,
      siblings: sorted.filter((m) => m !== source),
    });
  }
  return { groups, nextOrder: order };
}
