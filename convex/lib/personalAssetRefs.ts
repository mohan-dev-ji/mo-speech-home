import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { isPersonalAssetKey } from "./contentModuleDelete";

/**
 * Push `k` onto `out` iff it's a personal (`accounts/` | `profiles/`) R2 key.
 * Shared by every per-table extractor below so the "what counts as personal"
 * rule lives in exactly one place (`isPersonalAssetKey`).
 */
function push(out: string[], k: unknown): void {
  if (typeof k === "string" && isPersonalAssetKey(k)) out.push(k);
}

// ─── Per-table key extractors ───────────────────────────────────────────────
// Each returns every personal R2 key a single row holds. These are the sole
// source of truth for "what fields can hold a personal key" — both
// `collectReferencedPersonalKeys` (union over surviving rows) and
// `countRowsReferencingKeys` (count of rows touching a target set) walk the
// same tables via these same functions, so their field coverage can never
// drift apart.

function symbolKeys(s: Doc<"profileSymbols">): string[] {
  const out: string[] = [];
  const src = s.imageSource as { type?: string; imagePath?: string } | undefined;
  push(out, src?.imagePath);
  const audioMap = (s.audio as Record<string, { path?: string; alternates?: { recorded?: string } } | undefined>) ?? {};
  for (const a of Object.values(audioMap)) { if (!a) continue; push(out, a.path); push(out, a.alternates?.recorded); }
  return out;
}

function sentenceKeys(s: Doc<"profileSentences">): string[] {
  const out: string[] = [];
  for (const slot of s.slots ?? []) push(out, slot?.imagePath);
  push(out, s.recordedAudioPath); push(out, s.audioPath);
  for (const u of (s.units ?? []) as Array<Record<string, unknown>>) {
    push(out, u?.imagePath); push(out, u?.audioPath); push(out, u?.recordedAudioPath);
    for (const w of ((u?.words ?? []) as Array<Record<string, unknown>>)) { push(out, w?.imagePath); push(out, w?.audioPath); }
  }
  return out;
}

function phraseKeys(p: Doc<"profilePhrases">): string[] {
  const out: string[] = [];
  push(out, p.recordedAudioPath); push(out, p.audioPath);
  for (const w of ((p.words ?? []) as Array<Record<string, unknown>>)) { push(out, w?.imagePath); push(out, w?.audioPath); }
  return out;
}

function listKeys(l: Doc<"profileLists">): string[] {
  const out: string[] = [];
  for (const it of l.items ?? []) {
    push(out, it?.imagePath); push(out, it?.audioPath); push(out, it?.recordedAudioPath); push(out, it?.generatedAudioPath);
  }
  return out;
}

function categoryKeys(c: Doc<"profileCategories">): string[] {
  const out: string[] = [];
  push(out, c.imagePath);
  return out;
}

function folderKeys(f: Doc<"profileFolders">): string[] {
  const out: string[] = [];
  push(out, f.imagePath);
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
    for (const k of symbolKeys(s)) refs.add(k);
  }

  const sentences = await ctx.db
    .query("profileSentences")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of sentences) {
    if (exclude.sentenceIds?.has(String(s._id))) continue;
    for (const k of sentenceKeys(s)) refs.add(k);
  }

  const phrases = await ctx.db
    .query("profilePhrases")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of phrases) {
    if (exclude.phraseIds?.has(String(p._id))) continue;
    for (const k of phraseKeys(p)) refs.add(k);
  }

  const lists = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const l of lists) {
    if (exclude.listIds?.has(String(l._id))) continue;
    for (const k of listKeys(l)) refs.add(k);
  }

  const categories = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const c of categories) {
    if (exclude.categoryIds?.has(String(c._id))) continue;
    for (const k of categoryKeys(c)) refs.add(k);
  }

  const folders = await ctx.db
    .query("profileFolders")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const f of folders) {
    if (exclude.folderIds?.has(String(f._id))) continue;
    for (const k of folderKeys(f)) refs.add(k);
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
    if (intersects(symbolKeys(s))) count++;
  }

  const sentences = await ctx.db
    .query("profileSentences")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of sentences) {
    if (exclude.sentenceIds?.has(String(s._id))) continue;
    if (intersects(sentenceKeys(s))) count++;
  }

  const phrases = await ctx.db
    .query("profilePhrases")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of phrases) {
    if (exclude.phraseIds?.has(String(p._id))) continue;
    if (intersects(phraseKeys(p))) count++;
  }

  const lists = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const l of lists) {
    if (exclude.listIds?.has(String(l._id))) continue;
    if (intersects(listKeys(l))) count++;
  }

  const categories = await ctx.db
    .query("profileCategories")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const c of categories) {
    if (exclude.categoryIds?.has(String(c._id))) continue;
    if (intersects(categoryKeys(c))) count++;
  }

  const folders = await ctx.db
    .query("profileFolders")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const f of folders) {
    if (exclude.folderIds?.has(String(f._id))) continue;
    if (intersects(folderKeys(f))) count++;
  }

  return count;
}
