/**
 * Content-module delete + R2 orphan collection (ADR-014 §5).
 *
 * Uninstalling a module removes its account-side rows (flat categories + their
 * symbols, or a lists/sentences folder + its items) and the **personal** R2
 * assets the user created while customising it. "Personal" = uploaded images,
 * image-search picks, and voice recordings — these live under the `accounts/`
 * or `profiles/` namespaces. Shared assets are NEVER deleted: SymbolStix images
 * (`symbols/…`), the AI image cache (`ai-cache/…`), and TTS audio
 * (`audio/<voice>/tts/…`) are reused across users.
 *
 * Mirrors the orphan-collection contract of `getCategoryReloadOrphanKeys`
 * (profileCategories.ts): the Next.js route collects keys BEFORE the delete
 * mutation runs, then deletes them from R2 after (best-effort, recoverable).
 */

/**
 * True when an R2 key points at a per-account/per-profile personal asset that
 * should be deleted on uninstall. Shared namespaces (symbolstix, ai-cache, tts)
 * return false and are left untouched. The prefix test is the reliable signal:
 * personal uploads/recordings are written under `accounts/` or `profiles/`.
 */
export function isPersonalAssetKey(key: string | undefined | null): key is string {
  if (!key) return false;
  return key.startsWith("accounts/") || key.startsWith("profiles/");
}

/**
 * The retired pack-era shared prefix (ADR-010). Assets under it are SHARED —
 * a published module and every account that installed it point at the very
 * same objects. Only the `space` module still lives here.
 */
const LEGACY_SHARED_MODULE_PREFIX = "library_packs/";

/** True for a key under the retired pack-era `library_packs/` prefix. */
export function isLegacySharedModuleAssetKey(
  key: string | undefined | null,
): key is string {
  return !!key && key.startsWith(LEGACY_SHARED_MODULE_PREFIX);
}

/**
 * PROMOTABLE ≠ PERSONAL. Read this before touching either predicate.
 *
 * Two different questions get asked about an R2 key, and they must never be
 * answered by the same function:
 *
 *   `isPersonalAssetKey`  — "may uninstall DELETE this object from R2?"
 *       Yes only for `accounts/` and `profiles/`, which are owned by exactly
 *       one account. Every shared namespace (`symbols/`, `ai-cache/`,
 *       `audio/<voice>/tts/`, `library_modules/`, `library_packs/`) answers
 *       NO, because other accounts and published modules still point at those
 *       objects. Widening this predicate makes a published module's assets
 *       deletable by any account that uninstalls it — the exact catastrophe
 *       ADR-022 exists to prevent.
 *
 *   `isPromotableAssetKey` — "should publish COPY this object into the
 *       module's own `library_modules/<tree>/<slug>/…` prefix?"
 *       Yes for personal keys (ADR-022's original case: the admin's own
 *       images must not stay under `accounts/…`), AND yes for legacy
 *       `library_packs/…` keys, so the `space` module can be migrated off the
 *       retired prefix by re-publishing it and `library_packs/` can then be
 *       deleted wholesale (ADR-022 amendment, 2026-08-24).
 *
 * Copying is additive and always safe; deleting is destructive and is not.
 * That asymmetry is why "promotable" is deliberately the wider set and why
 * these two functions stay separate even though one currently calls the other.
 * DO NOT "simplify" them into one predicate.
 *
 * Used ONLY by the publish/promotion path:
 *   - `collectSourcePromotableKeys` (convex/lib/personalAssetRefs.ts)
 *   - `/api/admin/promote-module-assets`
 *
 * Also COMPOSED (never replaced) by `isCreditableAssetKey` below, which adds
 * `library_modules/` on top for the licence-credit lookup. That is a third
 * question — "does this key carry a credit?" — and must not be confused with
 * either of the two above.
 */
export function isPromotableAssetKey(
  key: string | undefined | null,
): key is string {
  return isPersonalAssetKey(key) || isLegacySharedModuleAssetKey(key);
}

/**
 * A THIRD predicate (phase-31 review, 2026-08-25) — "should this key carry an
 * image credit?" — deliberately wider than `isPromotableAssetKey` and built
 * without touching it or `isPersonalAssetKey`.
 *
 * "Which keys need copying to R2" and "which keys need crediting" are
 * different questions. An already-shared `library_modules/…` object (e.g. the
 * source folder for a re-publish is itself an installed copy) needs no copy —
 * it is already in its final published location — but it absolutely still
 * needs credit if the image behind it is CC-licensed. `isPromotableAssetKey`
 * answers the copy question and must stay narrow, or promotion starts copying
 * objects that don't need copying (see the "PROMOTABLE ≠ PERSONAL" docblock
 * above). This predicate only feeds the credit-registry lookup
 * (`collectSourceCreditableKeys` in ./personalAssetRefs, used by
 * `collectModuleCredits` in ./moduleCredits) — it must never be used to decide
 * what promote-module-assets copies.
 */
export function isCreditableAssetKey(
  key: string | undefined | null,
): key is string {
  return isPromotableAssetKey(key) || isLibraryModuleAssetKey(key);
}

/** Split into its own function (not inlined) so its `key` parameter is a
 * fresh, unnarrowed binding — inlining `!!key && key.startsWith(...)` after
 * `isPromotableAssetKey(key)` in an `||` leaves TypeScript narrowing `key` to
 * `never` in the second operand, because the first operand's `key is string`
 * guard asserts non-string in its false branch. */
function isLibraryModuleAssetKey(key: string | undefined | null): key is string {
  return !!key && key.startsWith("library_modules/");
}

/** Personal R2 keys on a profileLists row's inline items (uploads + recordings). */
export function collectListOrphanKeys(items: ReadonlyArray<{
  imagePath?: string;
  imageSourceType?: string;
  audioPath?: string;
  recordedAudioPath?: string;
  generatedAudioPath?: string;
}>): string[] {
  const keys: string[] = [];
  for (const it of items) {
    // Image: only personal uploads / image-search picks (symbolstix + aiGenerated
    // are shared). The prefix test guards against mislabelled imageSourceType.
    if (isPersonalAssetKey(it.imagePath)) keys.push(it.imagePath);
    // Audio: voice recordings are personal. `audioPath` is the active pointer —
    // include it only when it is itself a personal recording path. Generated
    // (TTS) and default (symbolstix) audio are shared and skipped.
    if (isPersonalAssetKey(it.recordedAudioPath)) keys.push(it.recordedAudioPath);
    if (isPersonalAssetKey(it.audioPath)) keys.push(it.audioPath);
  }
  return dedupe(keys);
}

/** Personal R2 keys on a profileSentences row (slot images + a sentence recording). */
export function collectSentenceOrphanKeys(sentence: {
  slots: ReadonlyArray<{ imagePath?: string }>;
  audioPath?: string;
  recordedAudioPath?: string;
}): string[] {
  const keys: string[] = [];
  for (const slot of sentence.slots) {
    if (isPersonalAssetKey(slot.imagePath)) keys.push(slot.imagePath);
  }
  if (isPersonalAssetKey(sentence.recordedAudioPath)) keys.push(sentence.recordedAudioPath);
  if (isPersonalAssetKey(sentence.audioPath)) keys.push(sentence.audioPath);
  return dedupe(keys);
}

/** Personal R2 keys on a profilePhrases row (word images/recordings + a phrase recording). */
export function collectPhraseOrphanKeys(phrase: {
  words: ReadonlyArray<{ imagePath?: string; audioPath?: string }>;
  audioPath?: string;
  recordedAudioPath?: string;
}): string[] {
  const keys: string[] = [];
  for (const w of phrase.words) {
    if (isPersonalAssetKey(w.imagePath)) keys.push(w.imagePath);
    if (isPersonalAssetKey(w.audioPath)) keys.push(w.audioPath);
  }
  if (isPersonalAssetKey(phrase.recordedAudioPath)) keys.push(phrase.recordedAudioPath);
  if (isPersonalAssetKey(phrase.audioPath)) keys.push(phrase.audioPath);
  return dedupe(keys);
}

function dedupe(keys: string[]): string[] {
  return Array.from(new Set(keys));
}
