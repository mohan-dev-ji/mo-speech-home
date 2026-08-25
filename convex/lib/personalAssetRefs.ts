import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import {
  isPersonalAssetKey,
  isPromotableAssetKey,
  isCreditableAssetKey,
} from "./contentModuleDelete";

/**
 * Which keys an extractor keeps. Three — and only three — values are ever
 * passed, each answering a different question about the same key:
 *
 *   `isPersonalAssetKey`   → "may DELETE remove this?" (`accounts/` |
 *                            `profiles/` only).
 *   `isPromotableAssetKey` → "must PUBLISH copy this into the module's own
 *                            prefix?" (personal + legacy `library_packs/`).
 *   `isCreditableAssetKey` → "does this key carry a licence credit?"
 *                            (promotable + `library_modules/`). Widest of the
 *                            three: an already-shared `library_modules/`
 *                            object needs no copy but still needs crediting,
 *                            which is why this cannot reuse the publish set.
 *
 * Widest ≠ interchangeable. Handing the credit predicate to the promotion path
 * would copy objects that are already shared; handing it to the delete path
 * would let one account delete another's assets. See the doc block on
 * `isPromotableAssetKey` in `contentModuleDelete.ts`.
 *
 * The predicate is an explicit parameter rather than a hard-coded call so the
 * delete path physically cannot inherit the wider promotion rule. See the
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
// drift apart. Only the `keep` predicate differs between delete and publish.

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

type ExcludeIds = {
  sentenceIds?: ReadonlySet<string>;
  phraseIds?: ReadonlySet<string>;
  listIds?: ReadonlySet<string>;
  symbolIds?: ReadonlySet<string>;
  categoryIds?: ReadonlySet<string>;
  folderIds?: ReadonlySet<string>;
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

  return refs;
}

/**
 * How many of the account's OTHER rows still reference any of `targetKeys`.
 * Used to warn (not block) before deleting a custom image that other items use.
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
 * isPromotableAssetKey` — its body is exactly what it was before
 * `collectSourceCreditableKeys` was added below it, so every existing caller
 * (`getPublishAssetKeys` in contentModules/publish.ts, which
 * `/api/admin/promote-module-assets` uses to decide what to copy) sees
 * byte-for-byte identical behaviour.
 */
export async function collectSourcePromotableKeys(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
): Promise<string[]> {
  return collectSourceKeysByPredicate(ctx, args, isPromotableAssetKey);
}

/**
 * Every CREDITABLE R2 key referenced by ONE publish source — wider than
 * `collectSourcePromotableKeys` (phase-31 review, 2026-08-25). "Which keys
 * need copying to R2" and "which keys need crediting" are different
 * questions: an already-shared `library_modules/…` key (the source is itself
 * an installed copy being re-published) needs no copy, but if it holds a
 * CC-licensed image it still needs credit. See `isCreditableAssetKey` in
 * ./contentModuleDelete for the full rationale.
 *
 * Used ONLY by the credit lookup (`collectModuleCredits` in ./moduleCredits).
 * Never use this to decide what promote-module-assets copies — that stays on
 * `collectSourcePromotableKeys` / `isPromotableAssetKey`.
 */
export async function collectSourceCreditableKeys(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
): Promise<string[]> {
  return collectSourceKeysByPredicate(ctx, args, isCreditableAssetKey);
}

/** Shared walk behind both `collectSourcePromotableKeys` and
 * `collectSourceCreditableKeys` — identical table traversal, `keep` is the
 * only thing that differs, so the two collectors can never drift apart on
 * "what fields does this source have." */
async function collectSourceKeysByPredicate(
  ctx: QueryCtx,
  args: { tree: "categories" | "lists" | "sentences" | "phrases"; sourceId: string },
  keep: KeyFilter,
): Promise<string[]> {
  const out: string[] = [];

  if (args.tree === "categories") {
    const cat = await ctx.db.get(args.sourceId as Id<"profileCategories">);
    if (!cat) return [];
    for (const k of categoryKeys(cat, keep)) out.push(k);
    const symbols = await ctx.db
      .query("profileSymbols")
      .withIndex("by_profile_category_id", (q) =>
        q.eq("profileCategoryId", cat._id)
      )
      .collect();
    for (const s of symbols) for (const k of symbolKeys(s, keep)) out.push(k);
    return [...new Set(out)];
  }

  const folder = await ctx.db.get(args.sourceId as Id<"profileFolders">);
  if (!folder) return [];
  for (const k of folderKeys(folder, keep)) out.push(k);

  if (args.tree === "lists") {
    const rows = await ctx.db
      .query("profileLists")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const r of rows) for (const k of listKeys(r, keep)) out.push(k);
  } else if (args.tree === "sentences") {
    const rows = await ctx.db
      .query("profileSentences")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const r of rows) for (const k of sentenceKeys(r, keep)) out.push(k);
  } else {
    const rows = await ctx.db
      .query("profilePhrases")
      .withIndex("by_folder_id_and_order", (q) => q.eq("folderId", folder._id))
      .collect();
    for (const r of rows) for (const k of phraseKeys(r, keep)) out.push(k);
  }

  return [...new Set(out)];
}
