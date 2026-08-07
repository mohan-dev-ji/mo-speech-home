// Turn create-modal rows into ordered symbol specs for createProfileCategory.
// For an auto-match row, look up the word's top SymbolStix hit and (per phase-16
// audio-follows-label) attach a tts override only when the typed word differs
// from the symbol's own word for the board language. Pure orchestration — the
// caller injects the Convex search and the /api/tts resolve.
import type { Id } from '@/convex/_generated/dataModel';

export type SearchHit = {
  _id: Id<'symbols'>;
  words: Record<string, string>;
};

export type AudioOverride = {
  type: 'tts';
  path: string;
  ttsText: string;
  language: string;
};

export type CreateSymbolSpec = {
  label: Record<string, string>;
  symbolId?: Id<'symbols'>;
  audio?: Record<string, AudioOverride>;
};

export type AutoMatchDeps = {
  // Top hit for a word in the given language, or null if none.
  search: (term: string, language: string) => Promise<SearchHit | null>;
  // Resolve spoken text to an R2 key via /api/tts, or null on failure.
  resolveTts: (text: string, language: string) => Promise<string | null>;
};

export async function buildCreateSymbols(
  rows: Array<{ label: string; autoMatch: boolean }>,
  language: string,
  deps: AutoMatchDeps,
): Promise<CreateSymbolSpec[]> {
  const trimmed = rows
    .map((r) => ({ label: r.label.trim(), autoMatch: r.autoMatch }))
    .filter((r) => r.label.length > 0);

  return Promise.all(
    trimmed.map(async (r): Promise<CreateSymbolSpec> => {
      const placeholder: CreateSymbolSpec = { label: { [language]: r.label } };
      if (!r.autoMatch) return placeholder;

      const hit = await deps.search(r.label, language);
      if (!hit) return placeholder; // no match → placeholder

      const spec: CreateSymbolSpec = {
        label: { [language]: r.label },
        symbolId: hit._id,
      };

      const symbolWord = (hit.words[language] ?? '').trim();
      if (r.label === symbolWord) return spec; // symbol's own clip already speaks it

      // Diverged word → resolve its audio so the tile speaks the label.
      const key = await deps.resolveTts(r.label, language);
      if (key) {
        spec.audio = { [language]: { type: 'tts', path: key, ttsText: r.label, language } };
      }
      return spec; // resolve failed → no override (mismatch surfaced in edit mode)
    }),
  );
}
