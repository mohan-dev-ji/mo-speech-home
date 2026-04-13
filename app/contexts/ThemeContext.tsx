"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

// ─── ThemeTokens — mirrors Figma design system + Convex schema ────────────────
// Source: docs/3-design/design-system/Themes/*.tokens.json
// CSS vars: tailwind.config.ts + app/globals.css

export type ThemeTokens = {
  // Colours — required, unique per theme
  background:         string;   // --theme-background
  primary:            string;   // --theme-primary
  banner:             string;   // --theme-banner
  card:               string;   // --theme-card
  altCard:            string;   // --theme-alt-card
  symbolBg:           string;   // --theme-symbol-bg
  buttonHighlight:    string;   // --theme-button-highlight
  text:               string;   // --theme-text
  secondaryText:      string;   // --theme-secondary-text
  altText:            string;   // --theme-alt-text
  secondaryAltText:   string;   // --theme-secondary-alt-text
  line:               string;   // --theme-line
  enterMode:          string;   // --theme-enter-mode
  success:            string;   // --theme-success
  warning:            string;   // --theme-warning

  // Spacing — optional overrides (flat themes inherit CSS defaults)
  generalPadding?:          number;   // --theme-general-padding
  generalSpaceBetween?:     number;   // --theme-general-space-between
  headerBannerPadding?:     number;   // --theme-header-banner-padding
  modalPadding?:            number;   // --theme-modal-padding
  categoriesFolderPadding?: number;   // --theme-categories-folder-padding
  modalSpaceBetween?:       number;   // --theme-modal-space-between
  largeButtonsPadding?:     number;   // --theme-large-buttons-padding
  itemPadding?:             number;   // --theme-item-padding
  headerTalkerPadding?:     number;   // --theme-header-talker-padding
  roundness?:               number;   // --theme-roundness
  smallRoundness?:          number;   // --theme-small-roundness
  elementsSpaceBetween?:    number;   // --theme-elements-space-between
  symbolCardPadding?:       number;   // --theme-symbol-card-padding
  buttonsYPadding?:         number;   // --theme-buttons-y-padding

  // Animation (animated themes only)
  bgAnimation?:         string;   // --theme-bg-animation
  bgAnimationDuration?: string;   // --theme-bg-animation-duration
  cardAnimation?:       string;   // --theme-card-animation
};

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
};

// ─── Theme catalogue — all 6 flat themes ──────────────────────────────────────
// Source: docs/3-design/design-system/Themes/*.tokens.json
// Shared values (background, altCard, symbolBg, text, secondaryText,
// altText, success, warning) are identical across all flat themes.

const SHARED: Pick<ThemeTokens, 'background' | 'altCard' | 'symbolBg' | 'text' | 'secondaryText' | 'altText' | 'success' | 'warning'> = {
  background:    '#18181B',  // zinc/900
  altCard:       '#E4E4E7',  // zinc/200
  symbolBg:      '#FAFAFA',  // zinc/50
  text:          '#3F3F46',  // zinc/700
  secondaryText: '#71717B',  // zinc/500
  altText:       '#FAFAFA',  // zinc/50
  success:       '#00C951',  // green/500
  warning:       '#FB2C36',  // red/500
};

export const THEME_TOKENS = {
  default: {
    ...SHARED,
    primary:          '#62748E',  // slate/500
    banner:           '#45556C',  // slate/600
    card:             '#314158',  // slate/700
    buttonHighlight:  '#E2E8F0',  // slate/200
    line:             '#1E293B',  // slate/800
    secondaryAltText: '#D4D4D8',  // zinc/300
    enterMode:        '#FF6900',  // orange/500
  },
  sky: {
    ...SHARED,
    primary:          '#00A6F4',  // sky/500
    banner:           '#0084D1',  // sky/600
    card:             '#024A70',  // sky/900
    buttonHighlight:  '#B8E6FE',  // sky/200
    line:             '#075985',  // sky/800
    secondaryAltText: '#F4F4F5',  // zinc/100
    enterMode:        '#FD9A00',  // amber/500
  },
  amber: {
    ...SHARED,
    primary:          '#E17100',  // amber/600
    banner:           '#BB4D00',  // amber/700
    card:             '#7B3306',  // amber/900
    buttonHighlight:  '#FEE685',  // amber/200
    line:             '#92400E',  // amber/800
    secondaryAltText: '#F4F4F5',  // zinc/100
    enterMode:        '#FF6900',  // orange/500
  },
  fuchsia: {
    ...SHARED,
    primary:          '#E12AFB',  // fuchsia/500
    banner:           '#A800B7',  // fuchsia/700
    card:             '#721378',  // fuchsia/900
    buttonHighlight:  '#F6CFFF',  // fuchsia/200
    line:             '#86198F',  // fuchsia/800
    secondaryAltText: '#F4F4F5',  // zinc/100
    enterMode:        '#FF6900',  // orange/500
  },
  lime: {
    ...SHARED,
    primary:          '#5EA500',  // lime/600
    banner:           '#497D00',  // lime/700
    card:             '#35530E',  // lime/900
    buttonHighlight:  '#D8F999',  // lime/200
    line:             '#3F6212',  // lime/800
    secondaryAltText: '#F4F4F5',  // zinc/100
    enterMode:        '#FF6900',  // orange/500
  },
  rose: {
    ...SHARED,
    primary:          '#FF2056',  // rose/500
    banner:           '#C70036',  // rose/700
    card:             '#8B0836',  // rose/900
    buttonHighlight:  '#FFCCD3',  // rose/200
    line:             '#9F1239',  // rose/800
    secondaryAltText: '#F4F4F5',  // zinc/100
    enterMode:        '#FF6900',  // orange/500
  },
} satisfies Record<string, ThemeTokens>;

export type ThemeSlug = keyof typeof THEME_TOKENS;

// ─── Apply tokens to CSS vars ─────────────────────────────────────────────────

function applyThemeTokens(tokens: ThemeTokens, reduceMotion = false) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    const value = tokens[key as keyof ThemeTokens];
    if (value !== undefined) {
      root.style.setProperty(cssVar, typeof value === 'number' ? `${value}px` : value);
    }
  }
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
