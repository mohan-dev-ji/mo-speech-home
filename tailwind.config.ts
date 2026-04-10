import type { Config } from 'tailwindcss'

// ─── Mo Speech Design Token Config ────────────────────────────────────────────
//
// Defines Tailwind utilities backed by CSS custom properties. Values are
// injected at runtime by ThemeContext — switching themes is a CSS var update,
// no component changes needed.
//
// Colour:      bg-theme-primary   text-theme-alt-text   border-theme-line
//              bg-theme-card      text-theme-text        bg-theme-button-highlight
// Roundness:   rounded-theme      rounded-theme-sm
// Spacing:     p-theme-general    px-theme-btn-x         py-theme-btn-y
// Typography:  text-theme-h1      text-theme-p           text-theme-s
//              Pair size with weight: font-semibold (headings, p-bold) | font-normal (body)
//              p-bold = text-theme-p + font-semibold
// ──────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Theme colour tokens ──────────────────────────────────────────────
        // Sourced from docs/3-design/design-system/Themes/*.tokens.json
        // Only colour tokens vary per theme. All others are shared.

        // Backgrounds & surfaces
        'theme-background':         'var(--theme-background)',
        'theme-primary':            'var(--theme-primary)',
        'theme-banner':             'var(--theme-banner)',
        'theme-card':               'var(--theme-card)',
        'theme-alt-card':           'var(--theme-alt-card)',
        'theme-symbol-bg':          'var(--theme-symbol-bg)',
        'theme-button-highlight':   'var(--theme-button-highlight)',

        // Text
        'theme-text':               'var(--theme-text)',
        'theme-secondary-text':     'var(--theme-secondary-text)',
        'theme-alt-text':           'var(--theme-alt-text)',
        'theme-secondary-alt-text': 'var(--theme-secondary-alt-text)',

        // Structural & state
        'theme-line':               'var(--theme-line)',
        'theme-enter-mode':         'var(--theme-enter-mode)',
        'theme-success':            'var(--theme-success)',
        'theme-warning':            'var(--theme-warning)',
      },

      borderRadius: {
        // ─── Roundness tokens ─────────────────────────────────────────────────
        // Use: rounded-theme (cards, large buttons, panels)
        //      rounded-theme-sm (small buttons, badges, inputs)
        'theme':    'var(--theme-roundness)',
        'theme-sm': 'var(--theme-small-roundness)',
      },

      fontSize: {
        // ─── Typography tokens — Noto Sans ───────────────────────────────────
        // Source: docs/3-design/design-system/Typography.png
        // Fixed px (not responsive) — intentional for multi-language consistency.
        // Font family is always Noto Sans (set in globals.css [data-locale]).
        //
        // Weights are NOT baked in — apply separately:
        //   Headings / p-bold → font-semibold (600)
        //   large / p / s     → font-normal   (400)
        //
        // [size, lineHeight] — line heights can be adjusted without Figma changes.
        'theme-h1':    ['var(--theme-text-h1)',    '1.1'],   // 64px
        'theme-h2':    ['var(--theme-text-h2)',    '1.15'],  // 48px
        'theme-h3':    ['var(--theme-text-h3)',    '1.2'],   // 36px
        'theme-h4':    ['var(--theme-text-h4)',    '1.25'],  // 24px
        'theme-large': ['var(--theme-text-large)', '1.4'],   // 20px
        'theme-p':     ['var(--theme-text-p)',     '1.5'],   // 16px  (regular or semibold)
        'theme-s':     ['var(--theme-text-s)',     '1.5'],   // 14px
      },

      spacing: {
        // ─── Spacing tokens ───────────────────────────────────────────────────
        // All flat themes share these values (see 15-themes.md for full table).
        // Use as padding, margin, gap utilities: p-theme-general, gap-theme-gap, etc.
        'theme-general':   'var(--theme-general-padding)',
        'theme-gap':       'var(--theme-general-space-between)',
        'theme-modal':     'var(--theme-modal-padding)',
        'theme-modal-gap': 'var(--theme-modal-space-between)',
        'theme-folder':    'var(--theme-categories-folder-padding)',
        'theme-btn-x':     'var(--theme-large-buttons-padding)',
        'theme-btn-y':     'var(--theme-buttons-y-padding)',
        'theme-item':      'var(--theme-item-padding)',
        'theme-symbol':    'var(--theme-symbol-card-padding)',
        'theme-elements':  'var(--theme-elements-space-between)',
        'theme-banner':    'var(--theme-header-banner-padding)',
        'theme-talker':    'var(--theme-header-talker-padding)',
      },
    },
  },
}

export default config
