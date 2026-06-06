/**
 * Theme catalogue barrel.
 *
 * Imports every `*.json` theme file in this directory and re-exports them as a
 * typed `THEME_MODULES` map keyed by slug. Bundlers (Convex + Next.js) treat the
 * JSON imports as compile-time data, so this map ships with every deploy.
 *
 * **When adding a theme**: place the new `<slug>.json` file alongside this
 * barrel, then add one import line + one map entry below. Keep the map keys +
 * filenames + the file's `slug` field aligned. A theme appears in users' pickers
 * once an admin publishes it (a `themeLifecycle` row in its window) — unless it's
 * marked `builtin`, in which case it's always visible.
 *
 * **When removing a theme**: delete the JSON file, remove the import + map entry.
 * Never remove a slug that profiles still store (the six builtins) — a missing
 * slug falls back to `default` at render.
 *
 * Per ADR-011 §2. Mirrors `convex/data/library_packs/_index.ts`.
 */

import type { ThemeModule } from "./types";

// ── Theme imports ─────────────────────────────────────────────────────────────
import defaultTheme from "./default.json";
import sky from "./sky.json";
import amber from "./amber.json";
import fuchsia from "./fuchsia.json";
import lime from "./lime.json";
import rose from "./rose.json";
import midnightGlass from "./midnight_glass.json";

// ── Catalogue map ─────────────────────────────────────────────────────────────

export const THEME_MODULES: Record<string, ThemeModule> = {
  default: defaultTheme as ThemeModule,
  sky: sky as ThemeModule,
  amber: amber as ThemeModule,
  fuchsia: fuchsia as ThemeModule,
  lime: lime as ThemeModule,
  rose: rose as ThemeModule,
  midnight_glass: midnightGlass as ThemeModule,
};

// ── Re-exports ────────────────────────────────────────────────────────────────

export type { ThemeModule, ThemeTokens, ThemeTier, LocalisedString } from "./types";
