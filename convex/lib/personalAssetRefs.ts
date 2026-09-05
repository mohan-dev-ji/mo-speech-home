import { v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import {
  isPersonalAssetKey,
  isPersonalAudioKey,
  isPromotableAssetKey,
  isCreditableAssetKey,
} from "./contentModuleDelete";
import {
  symbolRefs,
  listRefs,
  sentenceRefs,
  phraseRefs,
  coverRef,
  type ImageRef,
} from "./imageCreditRefs";

/**
 * Which keys an extractor keeps. Four — and only four — values are ever
 * passed, each answering a different question about the same key:
 *
 *   `isPersonalAudioKey`   → "may deleting a PLACEMENT remove this object from
 *                            R2?" (personal keys under an `/audio/` segment).
 *                            The narrowest, and the only one the
 *                            delete-CANDIDATE walk may use — since phase 36 an
 *                            image is never a delete candidate, because it has
 *                            a home (My Images) that owns the one Delete which
 *                            removes it.
 *   `isPersonalAssetKey`   → "is this object OWNED by exactly one account?"
 *                            (`accounts/` | `profiles/` only). The
 *                            REFERENCED walk uses this and MUST keep seeing
 *                            image keys — `collectReferencedPersonalKeys` and
 *                            `countRowsReferencingKeys` answer "is anything
 *                            still using this?", which is what stops the My
 *                            Images gallery deleting an image a symbol needs.
 *   `isPromotableAssetKey` → "must PUBLISH copy this into the module's own
 *                            prefix?" (personal + legacy `library_packs/`).
 *   `isCreditableAssetKey` → "does this key carry a licence credit?"
 *                            (promotable + `library_modules/`). Widest of the
 *                            four: an already-shared `library_modules/`
 *                            object needs no copy but still needs crediting,
 *                            which is why this cannot reuse the publish set.
 *
 * Widest ≠ interchangeable. Handing the credit predicate to the promotion path
 * would copy objects that are already shared; handing it to the delete path
 * would let one account delete another's assets; handing the OWNERSHIP
 * predicate to the delete-candidate path would start hard-deleting images
 * again. See the doc blocks on `isPersonalAudioKey` and `isPromotableAssetKey`
 * in `contentModuleDelete.ts`.
 *
 * The predicate is an explicit parameter rather than a hard-coded call so the
 * delete path physically cannot inherit a wider rule. See the
 * "PROMOTABLE ≠ PERSONAL" docblock in ./contentModuleDelete.
 */
type KeyFilter = (k: string | undefined | null) => k is string;

/**
 * Push `k` onto `out` iff `keep` accepts it. Shared by every per-table
 * extractor below so the "which fields can hold a key" rule and the "which
 * keys count" rule stay in exactly one place each.
 */
function push(out: string[], k: unknown, keep: KeyFilter): void {
  if (typeof k === "string" && keep(k)) out.push(k);
}

// ─── Per-table key extractors ───────────────────────────────────────────────
// Each returns every R2 key a single row holds that `keep` accepts. These are
// the sole source of truth for "what fields can hold an asset key" —
// `collectReferencedPersonalKeys` (union over surviving rows),
// `countRowsReferencingKeys` (count of rows touching a target set) and
// `collectSourcePromotableKeys` (forward scan of one publish source) all walk
// the same tables via these same functions, so their field coverage can never
// drift apart. Only the `keep` predicate differs between the four questions —
// delete-candidate, still-referenced, promotable and creditable.

function symbolKeys(s: Doc<"profileSymbols">, keep: KeyFilter): string[] {
  const out: string[] = [];
  const src = s.imageSource as { type?: string; imagePath?: string } | undefined;
  push(out, src?.imagePath, keep);
  const audioMap = (s.audio as Record<string, { path?: string; alternates?: { recorded?: string } } | undefined>) ?? {};
  for (const a of Object.values(audioMap)) { if (!a) continue; push(out, a.path, keep); push(out, a.alternates?.recorded, keep); }
  return out;
}

function sentenceKeys(s: Doc<"profileSentences">, keep: KeyFilter): string[] {
  const out: string[] = [];
  for (const slot of s.slots ?? []) push(out, slot?.imagePath, keep);
  push(out, s.recordedAudioPath, keep); push(out, s.audioPath, keep);
  for (const u of (s.units ?? []) as Array<Record<string, unknown>>) {
    push(out, u?.imagePath, keep); push(out, u?.audioPath, keep); push(out, u?.recordedAudioPath, keep);
    for (const w of ((u?.words ?? []) as Array<Record<string, unknown>>)) { push(out, w?.imagePath, keep); push(out, w?.audioPath, keep); }
  }
  return out;
}

function phraseKeys(p: Doc<"profilePhrases">, keep: KeyFilter): string[] {
  const out: string[] = [];
  push(out, p.recordedAudioPath, keep); push(out, p.audioPath, keep);
  for (const w of ((p.words ?? []) as Array<Record<string, unknown>>)) { push(out, w?.imagePath, keep); push(out, w?.audioPath, keep); }
  return out;
}

function listKeys(l: Doc<"profileLists">, keep: KeyFilter): string[] {
  const out: string[] = [];
  for (const it of l.items ?? []) {
    push(out, it?.imagePath, keep); push(out, it?.audioPath, keep); push(out, it?.recordedAudioPath, keep); push(out, it?.generatedAudioPath, keep);
  }
  return out;
}

function categoryKeys(c: Doc<"profileCategories">, keep: KeyFilter): string[] {
  const out: string[] = [];
  push(out, c.imagePath, keep);
  return out;
}

function folderKeys(f: Doc<"profileFolders">, keep: KeyFilter): string[] {
  const out: string[] = [];
  push(out, f.imagePath, keep);
  return out;
}

/**
 * The student's profile photo. Added phase 33 (MOS-41) to close a gap between
 * this file's claim and its behaviour: `collectReferencedPersonalKeys` below
 * documented itself as scanning "every table and every field that can hold a
 * personal key" while walking six tables and missing this one.
 *
 * Deliberately absent from the CREDIT walk (`imageCreditRefs.ts`) for a
 * different and still-valid reason — a photo of the student, taken by the
 * instructor, is an upload by definition and belongs in no credits screen.
 * "Carries no licence obligation" and "is not an asset we may delete" are
 * different questions; only the first was answered before.
 */
function studentProfileKeys(p: Doc<"studentProfiles">, keep: KeyFilter): string[] {
  const out: string[] = [];
  push(out, p.profilePhoto, keep);
  return out;
}

type ExcludeIds = {
  sentenceIds?: ReadonlySet<string>;
  phraseIds?: ReadonlySet<string>;
  listIds?: ReadonlySet<string>;
  symbolIds?: ReadonlySet<string>;
  categoryIds?: ReadonlySet<string>;
  folderIds?: ReadonlySet<string>;
  profileIds?: ReadonlySet<string>;
};

/**
 * Every personal (`accounts/` | `profiles/`) R2 key still referenced by this
 * account's SURVIVING content, excluding the rows being deleted.
 *
 * Deliberately OVER-inclusive: missing a reference deletes a live asset, while
 * an extra reference only leaves a harmless orphan. So we scan every table and
 * every field that can hold a personal key.
 *
 * Why: one R2 object can be referenced by BOTH a category symbol
 * (`profileSymbols.imageSource.imagePath`) and every composition slot that
 * reuses it (the slot copies the same key string). Deleting the composition
 * must not delete the category's image. Category/folder cover images are
 * scanned too — a cover key could in principle be shared with a symbol/slot.
 */
export async function collectReferencedPersonalKeys(
  ctx: QueryCtx,
  accountId: Id<"users">,
  exclude: ExcludeIds = {},
): Promise<Set<string>> {
  const refs = new Set<string>();

  const symbols = await ctx.db
    .query("profileSymbols")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of symbols) {
    if (exclude.symbolIds?.has(String(s._id))) continue;
    for (const k of symbolKeys(s, isPersonalAssetKey)) refs.add(k);
  }

  const sentences = await ctx.db
    .query("profileSentences")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of sentences) {
    if (exclude.sentenceIds?.has(String(s._id))) continue;
    for (const k of sentenceKeys(s, isPersonalAssetKey)) refs.add(k);
  }

  const phrases = await ctx.db
    .query("profilePhrases")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of phrases) {
    if (exclude.phraseIds?.has(String(p._id))) continue;
    for (const k of phraseKeys(p, isPersonalAssetKey)) refs.add(k);
  }

  const lists = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const l of lists) {
    if (exclude.listIds?.has(String(l._id))) continue;
    for (const k of listKeys(l, isPersonalAssetKey)) refs.add(k);
  }

  const categories = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const c of categories) {
    if (exclude.categoryIds?.has(String(c._id))) continue;
    for (const k of categoryKeys(c, isPersonalAssetKey)) refs.add(k);
  }

  const folders = await ctx.db
    .query("profileFolders")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const f of folders) {
    if (exclude.folderIds?.has(String(f._id))) continue;
    for (const k of folderKeys(f, isPersonalAssetKey)) refs.add(k);
  }

  // Seventh table, added phase 33 — see `studentProfileKeys`. Adding a table
  // to this walk can only make the result MORE conservative (more keys counted
  // as referenced → fewer deletions), so it cannot cause a wrongful delete.
  const profiles = await ctx.db
    .query("studentProfiles")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of profiles) {
    if (exclude.profileIds?.has(String(p._id))) continue;
    for (const k of studentProfileKeys(p, isPersonalAssetKey)) refs.add(k);
  }

  return refs;
}

// ─── Delete-orphan collection (phase 33 / MOS-41) ───────────────────────────
//
// ONE function answers "which R2 objects does deleting this leave behind with
// nothing pointing at them?" for every user-content delete surface, because
// the bug this replaces was four surfaces answering it differently — three of
// them by not asking at all (`CategoriesContent`, `GroupsView`,
// `ListsModeContent` and `StudentProfilesPanel` all called a mutation
// directly, and only an API route can delete from R2).
//
// The owner's model, settled 2026-08-29: a delete permanently removes the
// user's own assets under `accounts/` and `profiles/`, and NEVER touches
// `library_modules/`. Amended phase 36: of those own assets, only voice
// RECORDINGS are removed. An image is never a delete candidate — it has a home
// (My Images) whose Delete button is the one hard delete for images in the
// product, so a placement delete leaves the object alone. Cost of recreation,
// not media type; see `isPersonalAudioKey` in ./contentModuleDelete.
//
// Nothing here widens a predicate: the candidate walk NARROWED from
// `isPersonalAssetKey` to `isPersonalAudioKey`, and the referenced walk below
// is unchanged.

/** What is being deleted. One member per client delete surface; adding a
 * surface means adding a member here, which is the point — the delete surface
 * is enumerable in one place instead of scattered across four components. */
export const deleteTargetValidator = v.union(
  v.object({ kind: v.literal("category"), categoryId: v.id("profileCategories") }),
  v.object({ kind: v.literal("folder"), folderId: v.id("profileFolders") }),
  v.object({ kind: v.literal("list"), listId: v.id("profileLists") }),
  v.object({ kind: v.literal("studentProfile"), profileId: v.id("studentProfiles") }),
);

export type DeleteTarget = Infer<typeof deleteTargetValidator>;

/**
 * R2 keys that deleting `target` would orphan AND that a placement delete is
 * allowed to remove: personal voice recordings only.
 *
 * IMAGES ARE NOT CANDIDATES (phase 36). Category and folder COVER images are
 * images too, so deleting a category or a group leaves its cover in R2 and in
 * My Images. The one exception is `studentProfiles.profilePhoto`, called out
 * at its case below.
 *
 * Same three steps as `getCategoryModuleDeleteOrphanKeys`
 * (`convex/contentModules/categories.ts:165`), which is the proven shape:
 *
 *   1. collect every personal key held by the rows about to be deleted,
 *   2. collect every personal key the account's SURVIVING rows still hold,
 *      excluding the rows about to be deleted,
 *   3. return the difference.
 *
 * Step 2 is what stops a delete blanking a recording the user still uses
 * elsewhere: one clip can back a category symbol AND every talker slot that
 * reuses it, because the slot copies the key string. Dropping step 2 would
 * turn this from a cleanup into a data-loss bug. Note the two steps use
 * DIFFERENT predicates on purpose — candidates are filtered by
 * `isPersonalAudioKey` ("may we delete it?"), the surviving-reference walk by
 * `isPersonalAssetKey` ("is anything still using it?"). Merging them would
 * either resurrect image hard-deletes or blind the My Images guard.
 *
 * Returns `[]` for a row that is missing or belongs to another account —
 * the caller then deletes nothing from R2, which is the safe direction.
 *
 * THE CASCADE MUST MIRROR THE MUTATION. `deleteFolder`
 * (`convex/profileFolders.ts:135`) deletes the folder's lists (tree
 * `"lists"`) or sentences (tree `"sentences"`); this walks exactly those and
 * nothing else. If that mutation's cascade changes, this changes with it —
 * collecting less orphans an asset, collecting more deletes a live one.
 */
export async function collectDeleteOrphanKeys(
  ctx: QueryCtx,
  accountId: Id<"users">,
  target: DeleteTarget,
): Promise<string[]> {
  const candidates: string[] = [];
  const exclude: ExcludeIds = {};

  switch (target.kind) {
    case "category": {
      const cat = await ctx.db.get(target.categoryId);
      if (!cat || cat.accountId !== accountId) return [];
      // Cover image included via the extractor but filtered out by the audio
      // predicate — a category cover is an image, so it is soft (phase 36).
      // The call stays so "which fields hold keys" lives in exactly one place.
      candidates.push(...categoryKeys(cat, isPersonalAudioKey));
      const symbols = await ctx.db
        .query("profileSymbols")
        .withIndex("by_profile_category_id", (q) =>
          q.eq("profileCategoryId", cat._id),
        )
        .collect();
      for (const sym of symbols) {
        candidates.push(...symbolKeys(sym, isPersonalAudioKey));
      }
      exclude.categoryIds = new Set([String(cat._id)]);
      exclude.symbolIds = new Set(symbols.map((sym) => String(sym._id)));
      break;
    }

    case "folder": {
      const folder = await ctx.db.get(target.folderId);
      if (!folder || folder.accountId !== accountId) return [];
      // Folder cover image: soft, same as a category cover (phase 36).
      candidates.push(...folderKeys(folder, isPersonalAudioKey));
      exclude.folderIds = new Set([String(folder._id)]);
      if (folder.tree === "lists") {
        const lists = await ctx.db
          .query("profileLists")
          .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
          .collect();
        for (const l of lists) candidates.push(...listKeys(l, isPersonalAudioKey));
        exclude.listIds = new Set(lists.map((l) => String(l._id)));
      } else if (folder.tree === "sentences") {
        const sentences = await ctx.db
          .query("profileSentences")
          .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
          .collect();
        for (const sen of sentences) {
          candidates.push(...sentenceKeys(sen, isPersonalAudioKey));
        }
        exclude.sentenceIds = new Set(sentences.map((sen) => String(sen._id)));
      }
      break;
    }

    case "list": {
      const list = await ctx.db.get(target.listId);
      if (!list || list.accountId !== accountId) return [];
      candidates.push(...listKeys(list, isPersonalAudioKey));
      exclude.listIds = new Set([String(list._id)]);
      break;
    }

    case "studentProfile": {
      const profile = await ctx.db.get(target.profileId);
      if (!profile || profile.accountId !== accountId) return [];
      // THE ONE CASE THAT KEEPS THE OWNERSHIP PREDICATE (owner decision,
      // 2026-09-05: leave this collector exactly as it was). `profilePhoto` is
      // an image, so the phase-36 rule would make it soft — but no UI writes
      // that field today, and it is absent from My Images by construction, so
      // "soft" here would mean an invisible leak rather than a listed image.
      // Deliberately NOT `isPersonalAudioKey`.
      candidates.push(...studentProfileKeys(profile, isPersonalAssetKey));
      exclude.profileIds = new Set([String(profile._id)]);
      break;
    }
  }

  if (candidates.length === 0) return [];
  // Referenced walk keeps `isPersonalAssetKey` (hard-coded inside
  // `collectReferencedPersonalKeys`). Over-inclusive is the safe direction
  // here: an extra reference only leaves an orphan, a missing one deletes a
  // live asset.
  const referenced = await collectReferencedPersonalKeys(ctx, accountId, exclude);
  return [...new Set(candidates)].filter((k) => !referenced.has(k));
}

/**
 * How many of the account's OTHER rows still reference any of `targetKeys`.
 * Used to warn (not block) before deleting a custom image that other items use,
 * and — from phase 36 — to BLOCK the My Images gallery's Delete button, the one
 * hard delete for images in the product.
 *
 * KEEPS `isPersonalAssetKey`, deliberately. This is a reference count, not a
 * delete-candidate walk; narrowing it to `isPersonalAudioKey` would make it
 * report 0 for every image and the gallery would happily delete an object a
 * symbol still points at. See `isPersonalAudioKey` in ./contentModuleDelete.
 */
export async function countRowsReferencingKeys(
  ctx: QueryCtx,
  accountId: Id<"users">,
  targetKeys: ReadonlySet<string>,
  exclude: ExcludeIds = {},
): Promise<number> {
  if (targetKeys.size === 0) return 0;
  const intersects = (keys: string[]) => keys.some((k) => targetKeys.has(k));
  let count = 0;

  const symbols = await ctx.db
    .query("profileSymbols")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of symbols) {
    if (exclude.symbolIds?.has(String(s._id))) continue;
    if (intersects(symbolKeys(s, isPersonalAssetKey))) count++;
  }

  const sentences = await ctx.db
    .query("profileSentences")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of sentences) {
    if (exclude.sentenceIds?.has(String(s._id))) continue;
    if (intersects(sentenceKeys(s, isPersonalAssetKey))) count++;
  }

  const phrases = await ctx.db
    .query("profilePhrases")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of phrases) {
    if (exclude.phraseIds?.has(String(p._id))) continue;
    if (intersects(phraseKeys(p, isPersonalAssetKey))) count++;
  }

  const lists = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const l of lists) {
    if (exclude.listIds?.has(String(l._id))) continue;
    if (intersects(listKeys(l, isPersonalAssetKey))) count++;
  }

  const categories = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const c of categories) {
    if (exclude.categoryIds?.has(String(c._id))) continue;
    if (intersects(categoryKeys(c, isPersonalAssetKey))) count++;
  }

  const folders = await ctx.db
    .query("profileFolders")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const f of folders) {
    if (exclude.folderIds?.has(String(f._id))) continue;
    if (intersects(folderKeys(f, isPersonalAssetKey))) count++;
  }

  // Seventh table, mirroring `collectReferencedPersonalKeys` above — see
  // `studentProfileKeys`. Adding a table to this walk can only make the count
  // MORE conservative (more rows counted as referencing → fewer deletions),
  // so it cannot cause a wrongful delete. The two walks answer the same
  // question (see the docblock in convex/accountImages.ts) and must agree
  // table-for-table.
  const profiles = await ctx.db
    .query("studentProfiles")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of profiles) {
    if (exclude.profileIds?.has(String(p._id))) continue;
    if (intersects(studentProfileKeys(p, isPersonalAssetKey))) count++;
  }

  return count;
}

/**
 * Every PROMOTABLE R2 key referenced by ONE publish source — the inverse of
 * `collectReferencedPersonalKeys`, which returns the keys that SURVIVE a
 * delete. Publish promotion needs the forward direction: "what does this thing
 * point at, so I can copy it somewhere durable."
 *
 * Promotable = personal (`accounts/` | `profiles/`) OR legacy shared
 * (`library_packs/`). The legacy half is deliberate and is NOT symmetric with
 * the delete path: `library_packs/` keys must be COPIED into
 * `library_modules/` so the retired prefix can be dropped, but they must never
 * become DELETABLE on uninstall. See the "PROMOTABLE ≠ PERSONAL" docblock in
 * ./contentModuleDelete before widening or narrowing either predicate.
 *
 * `tree: "categories"` addresses a single `profileCategories` row plus its
 * symbols; the foldered trees address a `profileFolders` row plus its children.
 * Reuses the same per-table extractors, so field coverage can never drift from
 * the delete path (ADR-022) — only the `keep` predicate differs.
 *
 * The actual walk lives in `collectSourceKeysByPredicate` below, parameterised
 * by `keep`. This function is a thin wrapper that hardcodes `keep =
 * isPromotableAssetKey` — its body is exactly what it was before this file
 * grew a second, CREDITABLE projection of the same rows (`collectSourceImageRefs`
 * below), so every existing caller (`getPublishAssetKeys` in
 * contentModules/publish.ts, which `/api/admin/promote-module-assets` uses to
 * decide what to copy) sees byte-for-byte identical behaviour.
 */
export async function collectSourcePromotableKeys(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
): Promise<string[]> {
  return collectSourceKeysByPredicate(ctx, args, isPromotableAssetKey);
}

/**
 * Every row ONE publish source addresses — the cover-bearing container plus its
 * children. Loaded once, in one place (phase-31 whole-phase review, Finding 1),
 * because THREE different projections are now taken of the same rows:
 * promotable keys (what to copy), creditable keys, and `ImageRef`s carrying the
 * provenance that sits next to each key (`collectSourceImageRefs` below). If
 * each projection ran its own traversal they could come to disagree about WHICH
 * ROWS a module contains, and a publish would then copy an object it did not
 * credit, or credit one it did not ship.
 *
 * Returns `undefined` when the source row is gone — callers return empty,
 * exactly as they did before.
 */
type PublishSourceRows = {
  category?: Doc<"profileCategories">;
  folder?: Doc<"profileFolders">;
  symbols: Doc<"profileSymbols">[];
  lists: Doc<"profileLists">[];
  sentences: Doc<"profileSentences">[];
  phrases: Doc<"profilePhrases">[];
};

async function loadPublishSourceRows(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
): Promise<PublishSourceRows | undefined> {
  const empty = { symbols: [], lists: [], sentences: [], phrases: [] };

  if (args.tree === "categories") {
    const category = await ctx.db.get(args.sourceId as Id<"profileCategories">);
    if (!category) return undefined;
    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", category._id)
      )
      .collect();
    return { ...empty, category, symbols };
  }

  const folder = await ctx.db.get(args.sourceId as Id<"profileFolders">);
  if (!folder) return undefined;

  if (args.tree === "lists") {
    const lists = await ctx.db
      .query("profileLists")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    return { ...empty, folder, lists };
  }
  if (args.tree === "sentences") {
    const sentences = await ctx.db
      .query("profileSentences")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    return { ...empty, folder, sentences };
  }
  const phrases = await ctx.db
    .query("profilePhrases")
    .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
    .collect();
  return { ...empty, folder, phrases };
}

/** The walk behind `collectSourcePromotableKeys`, parameterised by `keep` so a
 * future second key-predicate caller can share it without drifting on "what
 * fields does this source have." Row loading goes through
 * `loadPublishSourceRows`, the same loader `collectSourceImageRefs` below
 * uses, so the key walk and the refs walk cannot disagree on which rows a
 * source contains either. */
async function collectSourceKeysByPredicate(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
  keep: KeyFilter,
): Promise<string[]> {
  const rows = await loadPublishSourceRows(ctx, args);
  if (!rows) return [];

  const out: string[] = [];
  if (rows.category) for (const k of categoryKeys(rows.category, keep)) out.push(k);
  if (rows.folder) for (const k of folderKeys(rows.folder, keep)) out.push(k);
  for (const s of rows.symbols) for (const k of symbolKeys(s, keep)) out.push(k);
  for (const l of rows.lists) for (const k of listKeys(l, keep)) out.push(k);
  for (const s of rows.sentences) for (const k of sentenceKeys(s, keep)) out.push(k);
  for (const p of rows.phrases) for (const k of phraseKeys(p, keep)) out.push(k);

  return [...new Set(out)];
}

/**
 * Every creditable image placement in ONE publish source, WITH the provenance
 * the placement itself still carries (phase-31 whole-phase review, Finding 1).
 *
 * The reason publish can now survive an un-backfilled registry. A bare key
 * string tells `collectModuleCredits` nothing when the registry lookup
 * misses, so publish embedded NO credit for that image — even though
 * `attribution` / `license` / `imageSourceUrl` were sitting on the very row
 * being published (phase 30's per-placement fields, which phase 31
 * deliberately kept). These refs carry those fields, so the miss has
 * somewhere to fall back to.
 *
 * Filtered by `isCreditableAssetKey` — see ./contentModuleDelete for the full
 * rationale on why this predicate is wider than `isPromotableAssetKey`. Audio
 * keys are absent by construction here rather than by predicate — the ref
 * extractors in ./imageCreditRefs are images-only.
 */
export async function collectSourceImageRefs(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
): Promise<ImageRef[]> {
  const rows = await loadPublishSourceRows(ctx, args);
  if (!rows) return [];

  const out: ImageRef[] = [];
  if (rows.category) out.push(...coverRef(rows.category, "profileCategories.imagePath"));
  if (rows.folder) out.push(...coverRef(rows.folder, "profileFolders.imagePath"));
  for (const s of rows.symbols) out.push(...symbolRefs(s));
  for (const l of rows.lists) out.push(...listRefs(l));
  for (const s of rows.sentences) out.push(...sentenceRefs(s));
  for (const p of rows.phrases) out.push(...phraseRefs(p));

  return out.filter((ref) => isCreditableAssetKey(ref.imageKey));
}
