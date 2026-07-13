/**
 * Client helper for on-demand MT (ADR-016 Addendum C). Posts to the authenticated
 * `/api/translate-text` route (Gemini via Vertex) and returns the translations
 * aligned to the input order. Used by variant authoring to fill a fluent
 * sentence's text or a block sentence's per-unit labels in the target language.
 */
import { displayString } from './displayValue';
import { DEFAULT_LOCALE } from './registry';

export async function translateTexts(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  if (texts.length === 0) return [];
  const res = await fetch('/api/translate-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLang }),
  });
  if (!res.ok) throw new Error(`translate-text ${res.status}`);
  const data = (await res.json()) as { translations?: unknown };
  if (!Array.isArray(data.translations) || data.translations.length !== texts.length) {
    throw new Error('translate-text: malformed response');
  }
  return data.translations.map((t) => String(t));
}

/**
 * Gap-fill helper for translating localised records (ADR-016 MT-assist). Pass
 * EVERY record you intend to fill (unit labels, phrase name + word labels, …);
 * it batch-translates — in ONE `translateTexts` call — the unique source-language
 * values of records that lack `targetLang`, then returns a pure `fill(record)`:
 *   • record already has `targetLang`  → returned unchanged
 *   • else, its `srcLang` value translated → `{ ...record, [targetLang]: … }`
 * The caller applies `fill` while walking its own structure, so the reconstruction
 * stays identical to a hand-written per-field fill — only the batch is shared.
 */
export async function makeRecordFiller(
  records: (Record<string, string> | undefined)[],
  srcLang: string,
  targetLang: string,
): Promise<<T extends Record<string, string> | undefined>(record: T) => T> {
  const need: string[] = [];
  for (const r of records) {
    if (r && !r[targetLang]) {
      const s = displayString(r, srcLang, DEFAULT_LOCALE);
      if (s) need.push(s);
    }
  }
  const uniq = [...new Set(need)];
  const translated = uniq.length ? await translateTexts(uniq, targetLang) : [];
  const map = new Map(uniq.map((s, i) => [s, translated[i]]));

  return <T extends Record<string, string> | undefined>(record: T): T => {
    if (!record || record[targetLang]) return record;
    const s = displayString(record, srcLang, DEFAULT_LOCALE);
    const t = s ? map.get(s) : undefined;
    return (t ? { ...record, [targetLang]: t } : record) as T;
  };
}
