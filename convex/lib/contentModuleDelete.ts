/**
 * Content-module delete + R2 orphan collection (ADR-014 §5).
 *
 * Uninstalling a module removes its account-side rows (flat categories + their
 * symbols, or a lists/sentences folder + its items) and the R2 objects that
 * removal leaves with nothing to live for. Since phase 36 that is **voice
 * recordings only** — personal keys under an `/audio/` segment. Images are
 * NEVER collected by a placement delete: the object stays in R2 and stays
 * visible in My Images, which owns the single Delete in the product that
 * removes an image object. See `isPersonalAudioKey` below for why the two
 * media are treated differently (cost of recreation, not media type).
 *
 * Shared assets are NEVER deleted either, and never were: SymbolStix images
 * (`symbols/…`), the legacy AI image cache (`ai-cache/…`), published module
 * assets (`library_modules/…`) and TTS audio (`audio/<voice>/tts/…`) are
 * reused across users.
 *
 * Mirrors the orphan-collection contract of `getCategoryReloadOrphanKeys`
 * (profileCategories.ts): the Next.js route collects keys BEFORE the delete
 * mutation runs, then deletes them from R2 after (best-effort, recoverable).
 */

/**
 * True when an R2 key points at a per-account/per-profile personal asset —
 * one object owned by exactly one account. Shared namespaces (symbolstix,
 * ai-cache, tts, library_modules) return false. The prefix test is the
 * reliable signal: personal uploads/recordings are written under `accounts/`
 * or `profiles/`.
 *
 * OWNERSHIP, NOT DELETABILITY. Since phase 36 this is the predicate for the
 * REFERENCED walk ("is anything still using this key?"), not for the
 * delete-candidate walk — a personal IMAGE is owned but is not deletable by a
 * placement delete. `isPersonalAudioKey` below is the delete-candidate
 * predicate; read its docblock before using either.
 */
export function isPersonalAssetKey(key: string | undefined | null): key is string {
  if (!key) return false;
  return key.startsWith("accounts/") || key.startsWith("profiles/");
}

/**
 * THE DELETE-CANDIDATE PREDICATE (phase 36). Read it the way you read
 * "PROMOTABLE ≠ PERSONAL" below: two questions, two predicates, never merged.
 *
 *   `isPersonalAssetKey`  — "is this object owned by exactly one account?"
 *       It is the REFERENCED-WALK predicate and it still sees IMAGE keys, on
 *       purpose: `collectReferencedPersonalKeys` and `countRowsReferencingKeys`
 *       (lib/personalAssetRefs.ts) answer "is anything still using this key?",
 *       which is precisely the question the My Images gallery asks before it
 *       lets you delete an image a symbol still points at. Narrowing that walk
 *       would make the gallery delete live images.
 *
 *   `isPersonalAudioKey`  — "may deleting a PLACEMENT remove this object from
 *       R2?" Personal recordings only.
 *
 * WHY IMAGES ARE EXEMPT AND RECORDINGS ARE NOT. The principle is **cost of
 * recreation**, not media type, and the asymmetry is deliberate — do not
 * "tidy it up".
 *
 *   An AI image costs about 4p and eight seconds of provider time, and cannot
 *   be reproduced identically even by re-running the same prompt. It also has
 *   a home: My Images lists every image the account owns, so an image whose
 *   last placement was deleted is still visible there and still deletable on
 *   purpose. Soft is therefore free.
 *
 *   A recording costs ten seconds of a parent's time and has NO library. A
 *   soft-deleted recording would be an invisible leak — an object nothing
 *   points at and no screen can show, billed forever. So it still hard-deletes.
 *
 * THE RULE, then: one hard delete for images (the My Images Delete button) and
 * everything else soft. Every other delete — symbol, category reload, module
 * uninstall, list, sentence, phrase, folder — removes the placement and leaves
 * the image object alone. This reverses half of MOS-50 (`4b2673b`), which
 * started deleting AI images on symbol delete; that was right for a world with
 * no library, and there is a library now.
 *
 * WHY THE `/audio/` SEGMENT IS THE SIGNAL. Personal keys have exactly two
 * shapes and both name the medium in the path:
 * `accounts/<id>/(images|audio)/<file>` (enforced by `/api/upload-asset`) and
 * `profiles/<id>/(images|audio)/<file>` (`lib/r2-paths.ts`). A personal key
 * under neither segment is not a recording, so it is not a delete candidate —
 * the safe direction to be wrong in.
 */
export function isPersonalAudioKey(key: string | undefined | null): key is string {
  return isPersonalAssetKey(key) && key.includes("/audio/");
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
 *   `isPersonalAssetKey`  — "is this object OWNED by exactly one account?"
 *       Yes only for `accounts/` and `profiles/`. Every shared namespace
 *       (`symbols/`, `ai-cache/`, `audio/<voice>/tts/`, `library_modules/`,
 *       `library_packs/`) answers NO, because other accounts and published
 *       modules still point at those objects. Widening this predicate makes a
 *       published module's assets reachable by any account that uninstalls it
 *       — the exact catastrophe ADR-022 exists to prevent. (Ownership is
 *       necessary but no longer sufficient for deletion: `isPersonalAudioKey`
 *       above is the delete-candidate predicate as of phase 36.)
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
 * above). This predicate only feeds the credit-registry lookup: it filters
 * `collectSourceImageRefs` in ./personalAssetRefs (the refs `collectModuleCredits`
 * in ./moduleCredits publishes against), and gates `bucketFor` and
 * `checkAccountImageCreditCompleteness` in ../imageCreditsBackfill (the backfill
 * plan and the standing self-check) — it must never be used to decide what
 * promote-module-assets copies.
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

/** R2 keys on a profileLists row's inline items that deleting the list may
 * remove from R2: personal recordings only. */
export function collectListOrphanKeys(items: ReadonlyArray<{
  imagePath?: string;
  imageSourceType?: string;
  audioPath?: string;
  recordedAudioPath?: string;
  generatedAudioPath?: string;
}>): string[] {
  const keys: string[] = [];
  for (const it of items) {
    // `it.imagePath` is deliberately NOT collected (phase 36). Deleting a list
    // removes the placement; the image object stays in R2 and stays visible in
    // My Images, which owns the one Delete that removes it. Recordings below
    // still hard-delete — cost of recreation, not media type. See
    // `isPersonalAudioKey` above before changing either half.
    //
    // Audio: voice recordings are personal. `audioPath` is the active pointer —
    // include it only when it is itself a personal recording path. Generated
    // (TTS) and default (symbolstix) audio are shared and skipped.
    if (isPersonalAudioKey(it.recordedAudioPath)) keys.push(it.recordedAudioPath);
    if (isPersonalAudioKey(it.audioPath)) keys.push(it.audioPath);
  }
  return dedupe(keys);
}

/** R2 keys on a profileSentences row that deleting the sentence may remove
 * from R2: the sentence recording only. `slots[].imagePath` stays in the type
 * to record that slots DO hold image keys and are skipped on purpose — see
 * `isPersonalAudioKey` above. */
export function collectSentenceOrphanKeys(sentence: {
  slots: ReadonlyArray<{ imagePath?: string }>;
  audioPath?: string;
  recordedAudioPath?: string;
}): string[] {
  const keys: string[] = [];
  if (isPersonalAudioKey(sentence.recordedAudioPath)) keys.push(sentence.recordedAudioPath);
  if (isPersonalAudioKey(sentence.audioPath)) keys.push(sentence.audioPath);
  return dedupe(keys);
}

/** R2 keys on a profilePhrases row that deleting the phrase may remove from
 * R2: word recordings + the phrase recording. `words[].imagePath` is skipped
 * on purpose — see `isPersonalAudioKey` above. */
export function collectPhraseOrphanKeys(phrase: {
  words: ReadonlyArray<{ imagePath?: string; audioPath?: string }>;
  audioPath?: string;
  recordedAudioPath?: string;
}): string[] {
  const keys: string[] = [];
  for (const w of phrase.words) {
    if (isPersonalAudioKey(w.audioPath)) keys.push(w.audioPath);
  }
  if (isPersonalAudioKey(phrase.recordedAudioPath)) keys.push(phrase.recordedAudioPath);
  if (isPersonalAudioKey(phrase.audioPath)) keys.push(phrase.audioPath);
  return dedupe(keys);
}

function dedupe(keys: string[]): string[] {
  return Array.from(new Set(keys));
}
