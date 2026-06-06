/**
 * Theme module JSON shape.
 *
 * Each theme in the catalogue is a single JSON file in this directory, slug-keyed
 * (`<slug>.json`). The bundled `_index.ts` barrel imports them all and exposes a
 * typed `THEME_MODULES` map. See `convex/lib/themes.ts` for the readers and
 * `lib/themes/registry.ts` for the client-side token lookup.
 *
 * Per ADR-011 §2: themes are a pluggable content module mirroring resource packs
 * (ADR-010). A profile stores only a `themeSlug`; the token definition is resolved
 * live from this catalogue at render (dynamic resolution — ADR-012 §7), so an
 * admin's edit to a theme reaches every existing user with no migration.
 *
 * **Source of truth:** the token *values* live in these JSON files (content →
 * code deploy to change, same constraint as pack JSON). A theme's *lifecycle*
 * (published / tier / featured / scheduled) lives in the `themeLifecycle` overlay
 * table and is deploy-free.
 *
 * **Localisation:** user-visible strings are ISO-keyed open records
 * (`LocalisedString`) per ADR-009 §2. Display reads through
 * `lib/languages/displayValue.ts`.
 */

export type ThemeTier = "free" | "pro" | "max";

/**
 * ISO-keyed open record for localised strings. e.g. { en: "Sky", hi: "आसमानी" }.
 * Adding a language is adding a key, not a type change.
 */
export type LocalisedString = Record<string, string>;

/**
 * The canonical theme token map. Mirrors the Figma design system and the
 * `--theme-*` CSS custom properties declared in `app/globals.css`. Applied to
 * the document root by `app/contexts/ThemeContext.tsx` (`TOKEN_TO_CSS`).
 *
 * This is the single source of truth for the token shape — `ThemeContext`
 * re-exports it for back-compat.
 */
export type ThemeTokens = {
  // Colours — required, unique per theme
  background: string; // --theme-background
  primary: string; // --theme-primary
  banner: string; // --theme-banner
  card: string; // --theme-card
  altCard: string; // --theme-alt-card
  symbolBg: string; // --theme-symbol-bg
  buttonHighlight: string; // --theme-button-highlight
  text: string; // --theme-text
  secondaryText: string; // --theme-secondary-text
  altText: string; // --theme-alt-text
  secondaryAltText: string; // --theme-secondary-alt-text
  line: string; // --theme-line
  enterMode: string; // --theme-enter-mode
  success: string; // --theme-success
  warning: string; // --theme-warning

  // Spacing — optional overrides (flat themes inherit CSS defaults)
  generalPadding?: number; // --theme-general-padding
  generalSpaceBetween?: number; // --theme-general-space-between
  headerBannerPadding?: number; // --theme-header-banner-padding
  modalPadding?: number; // --theme-modal-padding
  categoriesFolderPadding?: number; // --theme-categories-folder-padding
  modalSpaceBetween?: number; // --theme-modal-space-between
  largeButtonsPadding?: number; // --theme-large-buttons-padding
  itemPadding?: number; // --theme-item-padding
  headerTalkerPadding?: number; // --theme-header-talker-padding
  roundness?: number; // --theme-roundness
  smallRoundness?: number; // --theme-small-roundness
  elementsSpaceBetween?: number; // --theme-elements-space-between
  symbolCardPadding?: number; // --theme-symbol-card-padding
  buttonsYPadding?: number; // --theme-buttons-y-padding

  // Animation (animated themes only)
  bgAnimation?: string; // --theme-bg-animation
  bgAnimationDuration?: string; // --theme-bg-animation-duration
  cardAnimation?: string; // --theme-card-animation

  // ── Four-layer model (ADR-011 §2.1) — all optional, additive ──────────────
  // Flat themes omit these; they default to no-ops in globals.css so the six
  // builtins render pixel-identically. Premium themes opt in.

  // Background layer — full CSS background value painted by the fixed
  // `.theme-bg-layer` div behind the app shell. Falls back to `background`.
  bgLayer?: string; // --theme-bg-layer  (e.g. "linear-gradient(...)")

  // Texture layer — a procedural grain. `textureImage` is an inline SVG
  // feTurbulence data-URI string (no asset file). Applied by the fixed
  // `.theme-texture-layer` div with a blend mode + opacity.
  textureImage?: string; // --theme-texture-image   (url("data:image/svg+xml,..."))
  textureBlend?: string; // --theme-texture-blend   (overlay | soft-light | …)
  textureOpacity?: number; // --theme-texture-opacity (UNITLESS, ~0.04–0.10)

  // Surface (glass) layer — translucent chrome. No-op defaults keep flat
  // themes solid. Only the opted-in chrome components read these. Two surface
  // colours so flat themes stay pixel-identical: card-like chrome (sidebar,
  // talker panel) uses `surface`; bar-like chrome (top bar, talker header)
  // uses `surfaceBar`. Premium themes typically set both to the same rgba.
  surface?: string; // --theme-surface         (default var(--theme-card))
  surfaceBar?: string; // --theme-surface-bar     (default var(--theme-banner))
  surfaceBlur?: number; // --theme-surface-blur    (px; 0 = no glass)
  surfaceSaturate?: string; // --theme-surface-saturate (e.g. "170%"; default "100%")
  surfaceBorder?: string; // --theme-surface-border  (hairline; default var(--theme-line))
};

/**
 * A theme in the catalogue.
 *
 * `builtin: true` marks the original launch themes — they are always visible in
 * the picker without a `themeLifecycle` row, so the base set can never vanish
 * and depends on no migration. Additional themes need an admin publish (a
 * lifecycle row within its window) to appear.
 */
export type ThemeModule = {
  slug: string; // 'default' | 'sky' | … — MUST stay stable; profiles store it
  name: LocalisedString; // { en, hi? }
  description?: LocalisedString;
  previewColour: string; // swatch hex shown in the picker
  coverImagePath?: string; // R2 path — richer picker preview (optional)
  type: "flat" | "tiled" | "animated";
  defaultTier: ThemeTier; // beaten by themeLifecycle.tierOverride
  builtin?: boolean; // true → always visible, no lifecycle row required
  tokens: ThemeTokens;
};
