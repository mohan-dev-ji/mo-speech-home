/**
 * "Which images does this account's content actually reference, and what does
 * each placement still remember about where it came from?" (phase-31 Task 3).
 *
 * ONE set of per-table extractors, TWO consumers, so their field coverage can
 * never drift apart:
 *
 *   `planAccountImageCredits`            — the backfill: lift phase-30's
 *                                          per-placement credit into the
 *                                          per-account `imageCredits` registry.
 *   `checkAccountImageCreditCompleteness` — the standing self-check: "is there
 *                                          an image in use whose credit we
 *                                          lost?"
 *
 * PAGINATION (review fix, phase-31 Task 3 pass 2) — this file used to also
 * export `collectAccountImageRefs`, a single function that ran `.collect()`
 * on all six tables (index-scoped to one account) inside one query. Convex
 * caps a single query/mutation EXECUTION at 16,384 documents / 8 MiB read,
 * cumulative across every `ctx.db` call made during that execution — so that
 * one function could trip the ceiling once a single account's own content
 * grew large enough (1,057 `profileSymbols` for the biggest account today).
 * The per-table extractors below are now called from PAGINATED
 * `internalQuery`s in `imageCreditsBackfill.ts`, each bounded to one page of
 * one table, driven by an `internalAction` that loops `ctx.runQuery` — the
 * same "paginate + caller loops" shape `migrations.ts` already uses for
 * `backfillSearchTextPage` / `backfillSearchText`. Each `ctx.runQuery` call is
 * its own bounded transaction, so the account-level total is never read in one
 * execution no matter how large a single account's content gets.
 *
 * This is deliberately NOT `collectReferencedPersonalKeys` /
 * `collectSourcePromotableKeys` in ./personalAssetRefs. Those answer "which R2
 * keys does this row hold" and return bare strings — enough to decide what to
 * delete or copy, but not enough to decide what to CREDIT, which needs the
 * provenance fields sitting next to the key and the English label that becomes
 * `firstUsedFor`. Audio keys are also deliberately absent here: the registry is
 * images only.
 *
 * DELIBERATELY OUT OF SCOPE — named so a reader can tell an exclusion from an
 * oversight:
 *   - `studentProfiles.profilePhoto` — a photo of the student, taken by the
 *     instructor. An upload by definition, never third-party, and not board
 *     content. Including it would put a private photo in every completeness
 *     report for no possible credit.
 *   - `aiImageCache` — a cache, not provenance (phase-31 plan, "What gets
 *     recorded, and why"). Phase 30 built a sweep that deletes from it.
 *   - every audio field — the registry has no audio member.
 */

import type { Doc } from "../_generated/dataModel";

/**
 * The image-source vocabulary as it is spelled ON A PLACEMENT — wider than the
 * registry's, which has only the two recordable members.
 *
 * `profileSymbols.imageSource.type` says `userUpload` while every other table's
 * `imageSourceType` says `upload` for the same thing; the walk normalises both
 * to `upload` so callers classify once.
 */
export type PlacementSourceType =
  | "symbolstix"
  | "upload"
  | "imageSearch"
  | "aiGenerated";

/** One image placement, with whatever provenance the row still carries. */
export type ImageRef = {
  /** The R2 object key. THE join key against `imageCredits.imageKey`. */
  imageKey: string;
  /** Absent when the row records no type at all — covers and talker-built
   * slots are the two real cases. That absence is what the completeness
   * check's "unknown, review manually" bucket is made of. */
  sourceType?: PlacementSourceType;
  attribution?: string;
  license?: string;
  imageSourceUrl?: string;
  /** English label of the thing the image is on — becomes `firstUsedFor`,
   * matching what `SymbolEditorModal` records on a live save. */
  label?: string;
  /** Which table/field this came from, for the completeness report. */
  foundIn: string;
};

/** English text out of a `localisedString`, a legacy bare string, or nothing. */
function enText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object") {
    const en = (value as Record<string, unknown>).en;
    if (typeof en === "string") return en.trim() || undefined;
  }
  return undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Normalise the two spellings of "the instructor uploaded this". */
function normaliseType(value: unknown): PlacementSourceType | undefined {
  switch (value) {
    case "symbolstix":
      return "symbolstix";
    case "upload":
    case "userUpload":
      return "upload";
    case "imageSearch":
      return "imageSearch";
    case "aiGenerated":
      return "aiGenerated";
    default:
      return undefined;
  }
}

/**
 * Push one placement that carries `imageProvenanceFields` (list items, sentence
 * slots and units, phrase words, and every module-artifact item shape). This is
 * the single place that knows which field names hold provenance, so adding a
 * field is a one-line change here rather than a hunt.
 */
function pushProvenanceItem(
  out: ImageRef[],
  item: Record<string, unknown> | undefined | null,
  foundIn: string,
  labelValue?: unknown,
): void {
  if (!item) return;
  const imageKey = str(item.imagePath);
  if (!imageKey) return;
  const ref: ImageRef = { imageKey, foundIn };
  const sourceType = normaliseType(item.imageSourceType);
  if (sourceType) ref.sourceType = sourceType;
  const attribution = str(item.attribution);
  if (attribution) ref.attribution = attribution;
  const license = str(item.license);
  if (license) ref.license = license;
  const imageSourceUrl = str(item.imageSourceUrl);
  if (imageSourceUrl) ref.imageSourceUrl = imageSourceUrl;
  const label = enText(labelValue ?? item.label);
  if (label) ref.label = label;
  out.push(ref);
}

// ─── Per-table extractors ────────────────────────────────────────────────────

/**
 * `profileSymbols.imageSource` is a discriminated union rather than the flat
 * `imageProvenanceFields` shape, so it gets its own extractor.
 *
 * `aiPrompt` on the `aiGenerated` member is NOT carried anywhere: the registry
 * has no field for it, it is never removed from the symbol row, and putting it
 * in `firstUsedFor` would make backfilled rows read differently from the ones
 * `SymbolEditorModal` writes live (which put the English label there).
 *
 * Exported (not module-private) so the paginated per-page queries in
 * `imageCreditsBackfill.ts` can call it per-row without re-implementing the
 * extraction logic — see the PAGINATION note above.
 */
export function symbolRefs(symbol: Doc<"profileSymbols">): ImageRef[] {
  const src = symbol.imageSource as {
    type?: string;
    imagePath?: string;
    imageSourceUrl?: string;
    attribution?: string;
    license?: string;
  };
  const imageKey = str(src?.imagePath);
  if (!imageKey) return []; // symbolstix (symbolId only) and placeholder
  const ref: ImageRef = { imageKey, foundIn: "profileSymbols.imageSource" };
  const sourceType = normaliseType(src.type);
  if (sourceType) ref.sourceType = sourceType;
  const attribution = str(src.attribution);
  if (attribution) ref.attribution = attribution;
  const license = str(src.license);
  if (license) ref.license = license;
  const imageSourceUrl = str(src.imageSourceUrl);
  if (imageSourceUrl) ref.imageSourceUrl = imageSourceUrl;
  const label = enText(symbol.label);
  if (label) ref.label = label;
  return [ref];
}

export function listRefs(list: Doc<"profileLists">): ImageRef[] {
  const out: ImageRef[] = [];
  for (const item of list.items ?? []) {
    pushProvenanceItem(
      out,
      item as unknown as Record<string, unknown>,
      "profileLists.items",
      (item as { description?: unknown }).description,
    );
  }
  return out;
}

/**
 * Sentences hold images in TWO places, not one. `slots[]` is the shape the
 * Task 3 brief named; `units[]` (ADR-015 compositions — a `word` unit, or a
 * `phrase` unit's own `words[]`) carries `imageProvenanceFields` too
 * (`compositionWord` / `compositionUnit` in schema.ts) and is what the talker
 * writes. Walking only `slots[]` would silently miss every composition-built
 * sentence.
 */
export function sentenceRefs(sentence: Doc<"profileSentences">): ImageRef[] {
  const out: ImageRef[] = [];
  for (const slot of sentence.slots ?? []) {
    pushProvenanceItem(
      out,
      slot as unknown as Record<string, unknown>,
      "profileSentences.slots",
    );
  }
  for (const unit of (sentence.units ?? []) as Array<Record<string, unknown>>) {
    pushProvenanceItem(out, unit, "profileSentences.units");
    for (const word of (unit?.words ?? []) as Array<Record<string, unknown>>) {
      pushProvenanceItem(out, word, "profileSentences.units[].words");
    }
  }
  return out;
}

export function phraseRefs(phrase: Doc<"profilePhrases">): ImageRef[] {
  const out: ImageRef[] = [];
  for (const word of (phrase.words ?? []) as Array<Record<string, unknown>>) {
    pushProvenanceItem(out, word, "profilePhrases.words");
  }
  return out;
}

/** Category and folder COVER images. These carry a key and nothing else — no
 * `imageSourceType` field exists on either table — which is precisely why the
 * completeness check needs an "unknown, review manually" bucket (MOS-35). */
export function coverRef(
  row: { imagePath?: string; name?: unknown },
  foundIn: string,
): ImageRef[] {
  const imageKey = str(row.imagePath);
  if (!imageKey) return [];
  const ref: ImageRef = { imageKey, foundIn };
  const label = enText(row.name);
  if (label) ref.label = label;
  return [ref];
}

/** How many rows the walk actually read, per table — printed by the script so
 * the run can be reconciled against the table totals and prove no rows were
 * missed (e.g. a legacy row with no `accountId`, which no index reaches). */
export type WalkedRowCounts = {
  profileSymbols: number;
  profileLists: number;
  profileSentences: number;
  profilePhrases: number;
  profileCategories: number;
  profileFolders: number;
};

/**
 * Every image placement in ONE published module artifact.
 *
 * `libraryModules.items` is a four-member union and every member holds its
 * images somewhere different — categories in `symbols[]`, lists in `items[]`,
 * sentences in `slots[]` + `units[]`, phrases in `words[]`. The Task 3 brief
 * named only the category branch; all four carry `imageProvenanceFields` (see
 * `libraryModuleListItems` / `libraryModuleSentenceItems` /
 * `libraryModulePhraseItems` in schema.ts), so all four are walked.
 *
 * Keys here are already the PROMOTED `library_modules/…` keys — the same keys
 * an installed row holds — so nothing needs remapping, unlike
 * `collectModuleCredits`, which starts from the admin's source keys.
 */
export function collectModuleImageRefs(mod: Doc<"libraryModules">): ImageRef[] {
  const out: ImageRef[] = [];
  const items = (mod.items ?? []) as Array<Record<string, unknown>>;

  for (const entry of items) {
    const entryName = entry?.name;

    // Category / folder cover on the artifact entry itself — no type field.
    const cover = str(entry?.imagePath);
    if (cover) {
      const ref: ImageRef = { imageKey: cover, foundIn: "libraryModules.items[].imagePath" };
      const label = enText(entryName);
      if (label) ref.label = label;
      out.push(ref);
    }

    for (const symbol of (entry?.symbols ?? []) as Array<Record<string, unknown>>) {
      pushProvenanceItem(
        out,
        symbol,
        "libraryModules.items[].symbols",
        symbol?.labelOverride ?? symbol?.label,
      );
    }
    for (const item of (entry?.items ?? []) as Array<Record<string, unknown>>) {
      pushProvenanceItem(out, item, "libraryModules.items[].items", item?.description);
    }
    for (const slot of (entry?.slots ?? []) as Array<Record<string, unknown>>) {
      pushProvenanceItem(out, slot, "libraryModules.items[].slots");
    }
    for (const unit of (entry?.units ?? []) as Array<Record<string, unknown>>) {
      pushProvenanceItem(out, unit, "libraryModules.items[].units");
      for (const word of (unit?.words ?? []) as Array<Record<string, unknown>>) {
        pushProvenanceItem(out, word, "libraryModules.items[].units[].words");
      }
    }
    for (const word of (entry?.words ?? []) as Array<Record<string, unknown>>) {
      pushProvenanceItem(out, word, "libraryModules.items[].words");
    }
  }

  // The module's own cover tile.
  const moduleCover = str(mod.coverImagePath);
  if (moduleCover) {
    const ref: ImageRef = { imageKey: moduleCover, foundIn: "libraryModules.coverImagePath" };
    const label = enText(mod.name);
    if (label) ref.label = label;
    out.push(ref);
  }

  return out;
}
