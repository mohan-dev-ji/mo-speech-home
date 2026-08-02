/**
 * Derive a composed sentence's whole-utterance caption from its units, mirroring
 * the client's `blocksFromUnits(...)` + join (SentencesModeContent.tsx:576-580):
 * each unit in order → phrase's `name` or word's `label`, resolved for `lang`
 * (3-tier fallback), joined by a space. Pure — used server-side to keep the
 * `text` column in sync with `units` so block sentences carry a localised string
 * (display/search + module round-trip). Empty-resolving units are skipped.
 */
import { displayString } from "../../lib/languages/displayValue";
import { DEFAULT_LOCALE } from "../../lib/languages/registry";

type TextUnit = {
  kind: "word" | "phrase";
  order: number;
  name?: Record<string, string>;
  label?: Record<string, string>;
};

export function deriveCompositionText(
  units: readonly TextUnit[],
  lang: string,
): string {
  return [...units]
    .sort((a, b) => a.order - b.order)
    .map((u) =>
      u.kind === "phrase"
        ? displayString(u.name, lang, DEFAULT_LOCALE)
        : displayString(u.label, lang, DEFAULT_LOCALE),
    )
    .filter((s) => s !== "")
    .join(" ");
}
