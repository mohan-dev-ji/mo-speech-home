// The search + TTS contract every auto-match builder needs. Lives here rather
// than under `lib/categories/` because it is not category-specific: categories,
// core-word lists (`lib/categories/autoMatchSymbols.ts`) and sentences
// (`lib/sentences/autoMatchSlots.ts`) all resolve a typed word to its top hit.
// The concrete implementation is injected by `app/lib/symbols/useAutoMatchDeps.ts`
// so the builders stay pure.
import type { Id } from '@/convex/_generated/dataModel';

export type SearchHit = {
  _id: Id<'symbols'>;
  words: Record<string, string>;
  // R2 path of the SymbolStix artwork. Always present on a symbol row
  // (`symbols.imagePath` is `v.string()`); sentence slots store it directly,
  // where categories go via `symbolId` and let the mutation resolve it.
  imagePath: string;
};

export type AutoMatchDeps = {
  // Top hit for a word in the given language, or null if none.
  search: (term: string, language: string) => Promise<SearchHit | null>;
  // Resolve spoken text to an R2 key via /api/tts, or null on failure.
  resolveTts: (text: string, language: string) => Promise<string | null>;
};
