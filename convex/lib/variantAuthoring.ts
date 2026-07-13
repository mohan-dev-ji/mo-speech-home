/**
 * Shared variant-authoring logic (ADR-016 §1/§3), factored out of the
 * near-identical `createSentenceVariant` / `createPhraseVariant` mutations.
 *
 * Pure by design: it computes the variant group id and finds an existing
 * same-language sibling from an already-collected list. Each mutation keeps its
 * own table-specific query (to collect siblings), the source-row group patch,
 * and the seed-insert — only this shared decision logic is centralised.
 */

/** The group key all siblings share: the source row's `_id`. */
export function variantGroupIdOf(source: { _id: string; variantGroupId?: string }): string {
  return source.variantGroupId ?? source._id;
}

/**
 * Given a source row and the account's rows for that table, return the variant
 * group id and any EXISTING variant authored in `authoredLanguage` (idempotency:
 * one variant per (group, language)). A row with no `authoredLanguage` counts as
 * "en". The caller patches the source's `variantGroupId` when absent and inserts
 * a new row only when `existing` is undefined.
 */
export function findVariantInGroup<
  T extends { _id: string; variantGroupId?: string; authoredLanguage?: string },
>(
  source: T,
  siblings: readonly T[],
  authoredLanguage: string,
): { groupId: string; existing: T | undefined } {
  const groupId = variantGroupIdOf(source);
  const existing = siblings.find(
    (s) =>
      (s.variantGroupId ?? s._id) === groupId &&
      (s.authoredLanguage ?? "en") === authoredLanguage,
  );
  return { groupId, existing };
}
