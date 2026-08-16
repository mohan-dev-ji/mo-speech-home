// Turn create-modal rows into ordered symbol specs for createProfileCategory.
// For an auto-match row, look up the word's top SymbolStix hit and (per phase-16
// audio-follows-label) attach a tts override only when the typed word differs
// from the symbol's own word for the board language. Pure orchestration — the
// caller injects the Convex search and the /api/tts resolve.
import type { Id } from '@/convex/_generated/dataModel';
import type { AutoMatchDeps } from '@/lib/symbols/autoMatchDeps';

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

      // Carry the matched symbol's full multi-language words so the tile's label
      // switches with the board language (not just the authoring language). The
      // board language slot is overridden with the typed word.
      const spec: CreateSymbolSpec = {
        label: { ...hit.words, [language]: r.label },
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
