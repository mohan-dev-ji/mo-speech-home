import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "../lib/languages/registry";

/**
 * Routing locales come from `lib/languages/registry.ts` — assembled from
 * the JSON modules in `convex/data/languages/`. Adding a language is adding
 * a JSON file + barrel export, not editing this file. Per ADR-009 §1.
 *
 * Note: every registry locale is routable regardless of lifecycle status
 * (deep-links to `/pa/...` resolve even when Punjabi is `machine-translated`).
 * Picker visibility is gated separately via the Convex `getVisibleLanguages`
 * query. See ADR-009 §3 / ADR-011 §3.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
