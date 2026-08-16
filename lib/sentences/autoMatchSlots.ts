// Turn a typed sentence into ordered image-only slots for createProfileSentence.
//
// Sentences made in the create modal are FLUENT: their strip is `slots[]`, which
// carry an imagePath and nothing else (no label, no audio) — the whole utterance
// is spoken by one sentence-level clip. So this resolves an image per word and
// never touches TTS, which is why it takes only the `search` half of the deps.
// Contrast `lib/categories/autoMatchSymbols.ts`, where each symbol is its own
// speakable tile and needs audio-follows-label.
//
// Pure orchestration — the caller injects the Convex search.
import type { AutoMatchDeps } from '@/lib/symbols/autoMatchDeps';

export type SlotSpec = {
  order: number;
  imagePath?: string;
  // AUTHORING ONLY — never rendered. Seeds the slot editor's symbol search.
  // Carries the matched symbol's full multi-language words with the typed word
  // winning for the board language, so the seed follows the board — the same
  // shape `buildCreateSymbols` stores for category symbols.
  label?: Record<string, string>;
};

/** Max slots one auto-match run creates. The sentence name keeps every word. */
const MAX_SLOTS = 30;

/**
 * Split a sentence into searchable words: whitespace-separated, with leading and
 * trailing punctuation stripped ("home." → "home", "(hello)" → "hello").
 *
 * Inner punctuation is deliberately kept, so contractions and hyphenated words
 * stay whole ("don't", "sit-down") — they are single searchable words, and
 * splitting them would produce meaningless tiles. Tokens that strip to nothing
 * (a lone "—") are dropped. Unicode-aware, including combining marks (\p{M}:
 * Devanagari matras, anusvara, visarga, and similar diacritics elsewhere) so
 * they're kept as part of the word instead of stripped as trailing punctuation
 * — otherwise most Hindi words lose their final vowel sign.
 */
export function splitSentenceWords(text: string, max: number = MAX_SLOTS): string[] {
  return text
    .split(/\s+/)
    .map((word) =>
      word
        .replace(/^[^\p{L}\p{N}\p{M}]+/u, '')
        .replace(/[^\p{L}\p{N}\p{M}]+$/u, ''),
    )
    .filter((word) => word.length > 0)
    .slice(0, max);
}

/**
 * One slot per word, in order, each carrying its top search hit's artwork.
 *
 * A word with no hit — or whose search throws — yields a slot with no imagePath:
 * the blank tile the instructor taps to fill. Never a MISSING slot. Tile
 * positions have to stay aligned with the words of the sentence, because a
 * fluent slot has no label of its own and position is the only thing that tells
 * you which word a blank belongs to.
 *
 * Lookups fan out in parallel and are caught individually, so one failed word
 * can't collapse the rest of the row.
 */
export async function buildSentenceSlots(
  text: string,
  language: string,
  deps: Pick<AutoMatchDeps, 'search'>,
): Promise<SlotSpec[]> {
  const words = splitSentenceWords(text);
  return Promise.all(
    words.map(async (word, order): Promise<SlotSpec> => {
      // Every slot is stamped with its word, matched or not: a blank tile has no
      // artwork to say what it was for, so the seed is worth MORE there.
      const typed = { [language]: word };
      try {
        const hit = await deps.search(word, language);
        return hit
          ? { order, imagePath: hit.imagePath, label: { ...hit.words, ...typed } }
          : { order, label: typed };
      } catch {
        return { order, label: typed };
      }
    }),
  );
}
