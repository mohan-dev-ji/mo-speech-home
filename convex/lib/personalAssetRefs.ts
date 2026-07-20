import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isPersonalAssetKey } from "./contentModuleDelete";

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
 * must not delete the category's image.
 */
export async function collectReferencedPersonalKeys(
  ctx: QueryCtx,
  accountId: Id<"users">,
  exclude: {
    sentenceIds?: ReadonlySet<string>;
    phraseIds?: ReadonlySet<string>;
    listIds?: ReadonlySet<string>;
    symbolIds?: ReadonlySet<string>;
  } = {},
): Promise<Set<string>> {
  const refs = new Set<string>();
  const add = (k: unknown) => { if (typeof k === "string" && isPersonalAssetKey(k)) refs.add(k); };

  const symbols = await ctx.db
    .query("profileSymbols")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of symbols) {
    if (exclude.symbolIds?.has(String(s._id))) continue;
    const src = s.imageSource as { type?: string; imagePath?: string } | undefined;
    add(src?.imagePath);
    const audioMap = (s.audio as Record<string, { path?: string; alternates?: { recorded?: string } } | undefined>) ?? {};
    for (const a of Object.values(audioMap)) { if (!a) continue; add(a.path); add(a.alternates?.recorded); }
  }

  const sentences = await ctx.db
    .query("profileSentences")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const s of sentences) {
    if (exclude.sentenceIds?.has(String(s._id))) continue;
    for (const slot of s.slots ?? []) add(slot?.imagePath);
    add(s.recordedAudioPath); add(s.audioPath);
    for (const u of (s.units ?? []) as Array<Record<string, unknown>>) {
      add(u?.imagePath); add(u?.audioPath); add(u?.recordedAudioPath);
      for (const w of ((u?.words ?? []) as Array<Record<string, unknown>>)) { add(w?.imagePath); add(w?.audioPath); }
    }
  }

  const phrases = await ctx.db
    .query("profilePhrases")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const p of phrases) {
    if (exclude.phraseIds?.has(String(p._id))) continue;
    add(p.recordedAudioPath); add(p.audioPath);
    for (const w of ((p.words ?? []) as Array<Record<string, unknown>>)) { add(w?.imagePath); add(w?.audioPath); }
  }

  const lists = await ctx.db
    .query("profileLists")
    .withIndex("by_account_id", (q) => q.eq("accountId", accountId))
    .collect();
  for (const l of lists) {
    if (exclude.listIds?.has(String(l._id))) continue;
    for (const it of l.items ?? []) {
      add(it?.imagePath); add(it?.audioPath); add(it?.recordedAudioPath); add(it?.generatedAudioPath);
    }
  }

  return refs;
}
