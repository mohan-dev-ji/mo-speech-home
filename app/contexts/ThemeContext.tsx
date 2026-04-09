"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// ─── Token type — mirrors convex/schema.ts themes.tokens exactly ──────────────

export type ThemeTokens = {
  // Backgrounds (can be any CSS background value — hex, url(), gradient)
  bgPrimary:     string;
  bgSurface:     string;
  bgSurfaceAlt:  string;

  // Brand
  brandPrimary:   string;
  brandSecondary: string;
  brandTertiary:  string;

  // Text
  textPrimary:  string;
  textSecondary: string;
  textOnBrand:  string;

  // Symbol cards
  symbolCardBg:     string;
  symbolCardText:   string;
  symbolCardBorder: string;
  symbolCardGlow:   string;

  // Talker bar
  talkerBg:     string;
  talkerText:   string;
  talkerBorder: string;

  // Navigation (sidebar)
  navBg:          string;
  navText:        string;
  navTextActive:  string;
  navIndicator:   string;

  // Utility
  success: string;
  warning: string;
  error:   string;
  overlay: string;
};

// ─── CSS custom property map ───────────────────────────────────────────────────
// Maps each ThemeTokens key to its CSS variable name in globals.css.

const TOKEN_TO_CSS: Record<keyof ThemeTokens, string> = {
  bgPrimary:       '--theme-bg-primary',
  bgSurface:       '--theme-bg-surface',
  bgSurfaceAlt:    '--theme-bg-surface-alt',
  brandPrimary:    '--theme-brand-primary',
  brandSecondary:  '--theme-brand-secondary',
  brandTertiary:   '--theme-brand-tertiary',
  textPrimary:     '--theme-text-primary',
  textSecondary:   '--theme-text-secondary',
  textOnBrand:     '--theme-text-on-brand',
  symbolCardBg:    '--theme-symbol-card-bg',
  symbolCardText:  '--theme-symbol-card-text',
  symbolCardBorder:'--theme-symbol-card-border',
  symbolCardGlow:  '--theme-symbol-card-glow',
  talkerBg:        '--theme-talker-bg',
  talkerText:      '--theme-talker-text',
  talkerBorder:    '--theme-talker-border',
  navBg:           '--theme-nav-bg',
  navText:         '--theme-nav-text',
  navTextActive:   '--theme-nav-text-active',
  navIndicator:    '--theme-nav-indicator',
  success:         '--theme-success',
  warning:         '--theme-warning',
  error:           '--theme-error',
  overlay:         '--theme-overlay',
};

// ─── Classic Blue — default theme (placeholder values) ────────────────────────
// You will replace these with your design tokens. Until then, the app looks
// identical to the current shell since these match the globals.css defaults.

export const CLASSIC_BLUE_TOKENS: ThemeTokens = {
  bgPrimary:       '#f8fafc',
  bgSurface:       '#ffffff',
  bgSurfaceAlt:    '#3d4e5f',
  brandPrimary:    '#3b82f6',
  brandSecondary:  '#60a5fa',
  brandTertiary:   '#bfdbfe',
  textPrimary:     '#0f172a',
  textSecondary:   '#64748b',
  textOnBrand:     '#ffffff',
  symbolCardBg:    '#ffffff',
  symbolCardText:  '#0f172a',
  symbolCardBorder:'1px solid #e2e8f0',
  symbolCardGlow:  'none',
  talkerBg:        '#1e293b',
  talkerText:      '#f8fafc',
  talkerBorder:    '1px solid #334155',
  navBg:           '#5a6878',
  navText:         '#ffffff',
  navTextActive:   '#ffffff',
  navIndicator:    '#3b82f6',
  success:         '#22c55e',
  warning:         '#f59e0b',
  error:           '#ef4444',
  overlay:         '#000000',
};

// ─── Apply ─────────────────────────────────────────────────────────────────────

function applyThemeTokens(tokens: ThemeTokens, reduceMotion = false) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    root.style.setProperty(cssVar, tokens[key as keyof ThemeTokens]);
  }
  // Reduced motion data attribute — drives .animated-* suppression in globals.css
  root.setAttribute('data-reduce-motion', String(reduceMotion));
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
  tokens: CLASSIC_BLUE_TOKENS,
  reduceMotion: false,
  setTheme: () => {},
  setReduceMotion: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ThemeTokens>(CLASSIC_BLUE_TOKENS);
  const [reduceMotion, setReduceMotionState] = useState(false);

  // Apply Classic Blue on first mount — no flash since CSS defaults match
  useEffect(() => {
    applyThemeTokens(CLASSIC_BLUE_TOKENS, reduceMotion);
  }, []);

  // Phase 1+: ProfileContext will call setTheme() when the active studentProfile loads
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
