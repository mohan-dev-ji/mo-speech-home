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
