import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  // Merge English as base so any key missing from hi.json silently falls back to English
  const enMessages = (await import('../messages/en.json')).default;
  const localeMessages = locale !== 'en'
    ? (await import(`../messages/${locale}.json`)).default
    : enMessages;

  // Shallow-merge per namespace — works because message files are one level deep
  const messages = locale !== 'en'
    ? Object.fromEntries(
        Object.keys(enMessages).map(ns => [
          ns,
          { ...(enMessages as any)[ns], ...(localeMessages as any)[ns] },
        ])
      )
    : enMessages;

  return { locale, messages };
});
