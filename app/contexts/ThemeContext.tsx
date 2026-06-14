"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

// ─── ThemeTokens + catalogue ──────────────────────────────────────────────────
// The token *type* and the per-theme token *values* now live in the bundled
// theme catalogue (`convex/data/themes/*.json`), resolved by slug at render via
// `lib/themes/registry`. Per ADR-011 §2.3 the source of truth moved from this
// hard-coded file to JSON; this context just applies whatever the slug resolves
// to. The type is re-exported here for back-compat with existing import sites.

import type { ThemeTokens } from '@/lib/themes/registry';
import { THEME_MODULE_MAP } from '@/lib/themes/registry';
export type { ThemeTokens };

// ─── CSS variable map ──────────────────────────────────────────────────────────

const TOKEN_TO_CSS: Record<keyof ThemeTokens, string> = {
  background:               '--theme-background',
  primary:                  '--theme-primary',
  banner:                   '--theme-banner',
  card:                     '--theme-card',
  altCard:                  '--theme-alt-card',
  symbolBg:                 '--theme-symbol-bg',
  buttonHighlight:          '--theme-button-highlight',
  text:                     '--theme-text',
  secondaryText:            '--theme-secondary-text',
  altText:                  '--theme-alt-text',
  secondaryAltText:         '--theme-secondary-alt-text',
  line:                     '--theme-line',
  enterMode:                '--theme-enter-mode',
  success:                  '--theme-success',
  warning:                  '--theme-warning',
  // Figma "Finals" tokens (migration Stage 1)
  pillBg:                   '--theme-pill-bg',
  packBg:                   '--theme-pack-bg',
  buttonRoundness:          '--theme-button-roundness',
  cardRoundness:            '--theme-card-roundness',
  packCardRoundness:        '--theme-pack-card-roundness',
  modalRoundness:           '--theme-modal-roundness',
  chipRoundness:            '--theme-chip-roundness',
  elevationSubtle:          '--theme-elevation-subtle',
  elevationSurface:         '--theme-elevation-surface',
  elevationModal:           '--theme-elevation-modal',
  generalPadding:           '--theme-general-padding',
  generalSpaceBetween:      '--theme-general-space-between',
  headerBannerPadding:      '--theme-header-banner-padding',
  modalPadding:             '--theme-modal-padding',
  categoriesFolderPadding:  '--theme-categories-folder-padding',
  modalSpaceBetween:        '--theme-modal-space-between',
  largeButtonsPadding:      '--theme-large-buttons-padding',
  itemPadding:              '--theme-item-padding',
  headerTalkerPadding:      '--theme-header-talker-padding',
  roundness:                '--theme-roundness',
  smallRoundness:           '--theme-small-roundness',
  elementsSpaceBetween:     '--theme-elements-space-between',
  symbolCardPadding:        '--theme-symbol-card-padding',
  buttonsYPadding:          '--theme-buttons-y-padding',
  bgAnimation:              '--theme-bg-animation',
  bgAnimationDuration:      '--theme-bg-animation-duration',
  cardAnimation:            '--theme-card-animation',
  // Four-layer model (ADR-011 §2.1) — additive, no-op defaults live in globals.css
  bgLayer:                  '--theme-bg-layer',
  textureImage:             '--theme-texture-image',
  textureBlend:             '--theme-texture-blend',
  textureOpacity:           '--theme-texture-opacity',
  surface:                  '--theme-surface',
  surfaceBar:               '--theme-surface-bar',
  surfaceBlur:              '--theme-surface-blur',
  surfaceSaturate:          '--theme-surface-saturate',
  surfaceBorder:            '--theme-surface-border',
};

// Numeric tokens that must be written WITHOUT a `px` suffix (ratios/opacities).
const UNITLESS_TOKENS: ReadonlySet<keyof ThemeTokens> = new Set(['textureOpacity']);

// ─── Back-compat token map ─────────────────────────────────────────────────────
// A slug→tokens map derived from the bundled catalogue, for call sites that
// still expect the old `THEME_TOKENS` object. Prefer `getThemeTokens(slug)`
// from `lib/themes/registry` in new code.

export const THEME_TOKENS: Record<string, ThemeTokens> = Object.fromEntries(
  Object.entries(THEME_MODULE_MAP).map(([slug, m]) => [slug, m.tokens]),
);

// Slugs are now an open set sourced from JSON, not a fixed union.
export type ThemeSlug = string;

// ─── Apply tokens to CSS vars ─────────────────────────────────────────────────

// localStorage key for the pre-paint anti-flash bootstrap. The inline <head>
// script in app/layout.tsx reads this and applies the persisted CSS-var map
// before first paint, so a refresh shows the active theme immediately instead
// of flashing the globals.css `:root` Default until ProfileContext's query
// resolves. Keep the key in sync with that script.
const THEME_CSS_CACHE_KEY = 'aac-theme-css';

function applyThemeTokens(tokens: ThemeTokens, reduceMotion = false) {
  const root = document.documentElement;
  // Build the resolved CSS-var → string map once (so the persisted copy is the
  // exact same strings we set inline — the head script can apply it verbatim
  // without re-implementing the px/unitless logic).
  const cssMap: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    const value = tokens[key as keyof ThemeTokens];
    if (value !== undefined) {
      const isNum = typeof value === 'number';
      const unitless = UNITLESS_TOKENS.has(key as keyof ThemeTokens);
      cssMap[cssVar] = isNum && !unitless ? `${value}px` : String(value);
      root.style.setProperty(cssVar, cssMap[cssVar]);
    } else {
      // Token absent from this theme → clear any inline override so the var
      // falls back to its globals.css `:root` default. Critical when switching
      // a premium theme (gradient/texture/glass) back to a flat one — otherwise
      // the optional layer vars would persist. (Flat themes define all base
      // tokens, so only the optional four-layer vars are ever cleared here.)
      root.style.removeProperty(cssVar);
    }
  }
  root.setAttribute('data-reduce-motion', String(reduceMotion));
  // Persist for the next page load's pre-paint bootstrap (best-effort).
  try {
    localStorage.setItem(THEME_CSS_CACHE_KEY, JSON.stringify(cssMap));
  } catch {
    /* storage unavailable (private mode / quota) — fall back to :root defaults */
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

type ThemeContextValue = {
  activeThemeId: string | null;
  tokens: ThemeTokens;
  reduceMotion: boolean;
  setTheme: (themeId: string, tokens: ThemeTokens) => void;
  setReduceMotion: (value: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  activeThemeId: null,
  tokens: THEME_TOKENS.default,
  reduceMotion: false,
  setTheme: () => {},
  setReduceMotion: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ThemeTokens>(THEME_TOKENS.default);
  const [reduceMotion, setReduceMotionState] = useState(false);
  // No mount effect needed — CSS vars are defined in globals.css with default values.
  // Applying defaults here would race with ProfileContext's theme restoration on locale change.

  // ProfileContext calls setTheme() when the active studentProfile loads
  function setTheme(themeId: string, newTokens: ThemeTokens) {
    setActiveThemeId(themeId);
    setTokens(newTokens);
    applyThemeTokens(newTokens, reduceMotion);
  }

  function setReduceMotion(value: boolean) {
    setReduceMotionState(value);
    document.documentElement.setAttribute('data-reduce-motion', String(value));
  }

  return (
    <ThemeContext.Provider value={{ activeThemeId, tokens, reduceMotion, setTheme, setReduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
