import { getRequestConfig } from 'next-intl/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { routing } from './routing';

/**
 * Server-side message loader. Reads `messages/<locale>.json` from disk on
 * every request rather than using `await import()` — see comment below.
 *
 * **Why `readFile` instead of dynamic `import()`:**
 *
 * Next.js bundles `await import(\`../messages/${locale}.json\`)` as a webpack
 * context module: the bundler scans `messages/*.json` at compile time and
 * generates one chunk per file. Files added *after* the bundle was first
 * built (e.g. via `/api/admin/language-publish` in dev) are NOT in the
 * context map and the dynamic import silently resolves to an empty module
 * — `.default` is `undefined`, and the merge below spreads `undefined`
 * (no-op) so the user gets all-English content despite the URL being
 * `/es/...`.
 *
 * Symptom: switching to a freshly-added locale via the navbar leaves UI
 * strings in English until a full server restart. Switching to a locale
 * present at first bundle (en/hi here) worked instantly.
 *
 * `readFile` is server-only, hits the actual on-disk file, and runs in
 * microseconds for the ~30KB message files. No bundler involvement, so
 * languages added mid-session are picked up on the next request.
 *
 * Returns an empty object when the locale file doesn't exist — the merge
 * below falls back to English for every key, which is the existing
 * behaviour for partially-translated locales.
 */
async function loadMessageFile(locale: string): Promise<Record<string, unknown>> {
  try {
    const path = join(process.cwd(), 'messages', `${locale}.json`);
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Missing or malformed file → caller falls back to English via the merge.
    return {};
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  // Merge English as base so any key missing from <locale>.json silently
  // falls back to English. Critical during the machine-translation window
  // when a key may have landed in en.json but not yet been translated.
  const enMessages = await loadMessageFile('en');
  const localeMessages = locale !== 'en' ? await loadMessageFile(locale) : enMessages;

  // Shallow-merge per namespace — works because message files are one level
  // deep. Iterating over English's keys silently drops any extras in the
  // locale file (e.g. the `_sourceSnapshot` key written by the translation
  // pipeline for diff tracking — see `app/api/admin/translate-ui-strings/route.ts`).
  const messages = locale !== 'en'
    ? Object.fromEntries(
        Object.keys(enMessages).map(ns => [
          ns,
          { ...(enMessages as Record<string, Record<string, unknown>>)[ns], ...(localeMessages as Record<string, Record<string, unknown>>)[ns] },
        ])
      )
    : enMessages;

  return { locale, messages };
});
