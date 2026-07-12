/**
 * Client helper for on-demand MT (ADR-016 Addendum C). Posts to the authenticated
 * `/api/translate-text` route (Gemini via Vertex) and returns the translations
 * aligned to the input order. Used by variant authoring to fill a fluent
 * sentence's text or a block sentence's per-unit labels in the target language.
 */
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
